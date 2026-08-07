-- Clube — Módulo 5: Leitura Rápida (7 aulas, PT-PT)

UPDATE content_modules
SET
    description = 'Técnicas de leitura rápida por níveis etários — do pré-leitor ao alto desempenho.',
    type = 'video',
    youtube_id = NULL,
    video_path = NULL,
    pdf_path = NULL,
    audio_path = NULL,
    unlock_after_days = 0
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 5
  AND parent_id IS NULL;

INSERT INTO content_modules (product_id, parent_id, title, description, type, sort_order, image_url, unlock_after_days)
SELECT
    'clube-super-cerebros',
    cm.id,
    aula.title,
    aula.description,
    'video',
    aula.sort_order,
    'comunidade/assets/modulos/clube/05-leitura-rapida.png',
    0
FROM content_modules cm
CROSS JOIN (
    VALUES
        (
            'Boas-vindas ☀️',
            'Bem-vindo ao módulo de Leitura Rápida. Descobre como funciona o percurso por níveis etários e por onde começar com o teu filho.',
            1
        ),
        (
            'Nível Semente (4 a 5 anos) – «Pré-leitores» 🌱',
            'Actividades de pré-leitura para crianças dos 4 aos 5 anos — reconhecimento de letras, ritmo e curiosidade pela leitura.',
            2
        ),
        (
            'Nível Foguete (6 a 7 anos) – «Leitores a caminho» 🚀',
            'Exercícios para crianças dos 6 aos 7 anos que já reconhecem letras e palavras simples e querem ganhar fluência.',
            3
        ),
        (
            'Nível Supercérebro Júnior (8 a 9 anos) – «Leitores avançados» 🧠',
            'Técnicas para crianças dos 8 aos 9 anos consolidarem fluência, compreensão e velocidade de leitura.',
            4
        ),
        (
            'Nível Élite Starter (10 a 11 anos) – «Pré-secundário» 🎓',
            'Leitura rápida para crianças dos 10 aos 11 anos a prepararem o salto para o secundário com confiança.',
            5
        ),
        (
            'Nível Élite Pro (12 a 13 anos) – «Secundário activo» ⚡',
            'Técnicas avançadas para adolescentes dos 12 aos 13 anos em plena fase de secundário.',
            6
        ),
        (
            'Nível Élite Máster (14 a 16 anos) – «Alto desempenho» 🏆',
            'Métodos de leitura rápida para jovens dos 14 aos 16 anos com foco em rendimento escolar e autonomia.',
            7
        )
) AS aula(title, description, sort_order)
WHERE cm.product_id = 'clube-super-cerebros'
  AND cm.sort_order = 5
  AND cm.parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM content_modules child WHERE child.parent_id = cm.id
  );
