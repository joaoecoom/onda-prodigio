-- Universal checkout order bumps (per offer)

CREATE TABLE IF NOT EXISTS hub_offer_order_bumps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    bump_id TEXT NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    amount_cents INT NOT NULL CHECK (amount_cents >= 50),
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (offer_id, bump_id)
);

CREATE INDEX IF NOT EXISTS idx_hub_offer_order_bumps_offer
    ON hub_offer_order_bumps (offer_id, sort_order);

ALTER TABLE hub_offer_order_bumps ENABLE ROW LEVEL SECURITY;
