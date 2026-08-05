-- Módulo 3 — Protocolo do Sono Profundo (6 aulas, PT-PT)

UPDATE content_modules
SET
    description = 'Bónus: seis contos para noites tranquilas e sono reparador.',
    youtube_id = NULL,
    pdf_path = NULL,
    audio_path = NULL
WHERE product_id = 'onda-prodigio'
  AND sort_order = 3
  AND parent_id IS NULL;

INSERT INTO content_modules (product_id, parent_id, title, description, type, sort_order, image_url)
SELECT
    'onda-prodigio',
    cm.id,
    aula.title,
    aula.description,
    'video',
    aula.sort_order,
    'comunidade/assets/modulos/protocolo-sono.png'
FROM content_modules cm
CROSS JOIN (
    VALUES
        (
            'Protocolo do Sono Profundo 💤 Conto — O Coala que não queria dormir',
            'Conto para ajudar o teu filho a acalmar a mente e adormecer em paz.',
            1
        ),
        (
            'Protocolo do Sono Profundo 💤 Conto — O Cachorrinho de rua 🐶',
            'História sobre confiança e segurança antes de dormir.',
            2
        ),
        (
            'Protocolo do Sono Profundo 💤 Conto — O Gatinho que tinha medo do escuro 🐱',
            'Conto para transformar o medo da noite em calma e descanso.',
            3
        ),
        (
            'Protocolo do Sono Profundo 💤 Conto — O Ursinho que não queria ir para a cama 🐻',
            'História sobre rotina nocturna e sono reparador.',
            4
        ),
        (
            'Protocolo do Sono Profundo 💤 Conto — O Coelhinho tranquilo 🐰',
            'Conto para relaxar o corpo e preparar o sono profundo.',
            5
        ),
        (
            'Protocolo do Sono Profundo 💤 Conto — A Estrelinha dos sonos ⭐',
            'História final para fechar os olhos com serenidade.',
            6
        )
) AS aula(title, description, sort_order)
WHERE cm.product_id = 'onda-prodigio'
  AND cm.sort_order = 3
  AND cm.parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM content_modules child
      WHERE child.parent_id = cm.id
  );
