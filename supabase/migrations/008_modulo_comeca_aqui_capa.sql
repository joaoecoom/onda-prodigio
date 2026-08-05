-- Capa do módulo «Começa aqui» na grelha de conteúdos

UPDATE content_modules
SET image_url = 'comunidade/assets/modulos/comeca-aqui.png'
WHERE product_id = 'onda-prodigio'
  AND title = '👉 Começa aqui'
  AND parent_id IS NULL;
