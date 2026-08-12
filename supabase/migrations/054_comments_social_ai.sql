-- Comentários: gostos, ocultar, fila de respostas IA

ALTER TABLE comments
    ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_ai BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ai_reply_status TEXT,
    ADD COLUMN IF NOT EXISTS ai_scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_comments_ai_queue
    ON comments (ai_reply_status, ai_scheduled_at)
    WHERE ai_reply_status IS NOT NULL;

CREATE TABLE IF NOT EXISTS comment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (comment_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);

CREATE TABLE IF NOT EXISTS comment_ai_daily_runs (
    run_date DATE PRIMARY KEY,
    queue_built BOOLEAN NOT NULL DEFAULT false,
    replies_sent INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comment_reply_email_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (comment_id)
);
