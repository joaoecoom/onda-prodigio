-- Capas dos módulos 2–5 na grelha «Todos os conteúdos»

UPDATE content_modules
SET image_url = 'comunidade/assets/modulos/metodo-onda-prodigio.png'
WHERE product_id = 'onda-prodigio'
  AND title = '🧠 Método Onda Prodígio'
  AND parent_id IS NULL;

UPDATE content_modules
SET image_url = 'comunidade/assets/modulos/protocolo-sono.png'
WHERE product_id = 'onda-prodigio'
  AND title = '🎁 Oferta — Protocolo do Sono Profundo'
  AND parent_id IS NULL;

UPDATE content_modules
SET image_url = 'comunidade/assets/modulos/ofertas.png'
WHERE product_id = 'onda-prodigio'
  AND title = '🎁 Ofertas'
  AND parent_id IS NULL;

UPDATE content_modules
SET image_url = 'comunidade/assets/modulos/metodo-concluido.png'
WHERE product_id = 'onda-prodigio'
  AND title = '👉 Método Concluído! Reclama aqui o teu presente surpresa 🎁'
  AND parent_id IS NULL;
