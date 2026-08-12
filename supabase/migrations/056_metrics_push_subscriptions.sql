-- Subscrições Web Push para alertas de vendas no dashboard /metricas (PWA iPhone/desktop).

CREATE TABLE IF NOT EXISTS metrics_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL UNIQUE,
    subscription_json JSONB NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS metrics_push_subscriptions_last_seen_idx
    ON metrics_push_subscriptions (last_seen_at DESC);

ALTER TABLE metrics_push_subscriptions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE metrics_push_subscriptions IS
    'Web Push subscriptions for /metricas sale alerts. Access via service role only.';
