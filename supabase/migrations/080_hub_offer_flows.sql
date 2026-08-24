-- Recovery + automation flows per offer (visual builder + AI).
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS hub_offer_flows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id text NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('recovery', 'automation')),
    name text NOT NULL,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    trigger text NOT NULL DEFAULT 'checkout_abandoned',
    definition jsonb NOT NULL DEFAULT '{"nodes":[]}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hub_offer_flows_offer_kind_idx
    ON hub_offer_flows (offer_id, kind);

CREATE INDEX IF NOT EXISTS hub_offer_flows_offer_status_idx
    ON hub_offer_flows (offer_id, status);

CREATE TABLE IF NOT EXISTS hub_offer_flow_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id uuid NOT NULL REFERENCES hub_offer_flows(id) ON DELETE CASCADE,
    offer_id text NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    reference_id text NOT NULL,
    contact_email text,
    contact_phone text,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'cancelled', 'failed')),
    current_node_id text,
    context jsonb NOT NULL DEFAULT '{}'::jsonb,
    next_run_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (flow_id, reference_id)
);

CREATE INDEX IF NOT EXISTS hub_offer_flow_runs_next_idx
    ON hub_offer_flow_runs (status, next_run_at);

-- Expand recovery queue to support abandoned checkout + offer_id.
ALTER TABLE failed_payment_recovery_queue
    ADD COLUMN IF NOT EXISTS offer_id text;

ALTER TABLE failed_payment_recovery_queue
    ADD COLUMN IF NOT EXISTS recovery_kind text DEFAULT 'failed_payment';

CREATE INDEX IF NOT EXISTS failed_payment_recovery_queue_offer_idx
    ON failed_payment_recovery_queue (offer_id);

COMMENT ON TABLE hub_offer_flows IS
    'Visual recovery/automation flows per offer. definition.nodes = wait/email/whatsapp graph.';
