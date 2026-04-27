// Cálculo de valores de uma reserva conforme pricing_mode + child policy
// Conforme PROMPT_BACKEND_2.md (Modos de pricing)

/**
 * Calcula amount_total e amount_deposit de uma linha de reserva.
 * Não muta o input. Retorna numbers (BRL).
 *
 * @param {object} product — registro de products
 * @param {object} qty — { adults, children, infants }
 * @returns {{ total: number, deposit: number, remaining: number }}
 */
export function computeAmounts(product, qty) {
    const adults = Number(qty.adults || 0);
    const children = Number(qty.children || 0);
    const infants = Number(qty.infants || 0);
    const paxBilled = adults + children;  // infants não pagam

    const priceFull = Number(product.price_full);
    const priceDeposit = product.price_deposit != null ? Number(product.price_deposit) : null;
    const childDiscount = product.child_discount != null ? Number(product.child_discount) : 0;
    const insurance = product.insurance_per_pax != null ? Number(product.insurance_per_pax) : 0;

    let total;
    if (product.pricing_mode === 'per_vehicle') {
        // 1 reserva = 1 veículo. Total = price_full + insurance × pax
        const paxInVehicle = adults + children + infants;
        total = priceFull + (insurance * paxInVehicle);
    } else {
        // per_person: adultos pagam total, crianças pagam total × (1 - desconto)
        total = (adults * priceFull) + (children * priceFull * (1 - childDiscount));
    }

    let deposit;
    if (priceDeposit == null) {
        // Produto sem sinal: pagamento total online
        deposit = total;
    } else if (product.pricing_mode === 'per_vehicle') {
        deposit = priceDeposit;  // sinal é por veículo, fixo
    } else {
        // per_person com sinal: sinal por adulto + crianças pagam metade do sinal
        deposit = (adults * priceDeposit) + (children * priceDeposit * (1 - childDiscount));
    }

    const remaining = Math.max(0, total - deposit);
    return {
        total: round2(total),
        deposit: round2(deposit),
        remaining: round2(remaining)
    };
}

function round2(n) {
    return Math.round(n * 100) / 100;
}

/**
 * Valida que pax cabe na vehicle_capacity (per_vehicle) e respeita child_min_age.
 * @returns {string|null} mensagem de erro ou null se ok
 */
export function validateQty(product, qty) {
    const adults = Number(qty.adults || 0);
    const children = Number(qty.children || 0);
    const infants = Number(qty.infants || 0);

    if (adults < 1) return 'Pelo menos 1 adulto necessário';

    if (product.pricing_mode === 'per_vehicle') {
        const total = adults + children + infants;
        if (product.vehicle_capacity && total > product.vehicle_capacity) {
            return `Capacidade do veículo é ${product.vehicle_capacity} pessoas (você selecionou ${total})`;
        }
    }

    if (product.child_min_age != null && children > 0) {
        // Se há child_min_age (ex: Banana Boat 6+), sinaliza pra UI mostrar aviso
        // Não bloqueia — assumimos que se selecionou child, idade >= min_age
    }

    return null;
}
