-- Módulo 4 — aula 1: ebook 20 Receitas para alimentar um Génio

UPDATE content_modules
SET
    pdf_path = '/comunidade/assets/ebooks/20-receitas-genio.pdf',
    description = 'Receitas práticas e deliciosas para nutrir o cérebro do teu filho. Cada receita foi pensada para apoiar a concentração, a memória e o bem-estar — alimentando o génio por dentro.'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 4
        AND parent_id IS NULL
  )
  AND sort_order = 1
  AND title = '20 Receitas para alimentar um Génio 🍽️';
