-- Clube — Leitura Rápida, aula 4: Nível Supercérebro Júnior (PDF PT-PT)

UPDATE content_modules
SET
    type = 'ebook',
    pdf_path = '/comunidade/assets/ebooks/leitura-rapida-nivel-supercerebro-junior.pdf',
    youtube_id = NULL,
    video_path = NULL,
    audio_path = NULL,
    description = 'Técnicas para crianças dos 8 aos 9 anos consolidarem fluência, compreensão e velocidade de leitura.'
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 4
  AND parent_id IN (
      SELECT id FROM content_modules
      WHERE product_id = 'clube-super-cerebros'
        AND sort_order = 5
        AND parent_id IS NULL
  );
