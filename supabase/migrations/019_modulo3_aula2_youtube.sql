-- Módulo 3 — aula 2 (Cachorrinho): vídeo YouTube

UPDATE content_modules
SET youtube_id = 'DFO8651JhdE'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 2
  AND title = 'Protocolo do Sono Profundo 💤 Conto — O Cachorrinho de rua 🐶';
