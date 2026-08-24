-- Checkout UI templates per offer (HTML/CSS edited by Gemini, served at runtime)

CREATE TABLE IF NOT EXISTS hub_offer_checkout_templates (
    offer_id text PRIMARY KEY REFERENCES hub_offers(id) ON DELETE CASCADE,
    html_top text NOT NULL DEFAULT '',
    html_bottom text NOT NULL DEFAULT '',
    custom_css text NOT NULL DEFAULT '',
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hub_offer_checkout_templates_updated_idx
    ON hub_offer_checkout_templates(updated_at DESC);
