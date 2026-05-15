-- Audit log genérico para ações admin (products, settings, etc.)
-- Reservation-specific já em reservation_audit_log.

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID NOT NULL,
    actor_email TEXT,
    entity      TEXT NOT NULL,        -- 'product', 'setting', etc.
    entity_id   UUID,
    action      TEXT NOT NULL,        -- 'create', 'update', 'soft_delete', 'accordions_update', 'child_policy_update'
    before_data JSONB,
    patch_data  JSONB,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON admin_audit_log(entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log(actor_id, created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
