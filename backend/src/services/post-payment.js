// Post-payment pipeline: gera voucher PDF + enfileira jobs (email + whatsapp).
// Worker (cron) processa retries 0/30s/5min até max_attempts (3).
import { generateVoucherPDF } from './voucher.js';
import { uploadVoucher } from './storage.js';
import { config } from '../config.js';
import { getDb } from '../db/client.js';

/**
 * Gera vouchers e enfileira notificações. Idempotente: skip se voucher_url existe.
 */
export async function runPostPaymentPipeline(cartId) {
    const db = getDb();
    const { data: reservations, error } = await db
        .from('reservations')
        .select(`
            id, cart_id, travel_date, departure_time, qty_adults, qty_children, qty_infants,
            amount_deposit, amount_remaining, amount_total, voucher_url,
            customer:customers(id, name, whatsapp, email, locale, doc_type, doc_number),
            product:products(id, slug, name)
        `)
        .eq('cart_id', cartId);
    if (error) throw new Error(`Failed to fetch cart: ${error.message}`);
    if (!reservations?.length) return { sent: 0 };

    const customer = reservations[0].customer || {};
    const jobs = [];

    for (const r of reservations) {
        if (r.voucher_url) continue;
        try {
            const voucherUrl = `${config.publicBaseUrl || 'https://voltaailha.com.br'}/sucesso?cart_id=${cartId}`;
            const pdfBytes = await generateVoucherPDF({ reservation: r, voucherUrl });
            const url = await uploadVoucher(r.id, pdfBytes);
            await db.from('reservations').update({ voucher_url: url }).eq('id', r.id);

            if (customer.email) {
                jobs.push({
                    kind: 'voucher_email',
                    reservation_id: r.id,
                    payload: {
                        to: customer.email,
                        customer_name: customer.name,
                        voucher_url: url,
                        product_name: r.product?.name || 'Passeio',
                        travel_date: r.travel_date,
                        departure_time: r.departure_time,
                    },
                });
            }
        } catch (e) {
            await db.from('notifications').insert({
                reservation_id: r.id,
                recipient_type: 'customer',
                channel: 'email',
                status: 'failed',
                error: `voucher_gen: ${e.message}`,
            });
        }
    }

    // 1 WhatsApp consolidado por cart
    if (customer.whatsapp) {
        jobs.push({
            kind: 'voucher_whatsapp',
            reservation_id: reservations[0].id,
            payload: {
                phone: customer.whatsapp,
                customer_name: customer.name,
                cart_id: cartId,
                locale: customer.locale || 'pt-BR',
                products: reservations.map(r => ({
                    name: r.product?.name || '?',
                    date: r.travel_date,
                    time: r.departure_time,
                    qty: r.qty_adults + r.qty_children + r.qty_infants,
                })),
            },
        });
    }

    if (jobs.length) {
        await db.from('notification_jobs').insert(jobs);
    }
    return { jobs_enqueued: jobs.length };
}
