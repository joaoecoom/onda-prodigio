-- Progresso de visualização por membro e conteúdo

CREATE TABLE IF NOT EXISTS member_module_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES content_modules(id) ON DELETE CASCADE,
    progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (member_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_member_module_progress_member ON member_module_progress(member_id);
CREATE INDEX IF NOT EXISTS idx_member_module_progress_module ON member_module_progress(module_id);

ALTER TABLE member_module_progress ENABLE ROW LEVEL SECURITY;
