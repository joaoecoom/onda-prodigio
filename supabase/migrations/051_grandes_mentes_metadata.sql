-- Grandes Mentes: alinhar copy com os outros order bumps (PDF ainda por publicar)

UPDATE content_modules
SET
    title = 'Grandes Mentes',
    description = 'Mais de 40 actividades criativas para crianças confiantes. Descarrega o material, imprime o que precisares e aplica em casa.',
    type = 'ebook',
    image_url = 'checkout9/assets/order-bump-mentes.png',
    youtube_id = NULL,
    audio_path = NULL,
    pdf_path = NULL
WHERE product_id = 'grandes-mentes'
  AND parent_id IS NULL;
