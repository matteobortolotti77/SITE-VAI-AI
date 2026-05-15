-- Task #3: idempotência webhook (UNIQUE em gateway+gateway_id)
-- Task #5: separar gateway_preference_id de gateway_payment_id

-- Backfill: copia valores atuais (que misturam preference_id e payment_id) para nova coluna
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS gateway_preference_id TEXT;

-- Copia valor atual para preference_id (status pending_payment = ainda preference; demais = payment)
UPDATE reservations
SET gateway_preference_id = gateway_payment_id
WHERE status = 'pending_payment' AND gateway_preference_id IS NULL;

-- Em pending_payment, gateway_payment_id era preference_id. Limpa para evitar confusão.
UPDATE reservations
SET gateway_payment_id = NULL
WHERE status = 'pending_payment';

-- UNIQUE constraint payments.(gateway, gateway_id). Drop existing duplicates first se houver.
DELETE FROM payments a USING payments b
WHERE a.id > b.id
  AND a.gateway = b.gateway
  AND a.gateway_id = b.gateway_id;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS uq_payments_gateway_id;
ALTER TABLE payments ADD CONSTRAINT uq_payments_gateway_id UNIQUE (gateway, gateway_id);

CREATE INDEX IF NOT EXISTS idx_payments_gateway_id ON payments(gateway, gateway_id);
