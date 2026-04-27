// Validação D-0 (corte de embarque do mesmo dia) — server-side
// Conforme PROMPT_BACKEND_2.md "Validação de Corte D-0"

/**
 * Retorna true se a reserva deve ser bloqueada por estar muito perto do embarque.
 * @param {object} product — { cutoff_hour, cutoff_minute }
 * @param {string} travelDate — 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function isUrgent(product, travelDate) {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bahia' }));
    const todayBahia = now.toISOString().split('T')[0];
    if (travelDate !== todayBahia) return false;

    const cutoffMin = (product.cutoff_hour ?? 8) * 60 + (product.cutoff_minute ?? 30);
    const currentMin = now.getHours() * 60 + now.getMinutes();
    return currentMin >= cutoffMin;
}
