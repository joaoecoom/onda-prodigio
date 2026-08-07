-- Produtos upsell + imagens corrigidas + suporte a subscrições

ALTER TABLE products ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 'one_time';

ALTER TABLE member_products ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE member_products ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

UPDATE products SET
    image_url = 'comunidade/assets/products/onda-prodigio.png',
    billing_type = 'one_time'
WHERE id = 'onda-prodigio';

UPDATE products SET
    image_url = 'comunidade/assets/products/tardes-sem-brigas.png',
    billing_type = 'one_time'
WHERE id = 'tardes-sem-brigas';

UPDATE products SET
    image_url = 'comunidade/assets/products/caixa-super-truques.png',
    billing_type = 'one_time'
WHERE id = 'caixa-super-truques';

UPDATE products SET
    image_url = 'comunidade/assets/products/grandes-mentes.png',
    billing_type = 'one_time'
WHERE id = 'grandes-mentes';

INSERT INTO products (id, name, description, image_url, sort_order, billing_type)
VALUES
    (
        'clube-super-cerebros',
        'Clube dos Super Cérebros',
        'Comunidade exclusiva de pais com conteúdo novo todos os meses. Acesso enquanto a subscrição estiver activa.',
        'comunidade/assets/products/clube-super-cerebros.png',
        5,
        'subscription'
    ),
    (
        'codigo-autoridade',
        'Código da Autoridade',
        'Aulas práticas para autonomia, rotina e autoridade em casa. Pagamento único com acesso permanente.',
        'comunidade/assets/products/codigo-autoridade.png',
        6,
        'one_time'
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    billing_type = EXCLUDED.billing_type;

INSERT INTO content_modules (product_id, title, type, sort_order)
SELECT p.id, 'Bem-vindo — ' || p.name, 'video', 1
FROM products p
WHERE p.id IN ('clube-super-cerebros', 'codigo-autoridade')
  AND NOT EXISTS (
      SELECT 1 FROM content_modules cm WHERE cm.product_id = p.id
  );
