-- Bloco D: estado de domínio / Vercel por oferta

ALTER TABLE hub_offer_domains
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_configured',
    ADD COLUMN IF NOT EXISTS vercel_domain_id TEXT,
    ADD COLUMN IF NOT EXISTS dns_records JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status_message TEXT;

CREATE INDEX IF NOT EXISTS idx_hub_offer_domains_status
    ON hub_offer_domains (offer_id, status);
