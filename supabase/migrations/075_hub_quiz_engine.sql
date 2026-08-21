-- HUB DR Ecoom — Quiz funnel engine (questions, answers, results, submissions)

CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 100,
    question TEXT NOT NULL DEFAULT '',
    question_type TEXT NOT NULL DEFAULT 'single'
        CHECK (question_type IN ('single', 'multiple', 'text', 'email')),
    required BOOLEAN NOT NULL DEFAULT true,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_funnel_pos
    ON quiz_questions (funnel_id, position ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_offer
    ON quiz_questions (offer_id);

CREATE TABLE IF NOT EXISTS quiz_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT '',
    value TEXT NOT NULL DEFAULT '',
    score INT NOT NULL DEFAULT 0,
    position INT NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_question_pos
    ON quiz_answers (question_id, position ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_offer
    ON quiz_answers (offer_id);

CREATE TABLE IF NOT EXISTS quiz_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    min_score INT NOT NULL DEFAULT 0,
    max_score INT NOT NULL DEFAULT 9999,
    cta_label TEXT NOT NULL DEFAULT 'Continuar',
    cta_action TEXT NOT NULL DEFAULT 'checkout',
    image_url TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 100,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_results_funnel
    ON quiz_results (funnel_id, sort_order ASC);

CREATE TABLE IF NOT EXISTS quiz_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL REFERENCES hub_offers(id) ON DELETE CASCADE,
    email TEXT NOT NULL DEFAULT '',
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_score INT NOT NULL DEFAULT 0,
    result_id UUID REFERENCES quiz_results(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_funnel
    ON quiz_submissions (funnel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_offer
    ON quiz_submissions (offer_id, created_at DESC);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;
