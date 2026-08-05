-- Módulos do Método Onda Prodígio

ALTER TABLE content_modules ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE content_modules ADD COLUMN IF NOT EXISTS description TEXT;

DELETE FROM content_modules WHERE product_id = 'onda-prodigio';

INSERT INTO content_modules (product_id, title, description, type, sort_order) VALUES
    (
        'onda-prodigio',
        '👉 Começa aqui',
        'Bem-vinda ao método. Assiste primeiro a esta introdução.',
        'video',
        1
    ),
    (
        'onda-prodigio',
        '🧠 Método Onda Prodígio',
        'O programa principal passo a passo para despertar o potencial do teu filho.',
        'video',
        2
    ),
    (
        'onda-prodigio',
        '🎁 Oferta — Protocolo do Sono Profundo',
        'Bónus: protocolo para noites tranquilas e sono reparador.',
        'video',
        3
    ),
    (
        'onda-prodigio',
        '🎁 Ofertas',
        'Materiais extra e recursos complementares do método.',
        'ebook',
        4
    ),
    (
        'onda-prodigio',
        '👉 Método Concluído! Reclama o teu regalo surpresa aqui 🎁',
        'Parabéns por concluíres o método. Reclama aqui o teu regalo final.',
        'video',
        5
    );
