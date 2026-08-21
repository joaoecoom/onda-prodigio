-- Multi-offer core: products scoped by offer_id

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS offer_id TEXT REFERENCES hub_offers(id) ON DELETE SET NULL;

-- Backfill from hub_offers.primary_product_id
UPDATE products p
SET offer_id = o.id
FROM hub_offers o
WHERE o.primary_product_id = p.id
  AND p.offer_id IS NULL;

-- Legacy catalogue products belong to Onda Prodígio
UPDATE products
SET offer_id = 'onda-prodigio'
WHERE offer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_offer_sort
    ON products (offer_id, sort_order);

COMMENT ON COLUMN products.offer_id IS 'Offer that owns this product; required for multi-offer isolation.';
