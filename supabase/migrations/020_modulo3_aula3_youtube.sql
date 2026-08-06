-- Módulo 3 — aula 3 (Capivara): vídeo YouTube

UPDATE content_modules AS child
SET
    youtube_id = 'nWKwlXi-7SM',
    title = 'Protocolo do Sono Profundo 💤 Conto — A Capivara tranquila 🦫'
FROM content_modules AS parent
WHERE child.parent_id = parent.id
  AND parent.product_id = 'onda-prodigio'
  AND parent.sort_order = 3
  AND parent.parent_id IS NULL
  AND child.sort_order = 3;
