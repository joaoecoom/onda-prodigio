-- Módulo 1 — aulas aninhadas (PT-PT)

ALTER TABLE content_modules ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES content_modules(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_content_modules_parent ON content_modules(parent_id, sort_order);

-- Corrigir título do módulo 5 (regalo → presente)
UPDATE content_modules
SET
    title = '👉 Método Concluído! Reclama aqui o teu presente surpresa 🎁',
    description = 'Parabéns por concluíres o método. Reclama aqui o teu presente final.'
WHERE product_id = 'onda-prodigio'
  AND sort_order = 5
  AND parent_id IS NULL;

-- Aulas do módulo «Começa aqui»
INSERT INTO content_modules (product_id, parent_id, title, description, type, sort_order)
SELECT
    'onda-prodigio',
    cm.id,
    aula.title,
    aula.description,
    'video',
    aula.sort_order
FROM content_modules cm
CROSS JOIN (
    VALUES
        ('Boas-vindas ☀️', 'Mensagem de boas-vindas ao método Onda Prodígio.', 1),
        ('Questionário Inicial 📝', 'Responde a este questionário antes de avançares.', 2),
        ('Instruções Onda Prodígio 📌', 'Como navegar na área de membros e tirar o máximo partido do método.', 3)
) AS aula(title, description, sort_order)
WHERE cm.product_id = 'onda-prodigio'
  AND cm.sort_order = 1
  AND cm.parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM content_modules child
      WHERE child.parent_id = cm.id
  );

-- Módulo 1 é secção (sem vídeo directo)
UPDATE content_modules
SET
    description = 'Começa por aqui — vê as três aulas introdutórias.',
    youtube_id = NULL,
    pdf_path = NULL
WHERE product_id = 'onda-prodigio'
  AND sort_order = 1
  AND parent_id IS NULL;
