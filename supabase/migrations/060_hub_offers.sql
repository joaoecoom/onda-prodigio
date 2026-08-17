-- HUB DR Ecoom — ofertas multi-tenant (schema plataforma)

CREATE TABLE IF NOT EXISTS hub_offers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
    primary_product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    site_url TEXT,
    funnel_url TEXT,
    branding JSONB NOT NULL DEFAULT '{}'::jsonb,
    mode TEXT NOT NULL DEFAULT 'live' CHECK (mode IN ('live', 'test')),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_offers_status_sort
    ON hub_offers (status, sort_order, name);

CREATE TABLE IF NOT EXISTS hub_offer_meta_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    is_default BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (offer_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_hub_offer_meta_accounts_offer
    ON hub_offer_meta_accounts (offer_id, sort_order);

CREATE TABLE IF NOT EXISTS hub_offer_checkouts (
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    checkout_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    path TEXT NOT NULL,
    test_path TEXT,
    amount_cents INT,
    stripe_price_id TEXT,
    stripe_test_price_id TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (offer_id, checkout_id)
);

CREATE INDEX IF NOT EXISTS idx_hub_offer_checkouts_offer
    ON hub_offer_checkouts (offer_id, sort_order);

CREATE TABLE IF NOT EXISTS hub_offer_integrations (
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    integration_key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    is_secret BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (offer_id, integration_key)
);

CREATE TABLE IF NOT EXISTS hub_event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id TEXT REFERENCES hub_offers(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'hub',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_event_log_offer_created
    ON hub_event_log (offer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hub_event_log_type_created
    ON hub_event_log (event_type, created_at DESC);

ALTER TABLE hub_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_offer_meta_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_offer_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_offer_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_event_log ENABLE ROW LEVEL SECURITY;

-- Seed: Onda Prodígio (1ª oferta — espelha config actual em env)
INSERT INTO hub_offers (
    id,
    name,
    slug,
    status,
    primary_product_id,
    site_url,
    funnel_url,
    branding,
    mode,
    sort_order
) VALUES (
    'onda-prodigio',
    'Onda Prodígio',
    'onda-prodigio',
    'active',
    'onda-prodigio',
    'https://onda-prodigio.vercel.app',
    'https://onda-prodigio.vercel.app',
    '{"from_name":"Angela Campos — Onda Prodígio","accent":"#6366f1"}'::jsonb,
    'live',
    1
) ON CONFLICT (id) DO NOTHING;

INSERT INTO hub_offer_meta_accounts (offer_id, account_id, label, is_default, sort_order)
VALUES ('onda-prodigio', '1078209721038923', 'Onda Prodígio', true, 1)
ON CONFLICT (offer_id, account_id) DO NOTHING;

INSERT INTO hub_offer_checkouts (offer_id, checkout_id, label, path, test_path, sort_order)
VALUES
    ('onda-prodigio', 'checkout9', '€9', '/checkout9/', '/checkout9-test/', 1),
    ('onda-prodigio', 'checkout19', '€19', '/checkout19/', NULL, 2)
ON CONFLICT (offer_id, checkout_id) DO NOTHING;
