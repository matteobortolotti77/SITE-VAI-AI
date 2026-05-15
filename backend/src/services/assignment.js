// Auto-atribui o fornecedor com maior commission_value para um produto.
// Empate: primeiro id (ordem ascendente). Sem fornecedor ativo = null + alerta.
import { sendWhatsAppText } from './whatsapp.js';
import { config } from '../config.js';

/**
 * @returns {Promise<{ provider_id: string|null, commission_amount: number }>}
 */
export async function pickProviderForProduct(db, productId) {
    const { data } = await db
        .from('provider_products')
        .select('provider_id, commission_value')
        .eq('product_id', productId)
        .eq('active', true)
        .order('commission_value', { ascending: false })
        .order('provider_id', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (!data) return { provider_id: null, commission_amount: 0 };
    return {
        provider_id: data.provider_id,
        commission_amount: Number(data.commission_value) || 0,
    };
}

/**
 * Dispara alerta WhatsApp ao admin quando reserva fica orphan (sem provider).
 * Falha silenciosa — não bloqueia checkout.
 */
export async function alertOrphanReservation({ cartId, productName, customerName, travelDate }) {
    const recipients = [];
    const main = config.zapi.whatsappNumber;
    if (main) recipients.push(main);
    const extras = (process.env.ADMIN_ALERT_WHATSAPPS || '').split(',').map(s => s.trim()).filter(Boolean);
    for (const e of extras) recipients.push(e);

    const text = `⚠️ *Reserva sem fornecedor atribuído*

Produto: ${productName}
Cliente: ${customerName}
Data passeio: ${travelDate}
Cart ID: ${cartId}

Atribua manualmente no painel admin.`;

    for (const phone of recipients) {
        try {
            await sendWhatsAppText(phone, text);
        } catch (e) {
            // Log mas não propaga
            console.warn('alertOrphanReservation failed for', phone, e.message);
        }
    }
}
