-- Clube — Leitura Rápida, aula 7: Nível Élite Máster (PDF PT-PT)

UPDATE content_modules
SET
    type = 'ebook',
    pdf_path = '/comunidade/assets/ebooks/leitura-rapida-nivel-elite-master.pdf',
    youtube_id = NULL,
    video_path = NULL,
    audio_path = NULL,
    description = 'Métodos de leitura rápida para jovens dos 14 aos 16 anos com foco em rendimento escolar e autonomia.'
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 7
  AND parent_id IN (
      SELECT id FROM content_modules
      WHERE product_id = 'clube-super-cerebros'
        AND sort_order = 5
        AND parent_id IS NULL
  );
