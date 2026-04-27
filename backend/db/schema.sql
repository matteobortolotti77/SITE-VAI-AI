-- =========================================================
-- Volta à Ilha — Schema inicial
-- Rodar no SQL Editor do Supabase: cole tudo e clique RUN
-- =========================================================

-- Necessário para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================================
-- TIPOS
-- ==========================================================
DO $$ BEGIN
    CREATE TYPE product_type AS ENUM ('passeio', 'atividade', 'passagem_ida', 'passagem_volta');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE reservation_status AS ENUM (
        'pending_payment',
        'deposit_paid',
        'fully_paid',
        'cancelled_noshow',
        'cancelled_force_majeure',
        'rescheduled'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ==========================================================
-- PROVIDERS (operadoras parceiras)
-- ==========================================================
CREATE TABLE IF NOT EXISTS providers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    whatsapp    TEXT NOT NULL,                -- E.164: +5575XXXXXXXXX
    email       TEXT,
    active      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================
-- PRODUCTS (passeios, atividades, passagens)
-- Schema editável via /admin/products/*
-- ==========================================================
CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     UUID REFERENCES providers(id) ON DELETE SET NULL,
    type            product_type NOT NULL,
    slug            TEXT UNIQUE NOT NULL,         -- ex: 'volta-a-ilha', usado no frontend
    name            TEXT NOT NULL,                -- pt-BR (texto-base)
    description     TEXT,                         -- subtítulo curto

    -- Preço
    price_full        NUMERIC(10,2) NOT NULL,
    price_deposit     NUMERIC(10,2),              -- NULL = paga tudo online
    pricing_mode      TEXT NOT NULL DEFAULT 'per_person'
                      CHECK (pricing_mode IN ('per_person', 'per_vehicle')),
    vehicle_capacity  SMALLINT,                   -- só usado se pricing_mode='per_vehicle' (ex: Buggy=4, Quadriciclo=2)
    insurance_per_pax NUMERIC(10,2),              -- seguro adicional por passageiro (ex: R$ 5 Buggy/Quadriciclo)

    -- Capacidade
    capacity        SMALLINT NOT NULL,            -- vagas (per_person) OU veículos (per_vehicle) por horário/dia
    departure_times TEXT[] NOT NULL DEFAULT '{}', -- ex: {'09:30','14:00'}; vazio = 'A combinar'
    cutoff_hour     SMALLINT DEFAULT 8,           -- D-0: corte hora local (America/Bahia)
    cutoff_minute   SMALLINT DEFAULT 30,

    -- Política infantil ESPECÍFICA por produto
    child_min_age   SMALLINT,                     -- ex: 6 (Banana Boat); NULL = qualquer idade
    child_discount  NUMERIC(4,2),                 -- ex: 0.50; NULL = sem desconto
    infant_max_age  SMALLINT DEFAULT 5,           -- gratuito até essa idade
    requires_cnh    BOOLEAN DEFAULT false,        -- ex: Quadriciclo

    -- Conteúdo editável via painel admin
    accordion_data  JSONB DEFAULT '[]'::jsonb,    -- [{"title":"Roteiro","body_html":"<p>...</p>"}, ...]
    photos          TEXT[] DEFAULT '{}',          -- URLs (Supabase Storage)
    bg_gradient     TEXT,                         -- alternativa a fotos: classe CSS de gradiente

    -- Traduções override (auto se vazio)
    translations    JSONB DEFAULT '{}'::jsonb,    -- {"en":{"name":"...","description":"..."}, ...}

    active          BOOLEAN DEFAULT true,
    sort_order      SMALLINT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_active_sort ON products(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);

-- ==========================================================
-- CUSTOMERS
-- ==========================================================
CREATE TABLE IF NOT EXISTS customers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    email       TEXT,
    whatsapp    TEXT NOT NULL,                    -- E.164
    locale      TEXT DEFAULT 'pt-BR',             -- idioma preferido
    doc_type    TEXT CHECK (doc_type IN ('cpf', 'passport')),
    doc_number  TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_whatsapp ON customers(whatsapp);

-- ==========================================================
-- RESERVATIONS
-- ==========================================================
CREATE TABLE IF NOT EXISTS reservations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id             UUID NOT NULL,                 -- agrupa N reservas em 1 pagamento (Modelo C)
    customer_id         UUID NOT NULL REFERENCES customers(id),
    product_id          UUID NOT NULL REFERENCES products(id),
    travel_date         DATE NOT NULL,
    departure_time      TEXT NOT NULL,
    qty_adults          SMALLINT NOT NULL DEFAULT 1 CHECK (qty_adults >= 0),
    qty_children        SMALLINT NOT NULL DEFAULT 0 CHECK (qty_children >= 0),
    qty_infants         SMALLINT NOT NULL DEFAULT 0 CHECK (qty_infants >= 0),
    amount_deposit      NUMERIC(10,2) NOT NULL,
    amount_remaining    NUMERIC(10,2) NOT NULL,
    amount_total        NUMERIC(10,2) NOT NULL,
    status              reservation_status DEFAULT 'pending_payment',
    gateway             TEXT,                          -- 'mercadopago'
    gateway_payment_id  TEXT,
    voucher_url         TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservations_travel_date ON reservations(travel_date);
CREATE INDEX IF NOT EXISTS idx_reservations_product_date ON reservations(product_id, travel_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_cart ON reservations(cart_id);

-- ==========================================================
-- PASSENGERS — coletados na página /sucesso após pagamento
-- ==========================================================
CREATE TABLE IF NOT EXISTS passengers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    doc_type        TEXT NOT NULL CHECK (doc_type IN ('cpf', 'passport')),
    doc_number      TEXT NOT NULL,
    age_group       TEXT NOT NULL CHECK (age_group IN ('adult', 'child')),  -- infants 0-5 não precisam doc
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_passengers_reservation ON passengers(reservation_id);

-- ==========================================================
-- PAYMENTS (log imutável)
-- ==========================================================
CREATE TABLE IF NOT EXISTS payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID NOT NULL REFERENCES reservations(id),
    gateway         TEXT NOT NULL,
    gateway_id      TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('deposit', 'full', 'refund')),
    amount          NUMERIC(10,2) NOT NULL,
    method          TEXT,                              -- 'pix' | 'credit_card'
    status          TEXT NOT NULL,                     -- approved/pending/rejected/refunded
    gateway_payload JSONB,                             -- raw webhook payload (auditoria)
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments(reservation_id);

-- ==========================================================
-- NOTIFICATIONS (rastreabilidade)
-- ==========================================================
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID REFERENCES reservations(id) ON DELETE SET NULL,
    recipient_type  TEXT CHECK (recipient_type IN ('customer', 'provider', 'admin')),
    channel         TEXT CHECK (channel IN ('whatsapp', 'email')),
    status          TEXT CHECK (status IN ('sent', 'failed', 'pending')),
    message_preview TEXT,
    sent_at         TIMESTAMPTZ,
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================
-- VIEW: vagas disponíveis por produto/data/horário
-- ==========================================================
CREATE OR REPLACE VIEW availability AS
SELECT
    p.id AS product_id,
    p.slug,
    p.name,
    p.pricing_mode,
    p.capacity,
    r.travel_date,
    r.departure_time,
    p.capacity - COALESCE(
        SUM(
            CASE
                WHEN p.pricing_mode = 'per_vehicle' THEN 1
                ELSE r.qty_adults + r.qty_children
            END
        ), 0
    )::SMALLINT AS seats_left
FROM products p
LEFT JOIN reservations r
    ON r.product_id = p.id
   AND r.status IN ('pending_payment', 'deposit_paid', 'fully_paid')
WHERE p.active = true
GROUP BY p.id, p.slug, p.name, p.pricing_mode, p.capacity, r.travel_date, r.departure_time;

-- ==========================================================
-- TRIGGERS — updated_at automático
-- ==========================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_reservations_updated ON reservations;
CREATE TRIGGER trg_reservations_updated BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================
-- ROW LEVEL SECURITY (RLS)
-- Por padrão, anon só lê produtos ativos.
-- Reservations/payments só via service_role (backend).
-- ==========================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE passengers ENABLE ROW LEVEL SECURITY;

-- Anon pode ler produtos ativos (para o catálogo público)
DROP POLICY IF EXISTS "products_public_read" ON products;
CREATE POLICY "products_public_read" ON products
    FOR SELECT USING (active = true);
