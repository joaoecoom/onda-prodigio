-- Clube — Leitura Rápida, aula 6: Nível Élite Pro (PDF PT-PT)

UPDATE content_modules
SET
    type = 'ebook',
    pdf_path = '/comunidade/assets/ebooks/leitura-rapida-nivel-elite-pro.pdf',
    youtube_id = NULL,
    video_path = NULL,
    audio_path = NULL,
    description = 'Técnicas avançadas de leitura rápida para adolescentes dos 12 aos 13 anos em plena fase de secundário.'
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 6
  AND parent_id IN (
      SELECT id FROM content_modules
      WHERE product_id = 'clube-super-cerebros'
        AND sort_order = 5
        AND parent_id IS NULL
  );
