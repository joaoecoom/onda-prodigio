-- Módulo 4 — aula 2: teste interactivo «Descobrir o Génio»

UPDATE content_modules
SET description = 'Responde a 8 perguntas rápidas sobre o teu filho e descobre o perfil de génio dominante, com sugestões práticas para aplicares já em casa.'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 4
        AND parent_id IS NULL
  )
  AND sort_order = 2
  AND title = 'Teste para Descobrir o Génio 🧠';
