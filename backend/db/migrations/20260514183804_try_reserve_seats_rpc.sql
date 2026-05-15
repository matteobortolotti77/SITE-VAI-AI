-- RPC atomic: lock advisory por (product_id, date, time) + check availability + retorna seats_left.
-- Frontend: chama antes de insert. Backend: insere reservation no mesmo transaction (cliente Supabase JS faz auto-commit por chamada RPC, então NÃO transação cross-call — usamos advisory lock para serializar).
-- NOTA: substituída por reserve_seat_atomic na migration seguinte (20260514183840).

CREATE OR REPLACE FUNCTION try_reserve_seats(
    p_product_id UUID,
    p_travel_date DATE,
    p_departure_time TEXT,
    p_seats_needed INT
)
RETURNS TABLE(ok BOOLEAN, seats_left INT, lock_key BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock_key BIGINT;
    v_capacity INT;
    v_pricing_mode TEXT;
    v_used INT;
    v_left INT;
BEGIN
    -- Hash determinístico para advisory lock (product_id + date + time)
    v_lock_key := abs(hashtextextended(p_product_id::text || ':' || p_travel_date::text || ':' || p_departure_time, 0));

    -- Bloqueia até obter o lock (transação automática da função).
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT capacity, pricing_mode INTO v_capacity, v_pricing_mode
    FROM products WHERE id = p_product_id;

    IF v_capacity IS NULL THEN
        RETURN QUERY SELECT false, 0, v_lock_key;
        RETURN;
    END IF;

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

    IF v_left < p_seats_needed THEN
        RETURN QUERY SELECT false, v_left, v_lock_key;
    ELSE
        RETURN QUERY SELECT true, v_left - p_seats_needed, v_lock_key;
    END IF;
END;
$$;
