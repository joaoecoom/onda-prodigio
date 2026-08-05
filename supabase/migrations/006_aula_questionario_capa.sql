-- Capa da aula «Questionário Inicial»

UPDATE content_modules
SET image_url = 'comunidade/assets/aulas/questionario-inicial.png'
WHERE title = 'Questionário Inicial 📝'
  AND parent_id IS NOT NULL;
