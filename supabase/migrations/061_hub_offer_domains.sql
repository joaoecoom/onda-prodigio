-- Domínios por oferta: funil público vs plataforma HUB

ALTER TABLE hub_offers
    ADD COLUMN IF NOT EXISTS funnel_domain TEXT,
    ADD COLUMN IF NOT EXISTS hub_domain TEXT;

UPDATE hub_offers
SET
    funnel_domain = 'onda-prodigio.vercel.app',
    hub_domain = 'hub.dr.ecoom.pt',
    site_url = COALESCE(NULLIF(site_url, ''), 'https://onda-prodigio.vercel.app'),
    funnel_url = COALESCE(NULLIF(funnel_url, ''), 'https://onda-prodigio.vercel.app')
WHERE id = 'onda-prodigio';

CREATE TABLE IF NOT EXISTS hub_offer_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    domain_type TEXT NOT NULL CHECK (domain_type IN ('funnel', 'hub')),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (offer_id, domain, domain_type)
);

CREATE INDEX IF NOT EXISTS idx_hub_offer_domains_offer
    ON hub_offer_domains (offer_id, domain_type, is_primary DESC);

INSERT INTO hub_offer_domains (offer_id, domain, domain_type, is_primary)
VALUES
    ('onda-prodigio', 'onda-prodigio.vercel.app', 'funnel', true),
    ('onda-prodigio', 'hub.dr.ecoom.pt', 'hub', true)
ON CONFLICT (offer_id, domain, domain_type) DO NOTHING;

ALTER TABLE hub_offer_domains ENABLE ROW LEVEL SECURITY;
