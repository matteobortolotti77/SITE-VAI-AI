// Validação D-0 (corte de embarque do mesmo dia) — server-side
// Conforme CLAUDE.md §5.1 + §11.6 (server-side é fonte de verdade)

// Intl.DateTimeFormat com TZ específico: evita bug de `new Date(toLocaleString())`,
// que interpreta string formatada como local-time do servidor e quebra na conversão
// pra UTC (off-by-one em horário noturno EU/asiático).
const DATE_FMT = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bahia',
    year: 'numeric', month: '2-digit', day: '2-digit'
});
const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bahia',
    hour: '2-digit', minute: '2-digit', hour12: false
});

/**
 * Retorna true se a reserva deve ser bloqueada por estar muito perto do embarque.
 * @param {object} product — { cutoff_hour, cutoff_minute }
 * @param {string} travelDate — 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function isUrgent(product, travelDate) {
    const nowDate = new Date();
    const todayBahia = DATE_FMT.format(nowDate);
    if (travelDate !== todayBahia) return false;

    const [h, m] = TIME_FMT.format(nowDate).split(':').map(Number);
    const cutoffMin = (product.cutoff_hour ?? 8) * 60 + (product.cutoff_minute ?? 30);
    const currentMin = h * 60 + m;
    return currentMin >= cutoffMin;
}
