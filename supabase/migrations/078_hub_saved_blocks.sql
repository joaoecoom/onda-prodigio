-- Biblioteca reutilizável de blocos, scripts e popups (Construtor inteligente)

CREATE TABLE IF NOT EXISTS hub_saved_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id TEXT REFERENCES hub_offers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'section'
        CHECK (kind IN ('section', 'block', 'script', 'popup', 'page')),
    tags TEXT[] NOT NULL DEFAULT '{}',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    preview_note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_saved_blocks_offer_kind
    ON hub_saved_blocks (offer_id, kind, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_hub_saved_blocks_global
    ON hub_saved_blocks (kind, updated_at DESC)
    WHERE offer_id IS NULL;

ALTER TABLE hub_saved_blocks ENABLE ROW LEVEL SECURITY;
