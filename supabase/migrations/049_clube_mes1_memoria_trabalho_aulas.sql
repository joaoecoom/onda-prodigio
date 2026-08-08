-- Clube — Módulo 6: Mês 1 — Memória de trabalho (5 aulas, PT-PT)

UPDATE content_modules
SET
    title = 'Mês 1 - Memória de trabalho ⚡',
    description = 'Primeiro mês do clube: fortalecer a memória de trabalho e a capacidade de reter informação.',
    type = 'video',
    youtube_id = NULL,
    video_path = NULL,
    pdf_path = NULL,
    audio_path = NULL,
    unlock_after_days = 0
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 6
  AND parent_id IS NULL;

INSERT INTO content_modules (product_id, parent_id, title, description, type, sort_order, pdf_path, audio_path, video_path, image_url, unlock_after_days)
SELECT
    'clube-super-cerebros',
    cm.id,
    aula.title,
    aula.description,
    aula.type,
    aula.sort_order,
    aula.pdf_path,
    aula.audio_path,
    aula.video_path,
    'comunidade/assets/modulos/clube/06-mes-1-memoria.png',
    0
FROM content_modules cm
CROSS JOIN (
    VALUES
        (
            'Mês 1 - Guia estratégica - Memória de trabalho 📌',
            'O guia completo deste mês. Explica como funciona a memória de trabalho, o calendário de actividades e como acompanhar o teu filho ao longo das próximas semanas.',
            'ebook',
            1,
            NULL,
            NULL,
            NULL
        ),
        (
            'Mês 1 - Onda Relâmpago 🎶',
            'A onda sonora deste mês para activar e fortalecer a memória de trabalho. Ouve num ambiente calmo e segue as indicações do guia estratégico.',
            'video',
            2,
            NULL,
            NULL,
            NULL
        ),
        (
            'Mês 1 - Desafio Relâmpago ⚡',
            'O desafio prático do mês — actividades rápidas para treinar a memória de trabalho no dia a dia, com o ritmo e a diversão que o clube propõe.',
            'ebook',
            3,
            NULL,
            NULL,
            NULL
        ),
        (
            'Mês 1 - Ativa o teu cérebro 🧠',
            'Exercícios e dinâmicas para activar o cérebro antes das actividades de memória de trabalho — ideal para preparar o corpo e a mente.',
            'ebook',
            4,
            NULL,
            NULL,
            NULL
        ),
        (
            'Mês 1 - Meditação reencontro 🎶',
            'Meditação guiada para acalmar a mente, consolidar o que foi aprendido neste mês e reencontrar a calma interior.',
            'video',
            5,
            NULL,
            NULL,
            NULL
        )
) AS aula(title, description, type, sort_order, pdf_path, audio_path, video_path)
WHERE cm.product_id = 'clube-super-cerebros'
  AND cm.sort_order = 6
  AND cm.parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM content_modules child WHERE child.parent_id = cm.id
  );
