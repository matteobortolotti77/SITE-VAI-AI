// POST /v1/payments/webhook/mercadopago
// Recebe notificações do MP, valida, e atualiza status das reservas do cart

import { createHmac } from 'node:crypto';
import { getDb } from '../db/client.js';
import { config } from '../config.js';

/**
 * Valida assinatura HMAC do webhook MP.
 * Header x-signature: "ts=<timestamp>,v1=<hash>"
 * String assinada: "id:<payment_id>;request-id:<x-request-id>;ts:<timestamp>;"
 */
function validateSignature(request, paymentId) {
    if (!config.mp.webhookSecret) return true; // sem secret configurado: aceita tudo (dev)

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

        // Só atualiza se ainda estiver pending (idempotente)
        const ids = reservations
            .filter(r => r.status === 'pending_payment')
            .map(r => r.id);

        if (ids.length > 0) {
            const { error: updErr } = await db
                .from('reservations')
                .update({
                    status: newStatus,
                    gateway_payment_id: paymentId,
                    updated_at: new Date().toISOString()
                })
                .in('id', ids);

            if (updErr) {
                request.log.error({ cartId, err: updErr.message }, 'Webhook MP: falha ao atualizar reservas');
                return reply.code(500).send({ error: 'db_update_failed' });
            }

            // Log do pagamento na tabela payments
            const paymentRows = ids.map(rid => ({
                reservation_id: rid,
                gateway: 'mercadopago',
                gateway_id: paymentId,
                type: 'deposit',
                amount: payment.transaction_amount || 0,
                method: payment.payment_type_id || null,
                status: payment.status,
                gateway_payload: payment
            }));

            await db.from('payments').insert(paymentRows);

            request.log.info({ cartId, newStatus, updated: ids.length }, 'Webhook MP: reservas atualizadas');
        }

        return reply.code(200).send({ ok: true, cart_id: cartId, status: newStatus });
    });
}
