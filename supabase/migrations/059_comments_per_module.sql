-- Comentários: associar à aula (module_id) e corrigir legado sem aula.

-- Respostas IA/reply herdam module_id do comentário pai.
UPDATE comments AS reply
SET module_id = parent.module_id
FROM comments AS parent
WHERE reply.parent_id = parent.id
  AND reply.module_id IS NULL
  AND parent.module_id IS NOT NULL;

-- Comentários antigos do método (áudio/leitura) sem aula identificada.
UPDATE comments
SET module_id = 'd88b511b-98c5-4b5c-ada0-f9a38b364de9'
WHERE module_id IS NULL
  AND parent_id IS NULL
  AND product_id = 'onda-prodigio'
  AND (
    content ILIKE '%ouvir%'
    OR content ILIKE '%sess%'
    OR content ILIKE '%leitura%'
    OR content ILIKE '%foco%'
    OR content ILIKE '%dificuldade%ler%'
    OR content ILIKE '%dificuldade%lê%'
  );

CREATE INDEX IF NOT EXISTS idx_comments_product_module
    ON comments (product_id, module_id, created_at);
