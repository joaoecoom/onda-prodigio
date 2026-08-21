-- HUB DR Ecoom — Fase 3A: Funnel Engine + Page Engine (data model)

CREATE TABLE IF NOT EXISTS funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'custom'
        CHECK (type IN ('vsl', 'quiz', 'advertorial', 'webinar', 'lead', 'custom')),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'archived')),
    is_default BOOLEAN NOT NULL DEFAULT false,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (offer_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_funnels_offer_status
    ON funnels (offer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_funnels_offer_default
    ON funnels (offer_id, is_default)
    WHERE is_default = true;

CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'custom'
        CHECK (type IN (
            'sales', 'vsl', 'landing', 'advertorial', 'checkout',
            'upsell', 'downsell', 'thank_you', 'webinar', 'custom'
        )),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    sort_order INT NOT NULL DEFAULT 100,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    seo JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    UNIQUE (funnel_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pages_funnel_sort
    ON pages (funnel_id, sort_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_pages_offer_status
    ON pages (offer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pages_funnel_status
    ON pages (funnel_id, status);

CREATE TABLE IF NOT EXISTS page_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'custom',
    sort_order INT NOT NULL DEFAULT 100,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    styles JSONB NOT NULL DEFAULT '{}'::jsonb,
    visibility JSONB NOT NULL DEFAULT '{"desktop":true,"tablet":true,"mobile":true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_sections_page_sort
    ON page_sections (page_id, sort_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_page_sections_offer
    ON page_sections (offer_id);

CREATE TABLE IF NOT EXISTS page_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES page_sections(id) ON DELETE CASCADE,
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    type TEXT NOT NULL
        CHECK (type IN ('text', 'heading', 'image', 'video', 'button', 'spacer', 'html')),
    sort_order INT NOT NULL DEFAULT 100,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    styles JSONB NOT NULL DEFAULT '{}'::jsonb,
    visibility JSONB NOT NULL DEFAULT '{"desktop":true,"tablet":true,"mobile":true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_blocks_section_sort
    ON page_blocks (section_id, sort_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_page_blocks_page
    ON page_blocks (page_id);

CREATE INDEX IF NOT EXISTS idx_page_blocks_offer
    ON page_blocks (offer_id);

ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_blocks ENABLE ROW LEVEL SECURITY;

-- Integrity: page.offer_id must match funnel.offer_id (insert/update)
CREATE OR REPLACE FUNCTION funnel_engine_enforce_page_offer_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    funnel_offer_id TEXT;
BEGIN
    SELECT offer_id INTO funnel_offer_id FROM funnels WHERE id = NEW.funnel_id;

    IF funnel_offer_id IS NULL THEN
        RAISE EXCEPTION 'Funnel not found for page';
    END IF;

    IF NEW.offer_id IS DISTINCT FROM funnel_offer_id THEN
        RAISE EXCEPTION 'page.offer_id must match funnel.offer_id';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pages_offer_match ON pages;
CREATE TRIGGER trg_pages_offer_match
    BEFORE INSERT OR UPDATE OF funnel_id, offer_id ON pages
    FOR EACH ROW EXECUTE FUNCTION funnel_engine_enforce_page_offer_match();

-- Integrity: section.offer_id must match page.offer_id
CREATE OR REPLACE FUNCTION funnel_engine_enforce_section_offer_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    page_offer_id TEXT;
BEGIN
    SELECT offer_id INTO page_offer_id FROM pages WHERE id = NEW.page_id;

    IF page_offer_id IS NULL THEN
        RAISE EXCEPTION 'Page not found for section';
    END IF;

    IF NEW.offer_id IS DISTINCT FROM page_offer_id THEN
        RAISE EXCEPTION 'section.offer_id must match page.offer_id';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_page_sections_offer_match ON page_sections;
CREATE TRIGGER trg_page_sections_offer_match
    BEFORE INSERT OR UPDATE OF page_id, offer_id ON page_sections
    FOR EACH ROW EXECUTE FUNCTION funnel_engine_enforce_section_offer_match();

-- Integrity: block.offer_id/page_id must match section ancestry
CREATE OR REPLACE FUNCTION funnel_engine_enforce_block_offer_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    section_page_id UUID;
    section_offer_id TEXT;
BEGIN
    SELECT page_id, offer_id INTO section_page_id, section_offer_id
    FROM page_sections WHERE id = NEW.section_id;

    IF section_page_id IS NULL THEN
        RAISE EXCEPTION 'Section not found for block';
    END IF;

    IF NEW.page_id IS DISTINCT FROM section_page_id THEN
        RAISE EXCEPTION 'block.page_id must match section.page_id';
    END IF;

    IF NEW.offer_id IS DISTINCT FROM section_offer_id THEN
        RAISE EXCEPTION 'block.offer_id must match section.offer_id';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_page_blocks_offer_match ON page_blocks;
CREATE TRIGGER trg_page_blocks_offer_match
    BEFORE INSERT OR UPDATE OF section_id, page_id, offer_id ON page_blocks
    FOR EACH ROW EXECUTE FUNCTION funnel_engine_enforce_block_offer_match();

COMMENT ON TABLE funnels IS 'Fase 3A — funnels pertencem a uma offer (hub_offers)';
COMMENT ON TABLE pages IS 'Fase 3A — páginas pertencem a um funnel; draft/published';
COMMENT ON TABLE page_sections IS 'Fase 3A — secções ordenadas dentro de uma page';
COMMENT ON TABLE page_blocks IS 'Fase 3A — blocos estruturados dentro de uma section';

-- Fixture: AI Test Offer (Fase 3A proof) — idempotente
DO $$
DECLARE
    v_offer_id TEXT := 'ai-test-offer';
    v_funnel_id UUID;
    v_page_id UUID;
    v_hero_id UUID;
    v_benefits_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM hub_offers WHERE id = v_offer_id) THEN
        RETURN;
    END IF;

    SELECT id INTO v_funnel_id
    FROM funnels
    WHERE offer_id = v_offer_id AND slug = 'ai-test-sales-funnel'
    LIMIT 1;

    IF v_funnel_id IS NULL THEN
        INSERT INTO funnels (offer_id, name, slug, description, type, status, is_default, settings)
        VALUES (
            v_offer_id,
            'AI Test Sales Funnel',
            'ai-test-sales-funnel',
            'Fixture Fase 3A — prova do modelo Offer → Funnel → Page → Section → Block',
            'custom',
            'draft',
            true,
            '{"legacy_coexistence":true}'::jsonb
        )
        RETURNING id INTO v_funnel_id;
    END IF;

    SELECT id INTO v_page_id
    FROM pages
    WHERE funnel_id = v_funnel_id AND slug = 'ai-test-sales-page'
    LIMIT 1;

    IF v_page_id IS NULL THEN
        INSERT INTO pages (funnel_id, offer_id, name, slug, type, status, sort_order, settings, seo)
        VALUES (
            v_funnel_id,
            v_offer_id,
            'AI Test Sales Page',
            'ai-test-sales-page',
            'sales',
            'draft',
            100,
            '{"maxWidth":"960px","background":"#ffffff"}'::jsonb,
            '{"title":"AI Test Sales Page"}'::jsonb
        )
        RETURNING id INTO v_page_id;
    END IF;

    SELECT id INTO v_hero_id
    FROM page_sections
    WHERE page_id = v_page_id AND type = 'hero'
    LIMIT 1;

    IF v_hero_id IS NULL THEN
        INSERT INTO page_sections (page_id, offer_id, type, sort_order, settings)
        VALUES (v_page_id, v_offer_id, 'hero', 100, '{"label":"Hero"}'::jsonb)
        RETURNING id INTO v_hero_id;

        INSERT INTO page_blocks (section_id, page_id, offer_id, type, sort_order, content, settings)
        VALUES
            (v_hero_id, v_page_id, v_offer_id, 'heading', 100,
                '{"text":"AI Test Offer — Hero Heading"}'::jsonb,
                '{"level":1,"alignment":"center"}'::jsonb),
            (v_hero_id, v_page_id, v_offer_id, 'text', 200,
                '{"text":"Esta página pertence apenas à AI Test Offer."}'::jsonb,
                '{"alignment":"center"}'::jsonb),
            (v_hero_id, v_page_id, v_offer_id, 'button', 300,
                '{"label":"Call to Action"}'::jsonb,
                '{"href":"#","variant":"primary"}'::jsonb);
    END IF;

    SELECT id INTO v_benefits_id
    FROM page_sections
    WHERE page_id = v_page_id AND type = 'benefits'
    LIMIT 1;

    IF v_benefits_id IS NULL THEN
        INSERT INTO page_sections (page_id, offer_id, type, sort_order, settings)
        VALUES (v_page_id, v_offer_id, 'benefits', 200, '{"label":"Benefits"}'::jsonb)
        RETURNING id INTO v_benefits_id;

        INSERT INTO page_blocks (section_id, page_id, offer_id, type, sort_order, content)
        VALUES
            (v_benefits_id, v_page_id, v_offer_id, 'heading', 100,
                '{"text":"Benefits"}'::jsonb),
            (v_benefits_id, v_page_id, v_offer_id, 'text', 200,
                '{"text":"Structured block content for future renderer."}'::jsonb);
    END IF;
END $$;
