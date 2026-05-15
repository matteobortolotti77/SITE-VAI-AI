-- Comissões por fornecedor+produto + snapshot na reserva

CREATE TABLE IF NOT EXISTS provider_products (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id       UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    commission_value  NUMERIC(10,2) NOT NULL DEFAULT 0,
    active            BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    UNIQUE(provider_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_pp_product_active ON provider_products(product_id, active, commission_value DESC);
CREATE INDEX IF NOT EXISTS idx_pp_provider ON provider_products(provider_id);

ALTER TABLE provider_products ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_pp_updated ON provider_products;
CREATE TRIGGER trg_pp_updated BEFORE UPDATE ON provider_products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Snapshot na reserva
ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES providers(id) ON DELETE SET NULL;

ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reservations_provider ON reservations(provider_id);
