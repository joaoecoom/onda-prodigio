-- Onda Prodígio — Área de membros /comunidade

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('video', 'ebook')),
    youtube_id TEXT,
    pdf_path TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    auth_user_id UUID UNIQUE,
    full_name TEXT,
    password_set BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stripe_payment_intent_id TEXT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (member_id, product_id)
);

CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    auth_user_id UUID UNIQUE,
    name TEXT NOT NULL DEFAULT 'Suporte',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    module_id UUID REFERENCES content_modules(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    admin_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_modules_product ON content_modules(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_member_products_member ON member_products(member_id);
CREATE INDEX IF NOT EXISTS idx_comments_product ON comments(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Produtos
INSERT INTO products (id, name, description, image_url, sort_order) VALUES
    ('onda-prodigio', 'Onda Prodígio', 'Programa principal para despertar o potencial dos seus filhos.', 'assets/order-bump-tardes.png', 1),
    ('tardes-sem-brigas', 'A Fábrica das Tardes Tranquilas', 'Sistema passo a passo para tardes sem discussão.', 'assets/order-bump-tardes.png', 2),
    ('caixa-super-truques', 'A Caixa dos Super Truques do Génio', 'Ferramentas práticas de concentração, autonomia e motivação.', 'assets/order-bump-truques.png', 3),
    ('grandes-mentes', 'Grandes Mentes', 'Mais de 40 actividades criativas para crianças confiantes.', 'assets/order-bump-mentes.png', 4)
ON CONFLICT (id) DO NOTHING;

-- Superadmin
INSERT INTO admins (email, name) VALUES
    ('suporte.angelacampos@gmail.com', 'Angela Campos')
ON CONFLICT (email) DO NOTHING;

-- Módulo placeholder por produto (substituir quando tiveres conteúdo)
INSERT INTO content_modules (product_id, title, type, youtube_id, sort_order)
SELECT p.id, 'Bem-vindo — ' || p.name, 'video', NULL, 1
FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM content_modules cm WHERE cm.product_id = p.id
);
