-- Capa da aula «Boas-vindas»

UPDATE content_modules
SET image_url = 'comunidade/assets/aulas/boas-vindas.png'
WHERE title = 'Boas-vindas ☀️'
  AND parent_id IS NOT NULL;
