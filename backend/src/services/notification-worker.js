// Worker: processa notification_jobs com retry 0/30s/5min (max 3).
import { hostname } from 'node:os';
import { getDb } from '../db/client.js';
import { sendEmail, buildVoucherEmail } from './email.js';
import { sendWhatsAppText, buildClientConfirmationMessage } from './whatsapp.js';

const WORKER_ID = `${hostname()}-${process.pid}`;
const BACKOFF_SECONDS = [0, 30, 300]; // attempt 1, 2, 3

const HANDLERS = {
    voucher_email: async (p) => {
        const tpl = buildVoucherEmail({
            customerName: p.customer_name,
            voucherUrl: p.voucher_url,
            productName: p.product_name,
            travelDate: formatDateBR(p.travel_date),
            departureTime: p.departure_time,
        });
        await sendEmail({ to: p.to, ...tpl });
    },
    voucher_whatsapp: async (p) => {
        const text = buildClientConfirmationMessage({
            customerName: p.customer_name,
            cartId: p.cart_id,
            locale: p.locale,
            products: (p.products || []).map(x => ({
                name: x.name,
                date: formatDateBR(x.date),
                time: x.time,
                qty: x.qty,
            })),
        });
        await sendWhatsAppText(p.phone, text);
    },
};

export async function processNotificationJobs(logger) {
    const db = getDb();
    const { data: jobs, error } = await db.rpc('claim_notification_jobs', { p_worker: WORKER_ID, p_limit: 10 });
    if (error) {
        logger.error({ err: error.message }, 'claim_notification_jobs failed');
        return { processed: 0 };
    }
    if (!jobs?.length) return { processed: 0 };

    let ok = 0, failed = 0;
    for (const job of jobs) {
        const handler = HANDLERS[job.kind];
        if (!handler) {
            await db.from('notification_jobs').update({
                status: 'failed', last_error: `unknown_kind: ${job.kind}`, locked_at: null,
            }).eq('id', job.id);
            failed++;
            continue;
        }
        try {
            await handler(job.payload);
            await db.from('notification_jobs').update({
                status: 'done', last_error: null, locked_at: null,
            }).eq('id', job.id);
            await db.from('notifications').insert({
                reservation_id: job.reservation_id,
                recipient_type: 'customer',
                channel: job.kind === 'voucher_whatsapp' ? 'whatsapp' : 'email',
                status: 'sent',
                message_preview: job.kind,
                sent_at: new Date().toISOString(),
                retry_count: job.attempts - 1,
            });
            ok++;
        } catch (e) {
            const finalAttempt = job.attempts >= job.max_attempts;
            const nextDelay = BACKOFF_SECONDS[job.attempts] ?? 300;
            await db.from('notification_jobs').update({
                status: finalAttempt ? 'failed' : 'pending',
                last_error: e.message,
                next_attempt_at: new Date(Date.now() + nextDelay * 1000).toISOString(),
                locked_at: null,
            }).eq('id', job.id);
            if (finalAttempt) {
                await db.from('notifications').insert({
                    reservation_id: job.reservation_id,
                    recipient_type: 'customer',
                    channel: job.kind === 'voucher_whatsapp' ? 'whatsapp' : 'email',
                    status: 'failed',
                    message_preview: job.kind,
                    error: e.message,
                    retry_count: job.attempts,
                });
            }
            failed++;
        }
    }
    logger.info({ ok, failed, processed: jobs.length, worker: WORKER_ID }, 'notification jobs processed');
    return { processed: jobs.length, ok, failed };
}

function formatDateBR(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-');
    return `${d}/${m}/${y}`;
}
