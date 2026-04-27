-- =========================================================
-- Migration 002 — adiciona cart_id em reservations + tabela passengers
-- Rodar UMA VEZ no SQL Editor do Supabase. Idempotente.
-- =========================================================

-- 1) Coluna cart_id em reservations (agrupa reservas de 1 carrinho)
ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS cart_id UUID;

-- Backfill: cada reserva existente vira seu próprio carrinho
UPDATE reservations SET cart_id = id WHERE cart_id IS NULL;

ALTER TABLE reservations
    ALTER COLUMN cart_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_cart ON reservations(cart_id);

-- 2) Tabela passengers (1 linha por passageiro adulto/criança em cada reserva)
CREATE TABLE IF NOT EXISTS passengers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    doc_type        TEXT NOT NULL CHECK (doc_type IN ('cpf', 'passport')),
    doc_number      TEXT NOT NULL,
    age_group       TEXT NOT NULL CHECK (age_group IN ('adult', 'child')),
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_passengers_reservation ON passengers(reservation_id);

-- 3) RLS
ALTER TABLE passengers ENABLE ROW LEVEL SECURITY;
