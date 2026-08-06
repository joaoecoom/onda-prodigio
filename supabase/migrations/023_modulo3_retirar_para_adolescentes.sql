-- Módulo 3 — retirar «Para Adolescentes» dos títulos das histórias 4–6

UPDATE content_modules
SET title = 'Protocolo do Sono Profundo 💤 HISTÓRIA 4 "O Eco do Quarto Vazio" 🍃'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 4;

UPDATE content_modules
SET title = 'Protocolo do Sono Profundo 💤 HISTÓRIA 5 "A Luz que Ficou Acesa" 💡'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 5;

UPDATE content_modules
SET title = 'Protocolo do Sono Profundo 💤 HISTÓRIA 6 "A Ponte que Só Aparece de Noite" 🌉'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 6;
