-- Clube — Módulo 3: Ofertas (6 materiais, igual Onda Prodígio + drip)

UPDATE content_modules
SET
    description = 'Materiais extra e recursos complementares do clube.',
    type = 'ebook',
    youtube_id = NULL,
    video_path = NULL,
    pdf_path = NULL,
    audio_path = NULL,
    unlock_after_days = 0
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 3
  AND parent_id IS NULL;

INSERT INTO content_modules (product_id, parent_id, title, description, type, sort_order, pdf_path, image_url, unlock_after_days)
SELECT
    'clube-super-cerebros',
    cm.id,
    aula.title,
    aula.description,
    'ebook',
    aula.sort_order,
    aula.pdf_path,
    'comunidade/assets/modulos/clube/03-ofertas.png',
    aula.unlock_after_days
FROM content_modules cm
CROSS JOIN (
    VALUES
        (
            '20 Receitas para alimentar um Génio 🍽️',
            'Receitas práticas e deliciosas para nutrir o cérebro do teu filho. Cada receita foi pensada para apoiar a concentração, a memória e o bem-estar — alimentando o génio por dentro.',
            1,
            '/comunidade/assets/ebooks/20-receitas-genio.pdf',
            14
        ),
        (
            'Teste para Descobrir o Génio 🧠',
            'Questionário interactivo para identificar o perfil de aprendizagem do teu filho.',
            2,
            NULL,
            29
        ),
        (
            'Guia para descobrir o Génio 🧠',
            'Guia completo para interpretar os resultados e aplicar no dia a dia.',
            3,
            NULL,
            29
        ),
        (
            'Ferramentas de Inteligência Emocional — Pequenos Exploradores (3 a 6 anos)',
            'Actividades e ferramentas adaptadas à faixa etária dos 3 aos 6 anos.',
            4,
            NULL,
            34
        ),
        (
            'Ferramentas de Inteligência Emocional — Construtores (7 a 12 anos)',
            'Recursos para desenvolver autoconsciência e regulação emocional.',
            5,
            NULL,
            34
        ),
        (
            'Ferramentas de Inteligência Emocional — Líderes (13 a 18 anos) 👨‍🎓',
            'Ferramentas para adolescentes desenvolverem liderança emocional.',
            6,
            NULL,
            34
        )
) AS aula(title, description, sort_order, pdf_path, unlock_after_days)
WHERE cm.product_id = 'clube-super-cerebros'
  AND cm.sort_order = 3
  AND cm.parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM content_modules child WHERE child.parent_id = cm.id
  );
