-- Clube — Leitura Rápida, aula 1: Boas-vindas (PDF PT-PT)

UPDATE content_modules
SET
    type = 'ebook',
    pdf_path = '/comunidade/assets/ebooks/leitura-rapida-bem-vindos.pdf',
    youtube_id = NULL,
    video_path = NULL,
    audio_path = NULL,
    description = 'Bem-vindo ao módulo de Leitura Rápida. Lê este guia para perceberes como funciona o percurso por níveis etários e por onde começar com o teu filho.'
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 1
  AND parent_id IN (
      SELECT id FROM content_modules
      WHERE product_id = 'clube-super-cerebros'
        AND sort_order = 5
        AND parent_id IS NULL
  );
