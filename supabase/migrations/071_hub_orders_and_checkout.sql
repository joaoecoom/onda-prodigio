-- Bloco B: orders + checkout config extensions

ALTER TABLE hub_offer_checkouts
    ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'eur',
    ADD COLUMN IF NOT EXISTS success_path TEXT,
    ADD COLUMN IF NOT EXISTS cancel_path TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE hub_offer_checkouts c
SET product_id = o.primary_product_id
FROM hub_offers o
WHERE c.offer_id = o.id
  AND c.product_id IS NULL
  AND o.primary_product_id IS NOT NULL;

UPDATE hub_offer_checkouts
SET success_path = '/comunidade/'
WHERE checkout_id = 'main' AND (success_path IS NULL OR success_path = '');

CREATE TABLE IF NOT EXISTS hub_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_checkout_session_id TEXT UNIQUE,
    customer_email TEXT NOT NULL,
    amount_cents INT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'eur',
    status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'refunded', 'failed')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_orders_offer_created
    ON hub_orders (offer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hub_orders_product_created
    ON hub_orders (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hub_orders_email
    ON hub_orders (customer_email);

ALTER TABLE hub_orders ENABLE ROW LEVEL SECURITY;
