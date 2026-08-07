-- Clube dos Super Cérebros — estrutura base de módulos (PT-PT)

DELETE FROM content_modules WHERE product_id = 'clube-super-cerebros';

INSERT INTO content_modules (product_id, title, description, type, sort_order, unlock_after_days)
VALUES
    (
        'clube-super-cerebros',
        '👉 Começa aqui',
        'Bem-vindo ao Clube dos Super Cérebros. Começa por aqui para perceberes como funciona a comunidade e o que vais encontrar em cada mês.',
        'video',
        1,
        0
    ),
    (
        'clube-super-cerebros',
        '🎁 Oferta — Protocolo do Sono Profundo',
        'Bónus exclusivo do clube: protocolo para noites tranquilas e sono reparador.',
        'video',
        2,
        0
    ),
    (
        'clube-super-cerebros',
        '🎁 Ofertas',
        'Materiais extra incluídos na tua adesão ao clube.',
        'ebook',
        3,
        0
    ),
    (
        'clube-super-cerebros',
        '🎁 Ofertas Surpresa',
        'Ofertas especiais reservadas para membros do clube.',
        'ebook',
        4,
        0
    ),
    (
        'clube-super-cerebros',
        'Leitura Rápida 📚',
        'Técnicas de leitura rápida para potenciar a aprendizagem do teu filho.',
        'video',
        5,
        0
    ),
    (
        'clube-super-cerebros',
        'Mês 1 — Memória de Trabalho ⚡',
        'Primeiro mês do clube: fortalecer a memória de trabalho e a capacidade de reter informação.',
        'video',
        6,
        0
    ),
    (
        'clube-super-cerebros',
        'Mês 2 — Velocidade de Processamento Mental 🧠',
        'Segundo mês: agilizar o processamento mental e a rapidez de raciocínio.',
        'video',
        7,
        0
    ),
    (
        'clube-super-cerebros',
        'Mês 3 — Pensamento Analítico Avançado 🧠',
        'Terceiro mês: desenvolver pensamento analítico e capacidade de decompor problemas.',
        'video',
        8,
        0
    ),
    (
        'clube-super-cerebros',
        'Mês 4 — Pensamento Crítico e Critério Próprio',
        'Quarto mês: pensamento crítico, autonomia de julgamento e critério próprio.',
        'video',
        9,
        0
    ),
    (
        'clube-super-cerebros',
        'Mês 5 — Pensamento Criativo e Resolução de Problemas 🎨',
        'Quinto mês: criatividade, imaginação e resolução de problemas no dia a dia.',
        'video',
        10,
        0
    ),
    (
        'clube-super-cerebros',
        'Mês 6 — O Poder da Calma 🌊',
        'Sexto mês: regulação emocional, calma interior e gestão do stress.',
        'video',
        11,
        0
    ),
    (
        'clube-super-cerebros',
        'Mês 7 — O Foco 🪄',
        'Sétimo mês: concentração, foco sustentado e menos distrações.',
        'video',
        12,
        0
    ),
    (
        'clube-super-cerebros',
        'Mês 8 — A Curiosidade do Génio 🕵️',
        'Oitavo mês: despertar curiosidade, vontade de aprender e explorar.',
        'video',
        13,
        0
    ),
    (
        'clube-super-cerebros',
        'Mês 9 — Pensamento Ágil ⚡',
        'Nono mês: flexibilidade mental, adaptação rápida e pensamento ágil.',
        'video',
        14,
        0
    ),
    (
        'clube-super-cerebros',
        'Mês 10 — O Poder da Linguagem 🗣️',
        'Décimo mês: comunicação, expressão e domínio da linguagem.',
        'video',
        15,
        0
    ),
    (
        'clube-super-cerebros',
        'Mês 11 — A Arte de Adaptar-se 🔄',
        'Décimo primeiro mês: adaptabilidade, resiliência e capacidade de se ajustar a novos desafios.',
        'video',
        16,
        0
    ),
    (
        'clube-super-cerebros',
        'Questionário interactivo de conhecimento e satisfação 🧠',
        'Partilha a tua experiência no clube e avalia o teu progresso.',
        'video',
        17,
        0
    );

UPDATE products
SET description = 'Comunidade exclusiva de pais com conteúdo novo todos os meses. Programa mensal para desenvolver super cérebros em casa.'
WHERE id = 'clube-super-cerebros';
