-- Persistent retry queue para post-payment pipeline.
-- 3 tentativas (0/30s/5min) conforme CLAUDE.md §5.6.

CREATE TABLE IF NOT EXISTS notification_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind            TEXT NOT NULL,           -- 'voucher_email', 'voucher_whatsapp', 'send_daily_supplier'
    payload         JSONB NOT NULL,          -- inputs para o handler
    reservation_id  UUID REFERENCES reservations(id) ON DELETE SET NULL,
    attempts        INT NOT NULL DEFAULT 0,
    max_attempts    INT NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'done' | 'failed'
    last_error      TEXT,
    locked_at       TIMESTAMPTZ,
    locked_by       TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_njobs_pending ON notification_jobs(status, next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_njobs_reservation ON notification_jobs(reservation_id);

ALTER TABLE notification_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION set_njobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_njobs_updated ON notification_jobs;
CREATE TRIGGER trg_njobs_updated BEFORE UPDATE ON notification_jobs
    FOR EACH ROW EXECUTE FUNCTION set_njobs_updated_at();

-- RPC para claim atomic com lock (evita 2 workers pegarem mesmo job)
CREATE OR REPLACE FUNCTION claim_notification_jobs(p_worker TEXT, p_limit INT DEFAULT 10)
RETURNS SETOF notification_jobs
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    UPDATE notification_jobs
    SET locked_at = now(), locked_by = p_worker, attempts = attempts + 1
    WHERE id IN (
        SELECT id FROM notification_jobs
        WHERE status = 'pending' AND next_attempt_at <= now()
          AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
        ORDER BY next_attempt_at
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$;
