-- HUB DR Ecoom — Circuito mínimo: Onda Prodígio no Page Engine + fix dados corruptos

DO $$
DECLARE
    v_offer_id TEXT := 'onda-prodigio';
    v_funnel_id UUID;
    v_page_id UUID;
    v_hero_id UUID;
    v_benefits_id UUID;
    v_cta_id UUID;
BEGIN
    SELECT id INTO v_funnel_id
    FROM funnels
    WHERE offer_id = v_offer_id AND slug = 'onda-principal'
    LIMIT 1;

    IF v_funnel_id IS NULL THEN
        INSERT INTO funnels (offer_id, name, slug, description, type, status, is_default, settings)
        VALUES (
            v_offer_id,
            'Onda Principal',
            'onda-principal',
            'Funil principal Onda Prodígio — Page Engine',
            'vsl',
            'active',
            true,
            '{"legacy_funnel_path":"/funnel/"}'::jsonb
        )
        RETURNING id INTO v_funnel_id;
    END IF;

    SELECT id INTO v_page_id
    FROM pages
    WHERE funnel_id = v_funnel_id AND slug = 'vsl-sales'
    LIMIT 1;

    IF v_page_id IS NULL THEN
        INSERT INTO pages (funnel_id, offer_id, name, slug, type, status, sort_order, settings, seo)
        VALUES (
            v_funnel_id,
            v_offer_id,
            'VSL Sales Page',
            'vsl-sales',
            'vsl',
            'draft',
            100,
            '{"legacy_redirect":"/funnel/"}'::jsonb,
            '{"title":"Onda Prodígio — Desperta o Génio do Teu Filho"}'::jsonb
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
                '{"text":"De Estudante Zombie a Criança Prodígio"}'::jsonb,
                '{"level":1,"alignment":"center"}'::jsonb),
            (v_hero_id, v_page_id, v_offer_id, 'text', 200,
                '{"text":"Aprende a reparar o cérebro do teu filho para que ele aprenda 200 vezes mais rápido e deixe de sofrer na aprendizagem."}'::jsonb,
                '{"alignment":"center"}'::jsonb),
            (v_hero_id, v_page_id, v_offer_id, 'button', 300,
                '{"label":"Ver apresentação completa","href":"/funnel/"}'::jsonb,
                '{"href":"/funnel/","variant":"primary","alignment":"center","target":"_self"}'::jsonb);
    END IF;

    SELECT id INTO v_benefits_id
    FROM page_sections
    WHERE page_id = v_page_id AND type = 'benefits'
    LIMIT 1;

    IF v_benefits_id IS NULL THEN
        INSERT INTO page_sections (page_id, offer_id, type, sort_order, settings)
        VALUES (v_page_id, v_offer_id, 'benefits', 200, '{"label":"Benefits"}'::jsonb)
        RETURNING id INTO v_benefits_id;

        INSERT INTO page_blocks (section_id, page_id, offer_id, type, sort_order, content, settings)
        VALUES
            (v_benefits_id, v_page_id, v_offer_id, 'heading', 100,
                '{"text":"O que vais descobrir"}'::jsonb,
                '{"level":2,"alignment":"center"}'::jsonb),
            (v_benefits_id, v_page_id, v_offer_id, 'text', 200,
                '{"text":"• Como despertar o potencial de aprendizagem do teu filho\n• Estratégias práticas para pais ocupados\n• Método testado pela Dra. Angela Campos"}'::jsonb,
                '{"alignment":"left"}'::jsonb);
    END IF;

    SELECT id INTO v_cta_id
    FROM page_sections
    WHERE page_id = v_page_id AND type = 'cta'
    LIMIT 1;

    IF v_cta_id IS NULL THEN
        INSERT INTO page_sections (page_id, offer_id, type, sort_order, settings)
        VALUES (v_page_id, v_offer_id, 'cta', 300, '{"label":"CTA"}'::jsonb)
        RETURNING id INTO v_cta_id;

        INSERT INTO page_blocks (section_id, page_id, offer_id, type, sort_order, content, settings)
        VALUES
            (v_cta_id, v_page_id, v_offer_id, 'heading', 100,
                '{"text":"Pronto para começar?"}'::jsonb,
                '{"level":2,"alignment":"center"}'::jsonb),
            (v_cta_id, v_page_id, v_offer_id, 'button', 200,
                '{"label":"Quero entrar agora — €9","href":"/checkout9/"}'::jsonb,
                '{"href":"/checkout9/","variant":"primary","alignment":"center","target":"_self"}'::jsonb);
    END IF;
END $$;

UPDATE page_blocks
SET content = jsonb_set(content, '{text}', '"AI Test Offer — Hero Heading"'::jsonb)
WHERE type = 'heading'
  AND content->>'text' IN ('undefined', 'null', '');
