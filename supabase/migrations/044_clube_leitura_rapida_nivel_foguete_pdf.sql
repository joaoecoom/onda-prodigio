-- Clube — Leitura Rápida, aula 3: Nível Foguete (PDF PT-PT)

UPDATE content_modules
SET
    type = 'ebook',
    pdf_path = '/comunidade/assets/ebooks/leitura-rapida-nivel-foguete.pdf',
    youtube_id = NULL,
    video_path = NULL,
    audio_path = NULL,
    description = 'Exercícios para crianças dos 6 aos 7 anos que já reconhecem letras e palavras simples e querem ganhar fluência.'
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 3
  AND parent_id IN (
      SELECT id FROM content_modules
      WHERE product_id = 'clube-super-cerebros'
        AND sort_order = 5
        AND parent_id IS NULL
  );
