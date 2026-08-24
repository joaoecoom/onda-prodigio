-- Fase 3C — observabilidade de tool calls do Cursor Agent

CREATE TABLE IF NOT EXISTS ai_task_tool_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ai_task_id UUID REFERENCES ai_tasks(id) ON DELETE SET NULL,
    offer_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    error_code TEXT,
    input JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB
);

CREATE INDEX IF NOT EXISTS idx_ai_task_tool_calls_task
    ON ai_task_tool_calls(ai_task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_task_tool_calls_offer
    ON ai_task_tool_calls(offer_id, created_at DESC);

ALTER TABLE ai_task_tool_calls ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ai_task_tool_calls IS 'Log estruturado de HUB agent tools (Fase 3C). Acesso via service role apenas.';
