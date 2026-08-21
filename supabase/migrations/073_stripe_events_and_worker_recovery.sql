-- Bloco E: webhook idempotency + worker stale recovery

CREATE TABLE IF NOT EXISTS hub_stripe_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    offer_id TEXT,
    payment_intent_id TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_stripe_events_payment_intent
    ON hub_stripe_events (payment_intent_id);

ALTER TABLE hub_stripe_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION recover_stale_ai_tasks(p_timeout_minutes INT DEFAULT 45)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    affected INT;
BEGIN
    UPDATE ai_tasks
    SET
        status = 'failed',
        failed_at = now(),
        updated_at = now(),
        error = COALESCE(error, '') || ' [recovered: worker timeout after ' || p_timeout_minutes || 'm]'
    WHERE status = 'running'
      AND started_at IS NOT NULL
      AND started_at < now() - make_interval(mins => GREATEST(p_timeout_minutes, 5));

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$;

COMMENT ON TABLE hub_stripe_events IS 'Idempotência de eventos Stripe webhook';
COMMENT ON FUNCTION recover_stale_ai_tasks IS 'Marca tasks running stale como failed';
