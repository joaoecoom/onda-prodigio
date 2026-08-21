-- HUB DR Ecoom — AI Tasks (Fase 1: HUB → Contabo → Cursor Agent)

CREATE TABLE IF NOT EXISTS ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    prompt TEXT NOT NULL,
    offer_id TEXT REFERENCES hub_offers(id) ON DELETE SET NULL,
    task_type TEXT NOT NULL DEFAULT 'general',
    workspace TEXT NOT NULL DEFAULT '/opt/hub-agent/workspace/onda-prodigio',
    branch TEXT NOT NULL DEFAULT 'agent-proof-of-concept',
    requested_by TEXT NOT NULL DEFAULT 'hub',
    worker_id TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    error TEXT,
    exit_code INT,
    logs_reference TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_status_created
    ON ai_tasks (status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_offer_created
    ON ai_tasks (offer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_created
    ON ai_tasks (created_at DESC);

ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;

-- Atomic claim: one worker per task (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION claim_next_ai_task(p_worker_id TEXT)
RETURNS ai_tasks
LANGUAGE sql
AS $$
    WITH picked AS (
        SELECT id
        FROM ai_tasks
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    UPDATE ai_tasks AS t
    SET
        status = 'running',
        worker_id = p_worker_id,
        started_at = now(),
        updated_at = now()
    FROM picked
    WHERE t.id = picked.id
    RETURNING t.*;
$$;

COMMENT ON TABLE ai_tasks IS 'Fila de tarefas AI: HUB cria pending, worker Contabo faz claim e executa Cursor Agent';
COMMENT ON FUNCTION claim_next_ai_task IS 'Claim atómico da próxima task pending para um worker';
