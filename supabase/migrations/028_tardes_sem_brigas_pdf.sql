-- Order bump: A Fábrica das Tardes Tranquilas — ebook PDF

UPDATE content_modules
SET
    title = 'A Fábrica das Tardes Tranquilas',
    description = 'As birras transformam-se em disciplina automática. Um sistema passo a passo para acordos claros, tarefas completas e tardes sem discussão no quarto. Descarrega o material, imprime o que precisares e aplica em casa.',
    type = 'ebook',
    pdf_path = '/comunidade/assets/ebooks/tardes-sem-discussoes.pdf',
    image_url = 'checkout9/assets/order-bump-tardes.png',
    youtube_id = NULL,
    audio_path = NULL
WHERE product_id = 'tardes-sem-brigas'
  AND parent_id IS NULL
  AND sort_order = 1;
