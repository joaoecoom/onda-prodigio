-- HUB DR Ecoom — Fase 2: OfferContext + multi-workspace AI

ALTER TABLE hub_offers
    ADD COLUMN IF NOT EXISTS agent_workspace_key TEXT,
    ADD COLUMN IF NOT EXISTS agent_branch TEXT NOT NULL DEFAULT 'agent-proof-of-concept',
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_hub_offers_agent_workspace
    ON hub_offers (agent_workspace_key)
    WHERE agent_workspace_key IS NOT NULL;

-- Onda Prodígio: workspace key + branch (repo existente na VPS)
UPDATE hub_offers
SET
    agent_workspace_key = COALESCE(agent_workspace_key, slug, id),
    agent_branch = COALESCE(NULLIF(agent_branch, ''), 'agent-proof-of-concept'),
    settings = COALESCE(settings, '{}'::jsonb)
WHERE id = 'onda-prodigio';

-- Segunda oferta de teste (isolamento AI — sem Stripe/Meta/domínio real)
INSERT INTO hub_offers (
    id,
    name,
    slug,
    status,
    primary_product_id,
    site_url,
    funnel_url,
    funnel_domain,
    hub_domain,
    branding,
    mode,
    sort_order,
    agent_workspace_key,
    agent_branch,
    settings
) VALUES (
    'ai-test-offer',
    'AI Test Offer',
    'ai-test-offer',
    'draft',
    NULL,
    NULL,
    NULL,
    NULL,
    'hub-dr-ecoom.vercel.app',
    '{"from_name":"AI Test Offer","accent":"#22c55e"}'::jsonb,
    'test',
    99,
    'ai-test-offer',
    'agent-proof-of-concept',
    '{"purpose":"phase2_isolation_test","production":false}'::jsonb
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    agent_workspace_key = EXCLUDED.agent_workspace_key,
    agent_branch = EXCLUDED.agent_branch,
    settings = EXCLUDED.settings,
    status = EXCLUDED.status;

COMMENT ON COLUMN hub_offers.agent_workspace_key IS 'Chave server-side para resolver workspace do Cursor Agent (/opt/hub-agent/workspaces/{key})';
COMMENT ON COLUMN hub_offers.agent_branch IS 'Branch Git de trabalho do Agent para esta oferta';
COMMENT ON COLUMN hub_offers.settings IS 'Configurações extensíveis da oferta (JSONB)';
