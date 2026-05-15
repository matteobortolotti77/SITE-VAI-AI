// services/email.js — Adapter Resend
// Trocar provedor = trocar apenas este arquivo (§11.2 CLAUDE.md)
import { Resend } from 'resend';
import { config } from '../config.js';

const resend = new Resend(config.resend.apiKey);

// Escape HTML para todas interpolações dinâmicas (LGPD + XSS)
function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

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
 * Template: e-mail com voucher pronto (pós voucher PDF gerado)
 */
export function buildVoucherEmail({ customerName, voucherUrl, productName, travelDate, departureTime }) {
    return {
        subject: `🎫 Voucher pronto — ${String(productName || '').replace(/[\r\n]/g, ' ')} (${String(travelDate || '').replace(/[\r\n]/g, ' ')})`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color:#00A33A;">Voucher pronto! 🎫</h2>
                <p>Olá, <strong>${esc(customerName)}</strong>!</p>
                <p>Aqui está o voucher do teu passeio:</p>
                <div style="background:#f5f6fa; padding:16px; border-radius:8px; margin:16px 0;">
                    <strong>${esc(productName)}</strong><br/>
                    📅 ${esc(travelDate)} · ${esc(departureTime)}
                </div>
                <p style="text-align:center; margin:24px 0;">
                    <a href="${esc(voucherUrl)}" style="background:#00A33A; color:#fff; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:600;">📄 Baixar voucher PDF</a>
                </p>
                <p><strong>⚠️ Importante:</strong></p>
                <ul style="font-size: 14px;">
                    <li>Confira data, horário e dados antes do embarque.</li>
                    <li>Apresente este voucher (impresso ou no celular) no embarque.</li>
                    <li>TUPA e taxas ambientais NÃO incluídas.</li>
                </ul>
                <p>Dúvidas: <a href="https://wa.me/5575998240043">WhatsApp +55 75 99824-0043</a></p>
                <hr/>
                <small>Volta à Ilha · CNPJ 13.510.711/0001-58 · voltaailha.com.br</small>
            </div>
        `,
    };
}

/**
 * Template: e-mail de confirmação de reserva (pós-pagamento)
 */
export function buildReservationConfirmationEmail({ customerName, cartId, products, totalDeposit }) {
    const productList = products
        .map(p => `<li><strong>${esc(p.name)}</strong> — ${esc(p.date)} às ${esc(p.time)} · ${esc(p.qty)}x · Sinal: R$ ${esc(p.deposit)}</li>`)
        .join('');

    return {
        subject: '✅ Reserva confirmada — Volta à Ilha',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color:#00A33A;">Reserva confirmada! 🎉</h2>
                <p>Olá, <strong>${esc(customerName)}</strong>!</p>
                <p>Seu pagamento foi recebido com sucesso. Aqui estão os detalhes:</p>
                <ul>${productList}</ul>
                <p><strong>Total pago agora (sinal):</strong> R$ ${esc(totalDeposit)}</p>
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
