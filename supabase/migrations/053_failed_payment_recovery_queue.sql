-- Fila de WhatsApp para recuperação de pagamentos falhados (delay 45s + campanha retroactiva)

CREATE TABLE IF NOT EXISTS failed_payment_recovery_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id TEXT NOT NULL UNIQUE,
    email TEXT,
    phone TEXT NOT NULL,
    phone_country TEXT NOT NULL DEFAULT 'PT',
    full_name TEXT,
    send_after TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    skip_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_failed_payment_recovery_queue_pending
    ON failed_payment_recovery_queue (send_after)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_failed_payment_recovery_queue_email_pending
    ON failed_payment_recovery_queue (lower(email))
    WHERE status = 'pending' AND email IS NOT NULL AND email <> '';

ALTER TABLE failed_payment_recovery_queue ENABLE ROW LEVEL SECURITY;
