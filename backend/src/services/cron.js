// Cron jobs internos. Usa croner — TZ America/Bahia.
// Daily 20:00 BRT: dispara send-daily WhatsApp para fornecedores (lista do dia seguinte).
import { Cron } from 'croner';
import { getDb } from '../db/client.js';
import { sendWhatsAppText, buildProviderDailyList } from './whatsapp.js';
import { config } from '../config.js';
import { processNotificationJobs } from './notification-worker.js';

let _started = false;

export function startCronJobs(logger) {
    if (_started) return;
    _started = true;

    // 20:00 todos os dias, fuso America/Bahia
    new Cron('0 20 * * *', { timezone: 'America/Bahia', name: 'send-daily-suppliers' }, async () => {
        const tomorrow = isoDateOffset(1);
        try {
            const result = await sendDailyForDate(tomorrow, { actorEmail: 'cron@system' });
            logger.info({ date: tomorrow, ...result }, 'Cron send-daily executado');
        } catch (err) {
            logger.error({ date: tomorrow, err: err.message }, 'Cron send-daily falhou');
        }
    });

    // Worker notifications: cada 30s processa pendentes (retry 0/30s/5min)
    new Cron('*/30 * * * * *', { name: 'notification-worker' }, async () => {
        try {
            await processNotificationJobs(logger);
        } catch (err) {
            logger.error({ err: err.message }, 'notification worker falhou');
        }
    });

    logger.info('Cron jobs iniciados (TZ America/Bahia + notification worker 30s)');
}

/**
 * Lógica reutilizável de send-daily — chamada pelo cron + endpoint manual.
 */
export async function sendDailyForDate(date, { actorId = null, actorEmail = 'cron@system' } = {}) {
    if (!config.canWrite()) throw new Error('service_not_configured');
    if (!config.canNotify()) throw new Error('whatsapp_not_configured');

    const db = getDb();
    const { data: reservations, error } = await db
        .from('reservations')
        .select(`
            id, departure_time, qty_adults, qty_children, qty_infants,
            customer:customers(name, doc_number),
            product:products(id, name, provider:providers(id, name, whatsapp))
        `)
        .eq('travel_date', date)
        .in('status', ['deposit_paid', 'fully_paid']);
    if (error) throw new Error(error.message);

    const items = reservations || [];
    if (!items.length) return { date, sent: 0, failed: 0, results: [] };

    const byProvider = new Map();
    for (const r of items) {
        const provider = r.product?.provider;
        if (!provider?.whatsapp) continue;
        if (!byProvider.has(provider.id)) byProvider.set(provider.id, { provider, items: [] });
        byProvider.get(provider.id).items.push(r);
    }

    const travelDateBR = formatDateBR(date);
    const results = [];

    for (const [, g] of byProvider) {
        const passengers = g.items.map(r => ({
            name: r.customer?.name || 'Sem nome',
            doc: r.customer?.doc_number || '—',
            product: r.product?.name || '?',
            time: r.departure_time,
            qty: r.qty_adults + r.qty_children + r.qty_infants,
        }));
        const text = buildProviderDailyList({
            providerName: g.provider.name,
            travelDate: travelDateBR,
            passengers,
        });
        let status = 'sent';
        let errorMsg = null;
        try {
            await sendWhatsAppText(g.provider.whatsapp, text);
        } catch (e) {
            status = 'failed';
            errorMsg = e.message;
        }
        await db.from('notifications').insert({
            recipient_type: 'provider',
            channel: 'whatsapp',
            status,
            message_preview: text.slice(0, 500),
            sent_at: status === 'sent' ? new Date().toISOString() : null,
            error: errorMsg,
        });
        results.push({ provider_id: g.provider.id, provider_name: g.provider.name, passenger_count: passengers.length, status, error: errorMsg });
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.length - sent;
    await db.from('admin_audit_log').insert({
        actor_id: actorId,
        actor_email: actorEmail,
        entity: 'notification_batch',
        action: 'send_daily',
        metadata: { date, sent, failed, results, source: actorId ? 'manual' : 'cron' },
    });
    return { date, sent, failed, results };
}

function isoDateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}
function formatDateBR(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
