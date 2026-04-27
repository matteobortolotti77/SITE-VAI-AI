// MercadoPago Checkout Pro — cria preference de pagamento
// Doc: https://www.mercadopago.com.br/developers/pt/reference/preferences/_checkout_preferences/post
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { config } from '../config.js';

let _client = null;

function getClient() {
    if (_client) return _client;
    if (!config.mp.accessToken) {
        throw new Error('MP_ACCESS_TOKEN faltando no .env');
    }
    _client = new MercadoPagoConfig({
        accessToken: config.mp.accessToken,
        options: { timeout: 5000 }
    });
    return _client;
}

/**
 * Cria preferência de pagamento Checkout Pro.
 * @param {object} args
 * @param {string} args.cartId — UUID do carrinho (vai em external_reference)
 * @param {Array<{title:string, quantity:number, unit_price:number}>} args.items
 * @param {object} args.payer — { name, email? }
 * @param {object} args.urls — { success, failure, pending } (callback URLs)
 * @returns {Promise<{ preferenceId, init_point, sandbox_init_point }>}
 */
export async function createPreference({ cartId, items, payer, urls }) {
    const client = getClient();
    const preference = new Preference(client);

    const body = {
        items: items.map((it, idx) => ({
            id: `item-${idx}`,
            title: it.title,
            quantity: it.quantity,
            currency_id: 'BRL',
            unit_price: Number(it.unit_price.toFixed(2))
        })),
        external_reference: cartId,
        statement_descriptor: 'VOLTAAILHA',
        back_urls: {
            success: urls.success,
            failure: urls.failure,
            pending: urls.pending
        },
        auto_return: 'approved'
    };

    if (payer && payer.name) {
        body.payer = { name: payer.name };
        if (payer.email) body.payer.email = payer.email;
    }

    if (config.mp.webhookSecret || urls.notification) {
        body.notification_url = urls.notification;
    }

    const result = await preference.create({ body });
    return {
        preferenceId: result.id,
        init_point: result.init_point,
        sandbox_init_point: result.sandbox_init_point
    };
}
