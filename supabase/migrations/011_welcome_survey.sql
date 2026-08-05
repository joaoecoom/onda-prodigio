-- Questionário de boas-vindas (aula Questionário Inicial)

CREATE TABLE IF NOT EXISTS welcome_survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    module_id UUID REFERENCES content_modules(id) ON DELETE SET NULL,
    survey_id TEXT NOT NULL DEFAULT 'onda-prodigio-welcome',
    answers JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (member_id, product_id, survey_id)
);

CREATE INDEX IF NOT EXISTS idx_welcome_survey_product ON welcome_survey_responses(product_id, created_at DESC);

ALTER TABLE welcome_survey_responses ENABLE ROW LEVEL SECURITY;

UPDATE content_modules
SET description = 'Dedica 3 minutos a responder a este questionário. As tuas respostas ajudam-nos a personalizar o apoio ao teu filho.'
WHERE title = 'Questionário Inicial 📝'
  AND parent_id IS NOT NULL;
