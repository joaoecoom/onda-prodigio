-- Telefone do membro + log de WhatsApp transaccional

ALTER TABLE members
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS phone_country TEXT;

CREATE TABLE IF NOT EXISTS whatsapp_message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id TEXT NOT NULL UNIQUE,
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    message_type TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_log_member ON whatsapp_message_log(member_id);

ALTER TABLE whatsapp_message_log ENABLE ROW LEVEL SECURITY;
