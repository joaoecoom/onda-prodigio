-- PDFs complementares das aulas 1 e 3 do módulo «Começa aqui»

UPDATE content_modules
SET pdf_path = '/comunidade/assets/ebooks/seja-bem-vinda.pdf'
WHERE title = 'Boas-vindas ☀️'
  AND parent_id IS NOT NULL;

UPDATE content_modules
SET pdf_path = '/comunidade/assets/ebooks/instrucoes.pdf'
WHERE title = 'Instruções Onda Prodígio 📌'
  AND parent_id IS NOT NULL;
