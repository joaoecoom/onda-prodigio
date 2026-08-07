-- Order bump: A Caixa dos Super Truques do Génio — ebook PDF

UPDATE content_modules
SET
    title = 'A Caixa dos Super Truques do Génio',
    description = 'Ferramentas práticas de concentração, autonomia, disciplina e motivação. As pequenas escolhas criam grandes resultados para rapazes e raparigas com futuro de génio. Descarrega o material, imprime o que precisares e aplica em casa.',
    type = 'ebook',
    pdf_path = '/comunidade/assets/ebooks/caixa-super-truques-genio.pdf',
    image_url = 'checkout9/assets/order-bump-truques.png',
    youtube_id = NULL,
    audio_path = NULL
WHERE product_id = 'caixa-super-truques'
  AND parent_id IS NULL
  AND sort_order = 1;
