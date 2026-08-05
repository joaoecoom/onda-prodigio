-- Módulo 3 — aula 1 (Coala): vídeo YouTube

UPDATE content_modules
SET youtube_id = 'zb7RCO77SUk'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 1
  AND title = 'Protocolo do Sono Profundo 💤 Conto — O Coala que não queria dormir';
