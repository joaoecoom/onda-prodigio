-- Módulo 4 — Ofertas (6 materiais com desbloqueio progressivo)

ALTER TABLE content_modules ADD COLUMN IF NOT EXISTS unlock_after_days INT NOT NULL DEFAULT 0;

UPDATE content_modules
SET
    title = '🎁 Ofertas',
    description = 'Materiais extra e recursos complementares do método.',
    youtube_id = NULL,
    pdf_path = NULL,
    audio_path = NULL,
    unlock_after_days = 0
WHERE product_id = 'onda-prodigio'
  AND sort_order = 4
  AND parent_id IS NULL;

INSERT INTO content_modules (product_id, parent_id, title, description, type, sort_order, image_url, unlock_after_days)
SELECT
    'onda-prodigio',
    cm.id,
    aula.title,
    aula.description,
    'ebook',
    aula.sort_order,
    'comunidade/assets/modulos/ofertas.png',
    aula.unlock_after_days
FROM content_modules cm
CROSS JOIN (
    VALUES
        (
            '20 Receitas para alimentar um Génio 🍽️',
            'Receitas práticas para apoiar a concentração e o bem-estar do teu filho.',
            1,
            14
        ),
        (
            'Teste para Descobrir o Génio 🧠',
            'Questionário interactivo para identificar o perfil de aprendizagem do teu filho.',
            2,
            29
        ),
        (
            'Guia para descobrir o Génio 🧠',
            'Guia completo para interpretar os resultados e aplicar no dia a dia.',
            3,
            29
        ),
        (
            'Ferramentas de Inteligência Emocional — Pequenos Exploradores (3 a 6 anos)',
            'Actividades e ferramentas adaptadas à faixa etária dos 3 aos 6 anos.',
            4,
            34
        ),
        (
            'Ferramentas de Inteligência Emocional — Construtores (7 a 12 anos)',
            'Recursos para desenvolver autoconsciência e regulação emocional.',
            5,
            34
        ),
        (
            'Ferramentas de Inteligência Emocional — Líderes (13 a 18 anos) 👨‍🎓',
            'Ferramentas para adolescentes desenvolverem liderança emocional.',
            6,
            34
        )
) AS aula(title, description, sort_order, unlock_after_days)
WHERE cm.product_id = 'onda-prodigio'
  AND cm.sort_order = 4
  AND cm.parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM content_modules child
      WHERE child.parent_id = cm.id
  );
