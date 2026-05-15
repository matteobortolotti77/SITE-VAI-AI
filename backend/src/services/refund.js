// Política de cancelamento (CLAUDE.md §5.3) — autoritativa server-side.
// Calcula refund_amount baseado em transição de status + horas até travel_date.
import { config } from '../config.js';

/**
 * Calcula valor de refund baseado em transição de status + antecedência.
 * @param {object} reservation — linha de reservations (pelo menos amount_deposit, travel_date, status)
 * @param {string} toStatus — status alvo
 * @returns {{ refund_amount: number, policy: string }}
 */
export function calculateRefund(reservation, toStatus) {
    const deposit = Number(reservation.amount_deposit) || 0;

    // Sem refund se não havia pagamento confirmado.
    const wasPaid = reservation.status === 'deposit_paid' || reservation.status === 'fully_paid';
    if (!wasPaid) return { refund_amount: 0, policy: 'no_payment_yet' };

    // Força maior — sempre 100%.
    if (toStatus === 'cancelled_force_majeure') {
        return { refund_amount: deposit, policy: 'force_majeure_full' };
    }

    // Reagendamento — sem refund (cliente troca data).
    if (toStatus === 'rescheduled') {
        return { refund_amount: 0, policy: 'rescheduled_no_refund' };
    }

    // No-show — política em cascata por antecedência.
    if (toStatus === 'cancelled_noshow') {
        const hoursUntil = hoursUntilTravel(reservation.travel_date);
        if (hoursUntil > 48) return { refund_amount: deposit, policy: 'cancelled_gt_48h_full' };
        if (hoursUntil >= 24) return { refund_amount: round2(deposit * 0.5), policy: 'cancelled_24_48h_half' };
        return { refund_amount: 0, policy: 'cancelled_lt_24h_noshow' };
    }

    return { refund_amount: 0, policy: 'no_refund_default' };
}

/**
 * Transições válidas (máquina de estados §6.6).
 * Permite somente movimentos coerentes; impede regressões inválidas.
 */
const ALLOWED_TRANSITIONS = {
    pending_payment: ['deposit_paid', 'cancelled_noshow', 'cancelled_force_majeure'],
    deposit_paid: ['fully_paid', 'cancelled_noshow', 'cancelled_force_majeure', 'rescheduled'],
    fully_paid: ['cancelled_noshow', 'cancelled_force_majeure', 'rescheduled'],
    cancelled_noshow: [],
    cancelled_force_majeure: [],
    rescheduled: ['deposit_paid', 'fully_paid', 'cancelled_force_majeure'],
};

export function isValidTransition(fromStatus, toStatus) {
    if (fromStatus === toStatus) return false;
    return (ALLOWED_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

function hoursUntilTravel(travelDateStr) {
    // travel_date é DATE (YYYY-MM-DD) — assume embarque às 00:00 America/Bahia.
    // Conservador: usa 00:00 (favorece refund maior se cliente cancela perto da meia-noite).
    const travel = new Date(`${travelDateStr}T00:00:00-03:00`);
    const diffMs = travel.getTime() - Date.now();
    return diffMs / (1000 * 60 * 60);
}

function round2(n) {
    return Math.round(n * 100) / 100;
}
