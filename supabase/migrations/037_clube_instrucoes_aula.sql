-- Clube — Módulo 1: aula Instruções (PDF, após Bem-vinda)

INSERT INTO content_modules (product_id, parent_id, title, description, type, sort_order, pdf_path, image_url)
SELECT
    'clube-super-cerebros',
    cm.id,
    'Instruções 📌',
    'Antes de começares, lê este guia rápido! Aqui tens o texto detalhado que te explica como e quando reproduzir as ondas, de que forma realizar os desafios e o que fazer se o teu filho saltar um dia ou adormecer.',
    'ebook',
    2,
    '/comunidade/assets/ebooks/clube-instrucoes.pdf',
    'comunidade/assets/modulos/clube/01-comeca-aqui.png'
FROM content_modules cm
WHERE cm.product_id = 'clube-super-cerebros'
  AND cm.sort_order = 1
  AND cm.parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM content_modules child
      WHERE child.parent_id = cm.id
        AND child.sort_order = 2
  );
