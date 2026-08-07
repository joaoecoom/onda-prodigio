-- Clube — Aula «Áudio de Sono Profundo»: capa dedicada

UPDATE content_modules
SET image_url = 'comunidade/assets/aulas/clube-sono-profundo.png'
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 2
  AND parent_id IN (
      SELECT id FROM content_modules
      WHERE product_id = 'clube-super-cerebros'
        AND sort_order = 4
        AND parent_id IS NULL
  );
