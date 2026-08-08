-- Clube — Leitura Rápida, aula 5: Nível Élite Starter (PDF PT-PT)

UPDATE content_modules
SET
    type = 'ebook',
    pdf_path = '/comunidade/assets/ebooks/leitura-rapida-nivel-elite-starter.pdf',
    youtube_id = NULL,
    video_path = NULL,
    audio_path = NULL,
    description = 'Leitura rápida para crianças dos 10 aos 11 anos a prepararem o salto para o secundário com confiança.'
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 5
  AND parent_id IN (
      SELECT id FROM content_modules
      WHERE product_id = 'clube-super-cerebros'
        AND sort_order = 5
        AND parent_id IS NULL
  );
