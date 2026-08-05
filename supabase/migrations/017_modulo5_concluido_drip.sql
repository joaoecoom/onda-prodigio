-- Módulo 5 — Método Concluído (2 materiais com desbloqueio progressivo)

UPDATE content_modules
SET
    description = 'Parabéns por concluíres o método. Reclama aqui o teu presente final.',
    youtube_id = NULL,
    pdf_path = NULL,
    audio_path = NULL,
    unlock_after_days = 0
WHERE product_id = 'onda-prodigio'
  AND sort_order = 5
  AND parent_id IS NULL;

INSERT INTO content_modules (product_id, parent_id, title, description, type, sort_order, image_url, unlock_after_days)
SELECT
    'onda-prodigio',
    cm.id,
    aula.title,
    aula.description,
    aula.module_type,
    aula.sort_order,
    'comunidade/assets/modulos/metodo-concluido.png',
    aula.unlock_after_days
FROM content_modules cm
CROSS JOIN (
    VALUES
        (
            'Inquérito Final 📝',
            'Partilha a tua experiência com o método Onda Prodígio.',
            'video',
            1,
            20
        ),
        (
            'Presente Surpresa 🎁',
            'Reclama aqui o teu presente especial por teres concluído o método.',
            'ebook',
            2,
            20
        )
) AS aula(title, description, module_type, sort_order, unlock_after_days)
WHERE cm.product_id = 'onda-prodigio'
  AND cm.sort_order = 5
  AND cm.parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM content_modules child
      WHERE child.parent_id = cm.id
  );
