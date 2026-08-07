-- Clube — Leitura Rápida, aula 2: Nível Semente (PDF PT-PT)

UPDATE content_modules
SET
    type = 'ebook',
    pdf_path = '/comunidade/assets/ebooks/leitura-rapida-nivel-semente.pdf',
    youtube_id = NULL,
    video_path = NULL,
    audio_path = NULL,
    description = 'Actividades de pré-leitura para crianças dos 4 aos 5 anos — reconhecimento de letras, ritmo e curiosidade pela leitura.'
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 2
  AND parent_id IN (
      SELECT id FROM content_modules
      WHERE product_id = 'clube-super-cerebros'
        AND sort_order = 5
        AND parent_id IS NULL
  );
