-- Actividade de login + idempotência de emails de compra

ALTER TABLE members
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS login_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS purchase_email_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id TEXT NOT NULL UNIQUE,
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    email_type TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_email_log_member ON purchase_email_log(member_id);

ALTER TABLE purchase_email_log ENABLE ROW LEVEL SECURITY;
