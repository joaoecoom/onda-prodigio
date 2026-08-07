-- Clube — Módulo 4: Ofertas Surpresa (2 materiais, PT-PT)

UPDATE content_modules
SET
    description = 'Ofertas especiais reservadas para membros do clube.',
    type = 'ebook',
    youtube_id = NULL,
    video_path = NULL,
    pdf_path = NULL,
    audio_path = NULL,
    unlock_after_days = 0
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 4
  AND parent_id IS NULL;

INSERT INTO content_modules (product_id, parent_id, title, description, type, sort_order, pdf_path, audio_path, image_url, unlock_after_days)
SELECT
    'clube-super-cerebros',
    cm.id,
    aula.title,
    aula.description,
    aula.type,
    aula.sort_order,
    aula.pdf_path,
    aula.audio_path,
    'comunidade/assets/modulos/clube/04-ofertas-surpresa.png',
    0
FROM content_modules cm
CROSS JOIN (
    VALUES
        (
            'Guia de Inteligência Financeira para Crianças 👦👧',
            'Um guia prático para ensinares aos teus filhos noções de poupança, consumo consciente e responsabilidade financeira — de forma simples, divertida e adaptada à idade.',
            'ebook',
            1,
            '/comunidade/assets/ebooks/guia-inteligencia-financeira-criancas.pdf',
            NULL
        ),
        (
            'Áudio de Sono Profundo 😴',
            'Ouve este áudio com o teu filho antes de dormir. Ajuda a acalmar o corpo e a mente, preparando uma noite de sono profundo e reparador.',
            'video',
            2,
            NULL,
            '/comunidade/assets/audio/sono-profundo.mp3'
        )
) AS aula(title, description, type, sort_order, pdf_path, audio_path)
WHERE cm.product_id = 'clube-super-cerebros'
  AND cm.sort_order = 4
  AND cm.parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM content_modules child WHERE child.parent_id = cm.id
  );
