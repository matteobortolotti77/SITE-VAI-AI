// POST /v1/payments/webhook/mercadopago
// Recebe notificações do MP, valida, e atualiza status das reservas do cart

import { createHmac } from 'node:crypto';
import { getDb } from '../db/client.js';
import { config } from '../config.js';
import { runPostPaymentPipeline } from '../services/post-payment.js';

// LGPD §11.7: remove PII (email, doc, nome) antes de gravar payload do gateway
function sanitizeMpPayload(p) {
    if (!p || typeof p !== 'object') return p;
    const allowed = [
        'id', 'status', 'status_detail', 'transaction_amount', 'currency_id',
        'payment_type_id', 'payment_method_id', 'date_created', 'date_approved',
        'date_last_updated', 'external_reference', 'live_mode', 'operation_type',
        'transaction_details', 'fee_details', 'installments',
    ];
    const out = {};
    for (const k of allowed) if (p[k] !== undefined) out[k] = p[k];
    return out;
}

/**
 * Valida assinatura HMAC do webhook MP.
 * Header x-signature: "ts=<timestamp>,v1=<hash>"
 * String assinada: "id:<payment_id>;request-id:<x-request-id>;ts:<timestamp>;"
 */
function validateSignature(request, paymentId) {
    if (!config.mp.webhookSecret) {
        if (config.env === 'production') {
            request.log.error('MP_WEBHOOK_SECRET ausente em produção — rejeitando webhook');
            return false;
        }
        request.log.warn('MP_WEBHOOK_SECRET ausente (dev) — assinatura ignorada');
        return true;
    }

    const xSig = request.headers['x-signature'] || '';
    const xReqId = request.headers['x-request-id'] || '';

    const parts = Object.fromEntries(xSig.split(',').map(p => p.split('=')));
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    const manifest = `id:${paymentId};request-id:${xReqId};ts:${ts};`;
    const expected = createHmac('sha256', config.mp.webhookSecret)
        .update(manifest)
        .digest('hex');

    return expected === v1;
}

export default async function paymentsRoutes(app) {

    // POST /v1/payments/webhook/mercadopago
    app.post('/payments/webhook/mercadopago', async (request, reply) => {
        const { type, data } = request.body || {};

        // MP envia vários tipos de evento; só nos interessa payment
        if (type !== 'payment') {
            return reply.code(200).send({ ignored: true });
        }

        const paymentId = data?.id?.toString();
        if (!paymentId) return reply.code(400).send({ error: 'missing_payment_id' });

        // Valida assinatura
        if (!validateSignature(request, paymentId)) {
            request.log.warn({ paymentId }, 'Webhook MP: assinatura inválida');
            return reply.code(401).send({ error: 'invalid_signature' });
        }

        // Consulta o pagamento na API do MP para obter status real
        let payment;
        try {
            const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: { Authorization: `Bearer ${config.mp.accessToken}` }
            });
            if (!res.ok) throw new Error(`MP API ${res.status}`);
            payment = await res.json();
        } catch (e) {
            request.log.error({ paymentId, err: e.message }, 'Webhook MP: falha ao buscar pagamento');
            return reply.code(502).send({ error: 'mp_fetch_failed' });
        }

        const { status, external_reference: cartId } = payment;
        if (!cartId) {
            request.log.warn({ paymentId }, 'Webhook MP: sem external_reference (cart_id)');
            return reply.code(200).send({ ignored: true });
        }

        const db = getDb();

        // Busca reservas do cart
        const { data: reservations, error: rErr } = await db
            .from('reservations')
            .select('id, status, amount_deposit')
            .eq('cart_id', cartId);

        if (rErr || !reservations?.length) {
            request.log.warn({ cartId }, 'Webhook MP: cart não encontrado');
            return reply.code(200).send({ ignored: true }); // 200 pra MP não retentar
        }

        // Mapeia status MP → status interno
        let newStatus = null;
        if (status === 'approved') newStatus = 'deposit_paid';
        else if (status === 'cancelled' || status === 'rejected') newStatus = 'cancelled_force_majeure';

        if (!newStatus) {
            // pending, in_process, etc — aguarda próximo webhook
            return reply.code(200).send({ status, action: 'waiting' });
        }

        // Idempotência: insere payments com upsert. Se gateway_id já existe, conflict → skip pipeline.
        const allIds = reservations.map(r => r.id);
        const paymentRows = allIds.map(rid => ({
            reservation_id: rid,
            gateway: 'mercadopago',
            gateway_id: paymentId,
            type: 'deposit',
            amount: payment.transaction_amount || 0,
            method: payment.payment_type_id || null,
            status: payment.status,
            gateway_payload: sanitizeMpPayload(payment),
        }));

        const { data: insertedPayments, error: payErr } = await db
            .from('payments')
            .upsert(paymentRows, { onConflict: 'gateway,gateway_id', ignoreDuplicates: true })
            .select('id');

        if (payErr) {
            request.log.error({ cartId, err: payErr.message }, 'Webhook MP: payments upsert falhou');
            return reply.code(500).send({ error: 'db_payment_insert_failed' });
        }

        const isFirstTimeWebhook = (insertedPayments?.length || 0) > 0;
        if (!isFirstTimeWebhook) {
            request.log.info({ cartId, paymentId }, 'Webhook MP: replay (idempotency hit) — skip pipeline');
            return reply.code(200).send({ ok: true, idempotent: true, cart_id: cartId });
        }

        // Atualiza status apenas se ainda pending
        const pendingIds = reservations.filter(r => r.status === 'pending_payment').map(r => r.id);
        if (pendingIds.length > 0) {
            const { error: updErr } = await db
                .from('reservations')
                .update({ status: newStatus, gateway_payment_id: paymentId, updated_at: new Date().toISOString() })
                .in('id', pendingIds);
            if (updErr) {
                request.log.error({ cartId, err: updErr.message }, 'Webhook MP: falha ao atualizar reservas');
                return reply.code(500).send({ error: 'db_update_failed' });
            }
            request.log.info({ cartId, newStatus, updated: pendingIds.length }, 'Webhook MP: reservas atualizadas');
        }

        // Pipeline pós-pagamento async (1× garantido por idempotency)
        if (newStatus === 'deposit_paid') {
            runPostPaymentPipeline(cartId).catch(err => {
                request.log.error({ cartId, err: err.message }, 'Post-payment pipeline failed');
            });
        }

        return reply.code(200).send({ ok: true, cart_id: cartId, status: newStatus });
    });
}
