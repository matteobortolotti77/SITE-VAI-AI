// Voucher PDF generator (CLAUDE.md §8.8 — conteúdo obrigatório)
// pdf-lib (~500KB) + qrcode. Layout programático A4.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 50;
const COLOR_PRIMARY = rgb(0, 0.64, 0.227);   // #00A33A
const COLOR_TEXT = rgb(0.10, 0.10, 0.11);    // #1A1A1D
const COLOR_MUTED = rgb(0.42, 0.45, 0.50);   // #6b7280
const COLOR_BG_BOX = rgb(0.96, 0.97, 0.98);

/**
 * Gera voucher PDF para uma reserva.
 * @param {object} args
 * @param {object} args.reservation — { id, cart_id, travel_date, departure_time, qty_adults, qty_children, qty_infants, amount_deposit, amount_remaining, amount_total, customer:{name, whatsapp, doc_type, doc_number}, product:{name, slug} }
 * @returns {Promise<Uint8Array>}
 */
export async function generateVoucherPDF({ reservation, voucherUrl }) {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([A4_W, A4_H]);
    const fontReg = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const r = reservation;
    const c = r.customer || {};
    const p = r.product || {};

    let y = A4_H - MARGIN;

    // Header
    page.drawText('VOLTA À ILHA', {
        x: MARGIN, y, size: 22, font: fontBold, color: COLOR_PRIMARY,
    });
    page.drawText('VOUCHER DE RESERVA', {
        x: MARGIN, y: y - 18, size: 11, font: fontReg, color: COLOR_MUTED,
    });
    y -= 50;

    // Linha divisória
    page.drawLine({
        start: { x: MARGIN, y }, end: { x: A4_W - MARGIN, y },
        thickness: 1, color: COLOR_MUTED,
    });
    y -= 25;

    // Código + QR
    const code = r.id.slice(0, 8).toUpperCase();
    page.drawText('Código:', { x: MARGIN, y, size: 10, font: fontReg, color: COLOR_MUTED });
    page.drawText(code, { x: MARGIN + 50, y, size: 14, font: fontBold, color: COLOR_TEXT });

    // QR
    const qrPng = await QRCode.toBuffer(voucherUrl, { width: 110, margin: 0 });
    const qrImg = await pdf.embedPng(qrPng);
    page.drawImage(qrImg, { x: A4_W - MARGIN - 90, y: y - 70, width: 90, height: 90 });

    y -= 110;

    // Cliente
    drawSectionHeader(page, fontBold, 'CLIENTE', MARGIN, y);
    y -= 18;
    drawKV(page, fontReg, fontBold, 'Nome', c.name || '—', MARGIN, y); y -= 14;
    drawKV(page, fontReg, fontBold, 'WhatsApp', c.whatsapp || '—', MARGIN, y); y -= 14;
    if (c.doc_type) {
        drawKV(page, fontReg, fontBold, 'Documento', `${c.doc_type.toUpperCase()} ${c.doc_number || ''}`, MARGIN, y);
        y -= 14;
    }
    y -= 12;

    // Passeio
    drawSectionHeader(page, fontBold, 'PASSEIO', MARGIN, y);
    y -= 18;
    drawKV(page, fontReg, fontBold, 'Produto', p.name || '—', MARGIN, y); y -= 14;
    drawKV(page, fontReg, fontBold, 'Data', formatDateBR(r.travel_date), MARGIN, y); y -= 14;
    drawKV(page, fontReg, fontBold, 'Horário', r.departure_time || 'A combinar', MARGIN, y); y -= 14;
    const pax = `${r.qty_adults} adulto(s), ${r.qty_children} criança(s), ${r.qty_infants} infant(s)`;
    drawKV(page, fontReg, fontBold, 'Passageiros', pax, MARGIN, y); y -= 14;
    drawKV(page, fontReg, fontBold, 'Embarque', 'Píer principal, Morro de São Paulo (portão azul)', MARGIN, y);
    y -= 26;

    // Valores box
    drawBox(page, MARGIN, y - 70, A4_W - 2 * MARGIN, 70);
    page.drawText('VALORES', {
        x: MARGIN + 10, y: y - 14, size: 9, font: fontBold, color: COLOR_MUTED,
    });
    drawKV(page, fontReg, fontBold, 'Sinal pago', `R$ ${money(r.amount_deposit)}`, MARGIN + 10, y - 32);
    drawKV(page, fontReg, fontBold, 'Restante (pagar no embarque)', `R$ ${money(r.amount_remaining)}`, MARGIN + 10, y - 48);
    drawKV(page, fontReg, fontBold, 'Total', `R$ ${money(r.amount_total)}`, MARGIN + 10, y - 64);
    y -= 90;

    // Regras destaque
    drawSectionHeader(page, fontBold, 'REGRAS IMPORTANTES', MARGIN, y);
    y -= 18;
    const rules = [
        '• A responsabilidade de conferir data, horário e assentos é do cliente.',
        '• Responda OK no WhatsApp para confirmar o recebimento deste voucher.',
        '• TUPA e taxas ambientais de Morro de São Paulo NÃO estão incluídas.',
        '• Cancelamento: > 48h reembolso integral; 24-48h reembolso 50%; < 24h reter 100%.',
        '• Força maior (porto/clima): reembolso integral ou reagendamento sem custo.',
        '• Operações executadas por fornecedores parceiros terceirizados.',
    ];
    for (const line of rules) {
        page.drawText(line, { x: MARGIN, y, size: 9, font: fontReg, color: COLOR_TEXT });
        y -= 13;
    }
    y -= 18;

    // Footer
    drawLine(page, MARGIN, y, A4_W - MARGIN);
    y -= 16;
    page.drawText('Volta à Ilha — CNPJ 13.510.711/0001-58', {
        x: MARGIN, y, size: 8, font: fontReg, color: COLOR_MUTED,
    });
    page.drawText('voltaailha.com.br · WhatsApp +55 75 99824-0043', {
        x: MARGIN, y: y - 11, size: 8, font: fontReg, color: COLOR_MUTED,
    });
    page.drawText(`Voucher v1 · ${new Date().toISOString().slice(0, 10)} · cart ${r.cart_id?.slice(0, 8)}`, {
        x: A4_W - MARGIN - 200, y: y - 11, size: 7, font: fontReg, color: COLOR_MUTED,
    });

    return await pdf.save();
}

function drawSectionHeader(page, font, text, x, y) {
    page.drawText(text, { x, y, size: 9, font, color: COLOR_MUTED });
}
function drawKV(page, fontReg, fontBold, label, value, x, y) {
    page.drawText(`${label}:`, { x, y, size: 10, font: fontReg, color: COLOR_MUTED });
    page.drawText(String(value), { x: x + 110, y, size: 10, font: fontBold, color: COLOR_TEXT });
}
function drawBox(page, x, y, w, h) {
    page.drawRectangle({ x, y, width: w, height: h, color: COLOR_BG_BOX, borderWidth: 0 });
}
function drawLine(page, x1, y, x2) {
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color: COLOR_MUTED });
}
function money(n) {
    return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDateBR(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
