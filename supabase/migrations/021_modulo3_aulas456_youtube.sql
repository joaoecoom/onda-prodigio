-- Módulo 3 — aulas 4, 5 e 6: vídeos YouTube

UPDATE content_modules
SET youtube_id = 'x2BekULPuU0'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 4
  AND title = 'Protocolo do Sono Profundo 💤 Conto — O Ursinho que não queria ir para a cama 🐻';

UPDATE content_modules
SET youtube_id = '1CTvfwAHuMM'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 5
  AND title = 'Protocolo do Sono Profundo 💤 Conto — O Coelhinho tranquilo 🐰';

UPDATE content_modules
SET youtube_id = 'tTzhR0y1KaI'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 6
  AND title = 'Protocolo do Sono Profundo 💤 Conto — A Estrelinha dos sonos ⭐';
