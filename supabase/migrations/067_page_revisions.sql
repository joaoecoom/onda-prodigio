-- HUB DR Ecoom — Fase 5C: Page revision history (snapshots)

CREATE TABLE IF NOT EXISTS page_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    revision_number INT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'publish', 'restore')),
    label TEXT NOT NULL DEFAULT '',
    tree JSONB NOT NULL,
    page_status TEXT NOT NULL DEFAULT 'draft'
        CHECK (page_status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (page_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_page_revisions_page_created
    ON page_revisions (page_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_revisions_offer
    ON page_revisions (offer_id);

ALTER TABLE page_revisions ENABLE ROW LEVEL SECURITY;
