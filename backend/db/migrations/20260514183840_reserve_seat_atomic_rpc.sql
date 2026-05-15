-- Substituí abordagem: função faz lock + check + insert atomic numa só transação.
-- Retorna reservation_id em sucesso, NULL + seats_left em falha.

DROP FUNCTION IF EXISTS try_reserve_seats(UUID, DATE, TEXT, INT);

CREATE OR REPLACE FUNCTION reserve_seat_atomic(
    p_cart_id UUID,
    p_customer_id UUID,
    p_product_id UUID,
    p_provider_id UUID,
    p_commission_amount NUMERIC,
    p_travel_date DATE,
    p_departure_time TEXT,
    p_qty_adults INT,
    p_qty_children INT,
    p_qty_infants INT,
    p_amount_deposit NUMERIC,
    p_amount_remaining NUMERIC,
    p_amount_total NUMERIC,
    p_gateway TEXT
)
RETURNS TABLE(reservation_id UUID, ok BOOLEAN, seats_left INT, seats_needed INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock_key BIGINT;
    v_capacity INT;
    v_pricing_mode TEXT;
    v_used INT;
    v_left INT;
    v_needed INT;
    v_new_id UUID;
BEGIN
    v_lock_key := abs(hashtextextended(p_product_id::text || ':' || p_travel_date::text || ':' || p_departure_time, 0));
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT capacity, pricing_mode INTO v_capacity, v_pricing_mode
    FROM products WHERE id = p_product_id;

    IF v_capacity IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, false, 0, 0;
        RETURN;
    END IF;

    v_needed := CASE WHEN v_pricing_mode = 'per_vehicle' THEN 1 ELSE p_qty_adults + p_qty_children END;

    SELECT COALESCE(SUM(
        CASE WHEN v_pricing_mode = 'per_vehicle' THEN 1
             ELSE qty_adults + qty_children END
    ), 0)::INT INTO v_used
    FROM reservations
    WHERE product_id = p_product_id
      AND travel_date = p_travel_date
      AND departure_time = p_departure_time
      AND status IN ('pending_payment', 'deposit_paid', 'fully_paid');

    v_left := v_capacity - v_used;

    IF v_left < v_needed THEN
        RETURN QUERY SELECT NULL::UUID, false, v_left, v_needed;
        RETURN;
    END IF;

    INSERT INTO reservations (
        cart_id, customer_id, product_id, provider_id, commission_amount,
        travel_date, departure_time,
        qty_adults, qty_children, qty_infants,
        amount_deposit, amount_remaining, amount_total,
        status, gateway
    ) VALUES (
        p_cart_id, p_customer_id, p_product_id, p_provider_id, p_commission_amount,
        p_travel_date, p_departure_time,
        p_qty_adults, p_qty_children, p_qty_infants,
        p_amount_deposit, p_amount_remaining, p_amount_total,
        'pending_payment', p_gateway
    ) RETURNING id INTO v_new_id;

    RETURN QUERY SELECT v_new_id, true, v_left - v_needed, v_needed;
END;
$$;
