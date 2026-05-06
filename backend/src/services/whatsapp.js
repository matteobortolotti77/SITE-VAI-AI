// services/whatsapp.js — Adapter Z-API
// Trocar provedor = trocar apenas este arquivo (§11.2 CLAUDE.md)
import { config } from '../config.js';

const BASE_URL = `https://api.z-api.io/instances/${config.zapi.instanceId}/token/${config.zapi.token}`;

/**
 * Envia mensagem de texto puro via WhatsApp.
 * Texto puro é obrigatório para fornecedores (§11.3 CLAUDE.md — resiliência offline).
 * @param {string} phone  - Número E.164 sem o + (ex: 5575999990000)
 * @param {string} text   - Mensagem de texto puro
 */
export async function sendWhatsAppText(phone, text) {
    if (!config.zapi.instanceId || !config.zapi.token) {
        throw new Error('Z-API não configurada (Z_API_INSTANCE_ID / Z_API_TOKEN)');
    }

    // Z-API espera número sem + e sem caracteres especiais
    const phoneClean = phone.replace(/\D/g, '');

    const res = await fetch(`${BASE_URL}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneClean, message: text }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Z-API error ${res.status}: ${body}`);
    }

    return await res.json();
}

/**
 * Template: mensagem de confirmação ao cliente (pós-pagamento)
 * Sempre em PT (operacional). Se cliente ≠ PT, inclui idioma no início.
 */
export function buildClientConfirmationMessage({ customerName, products, cartId, locale = 'pt-BR' }) {
    const langPrefix = locale !== 'pt-BR' ? `🌐 *Idioma do cliente:* ${locale}\n\n` : '';

    const productLines = products
        .map(p => `• *${p.name}* — ${p.date} às ${p.time} · ${p.qty} pessoa(s)`)
        .join('\n');

    return `${langPrefix}✅ *Reserva confirmada!*

Olá, ${customerName}!

Seus passeios reservados:
${productLines}

Seu voucher será enviado em breve.
Ref: \`${cartId}\`

*Responda OK para confirmar o recebimento.*

Dúvidas? Estamos aqui 👇
https://wa.me/5575998240043`;
}

/**
 * Template: lista diária para fornecedor (texto puro — §11.3)
 * Enviada pelo cron às 20:00 BRT com os passageiros do dia seguinte.
 * @param {object} opts
 * @param {string} opts.providerName
 * @param {string} opts.travelDate       - formato DD/MM/YYYY
 * @param {Array}  opts.passengers       - [{ name, doc, product, time, qty }]
 */
export function buildProviderDailyList({ providerName, travelDate, passengers }) {
    const lines = passengers
        .map((p, i) => `${i + 1}. ${p.name} | ${p.doc} | ${p.product} ${p.time} | ${p.qty}px`)
        .join('\n');

    return `📋 *LISTA DO DIA — Volta à Ilha*
Data: *${travelDate}*
Fornecedor: *${providerName}*
Total: *${passengers.length} passageiro(s)*

${lines}

Confirmado por Volta à Ilha ✅
Dúvidas: +55 75 99824-0043`;
}
