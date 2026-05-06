// services/email.js — Adapter Resend
// Trocar provedor = trocar apenas este arquivo (§11.2 CLAUDE.md)
import { Resend } from 'resend';
import { config } from '../config.js';

const resend = new Resend(config.resend.apiKey);

/**
 * Envia um e-mail via Resend.
 * @param {object} opts
 * @param {string|string[]} opts.to       - Destinatário(s)
 * @param {string}          opts.subject  - Assunto
 * @param {string}          opts.html     - Corpo HTML
 * @param {string}          [opts.text]   - Corpo texto puro (fallback)
 * @returns {Promise<{id: string}>}
 */
export async function sendEmail({ to, subject, html, text }) {
    if (!config.resend.apiKey) {
        throw new Error('RESEND_API_KEY não configurada');
    }

    const { data, error } = await resend.emails.send({
        from: config.resend.from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ''), // fallback: strip HTML
    });

    if (error) {
        throw new Error(`Resend error: ${error.message}`);
    }

    return { id: data.id };
}

/**
 * Template: e-mail de confirmação de reserva (pós-pagamento)
 */
export function buildReservationConfirmationEmail({ customerName, cartId, products, totalDeposit }) {
    const productList = products
        .map(p => `<li><strong>${p.name}</strong> — ${p.date} às ${p.time} · ${p.qty}x · Sinal: R$ ${p.deposit}</li>`)
        .join('');

    return {
        subject: '✅ Reserva confirmada — Volta à Ilha',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color:#00A33A;">Reserva confirmada! 🎉</h2>
                <p>Olá, <strong>${customerName}</strong>!</p>
                <p>Seu pagamento foi recebido com sucesso. Aqui estão os detalhes:</p>
                <ul>${productList}</ul>
                <p><strong>Total pago agora (sinal):</strong> R$ ${totalDeposit}</p>
                <p>Você receberá o voucher em breve via WhatsApp.</p>
                <p>Qualquer dúvida, fale com a gente: 
                   <a href="https://wa.me/5575998240043">WhatsApp</a>
                </p>
                <hr/>
                <small>CNPJ: 13.510.711/0001-58 · voltaailha.com.br</small>
            </div>
        `,
    };
}
