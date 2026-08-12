-- Histórico de logins (métricas de horários de acesso) + fila de follow-up WhatsApp

CREATE TABLE IF NOT EXISTS member_login_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT NOT NULL DEFAULT 'comunidade_me'
);

CREATE INDEX IF NOT EXISTS idx_member_login_events_member
    ON member_login_events (member_id, logged_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_login_events_logged_in_at
    ON member_login_events (logged_in_at DESC);

ALTER TABLE member_login_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS never_logged_in_whatsapp_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    purchased_at TIMESTAMPTZ NOT NULL,
    send_after TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    skip_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_never_logged_in_whatsapp_queue_pending
    ON never_logged_in_whatsapp_queue (send_after)
    WHERE status = 'pending';

ALTER TABLE never_logged_in_whatsapp_queue ENABLE ROW LEVEL SECURITY;
