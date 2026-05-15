-- Phase 2 admin panel: audit log, idempotency, notification retries, customer ack

-- 1) notifications.retry_count (CLAUDE.md §5.6)
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;

-- 2) reservations.customer_ack_at (CLAUDE.md §5.6)
ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS customer_ack_at TIMESTAMPTZ;

-- 3) reservation_audit_log — audit trail dedicado (não append em notes)
CREATE TABLE IF NOT EXISTS reservation_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    actor_id        UUID NOT NULL,
    actor_email     TEXT,
    action          TEXT NOT NULL,
    from_status     reservation_status,
    to_status       reservation_status,
    reason          TEXT,
    refund_amount   NUMERIC(10,2),
    refund_gateway_id TEXT,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_reservation ON reservation_audit_log(reservation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON reservation_audit_log(actor_id, created_at DESC);

ALTER TABLE reservation_audit_log ENABLE ROW LEVEL SECURITY;

-- 4) idempotency_keys — para PATCH /admin/reservations/:id/status
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key             TEXT PRIMARY KEY,
    actor_id        UUID NOT NULL,
    endpoint        TEXT NOT NULL,
    request_hash    TEXT NOT NULL,
    response_status INT NOT NULL,
    response_body   JSONB NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- 5) Helper para SELECT FOR UPDATE em transição de status (Postgres function)
-- Postgres-RPC chamável por service_role. Faz lock + retorna estado atual.
CREATE OR REPLACE FUNCTION lock_reservation(p_id UUID)
RETURNS reservations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE r reservations;
BEGIN
    SELECT * INTO r FROM reservations WHERE id = p_id FOR UPDATE;
    RETURN r;
END;
$$;
