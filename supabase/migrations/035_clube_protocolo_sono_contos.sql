-- Clube — Módulo 2: Protocolo do Sono Profundo (6 contos, igual Onda Prodígio)

UPDATE content_modules
SET
    description = 'Bónus exclusivo do clube: seis contos para noites tranquilas e sono reparador.',
    type = 'video',
    youtube_id = NULL,
    video_path = NULL,
    pdf_path = NULL,
    audio_path = NULL
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 2
  AND parent_id IS NULL;

INSERT INTO content_modules (product_id, parent_id, title, description, type, sort_order, youtube_id, image_url, unlock_after_days)
SELECT
    'clube-super-cerebros',
    cm.id,
    aula.title,
    aula.description,
    'video',
    aula.sort_order,
    aula.youtube_id,
    'comunidade/assets/modulos/clube/02-protocolo-sono.png',
    0
FROM content_modules cm
CROSS JOIN (
    VALUES
        (
            'Protocolo do Sono Profundo 💤 HISTÓRIA 1 "O Coala Kiko que Não Queria Dormir" 🐨 — Para Crianças',
            'O conto ideal para a criança que resiste à hora de deitar. Na floresta de eucaliptos, Kiko descobre que o sono é como uma bateria dourada que recarrega o corpo — e que descansar é o passo mais importante para acordar cheio de energia.',
            1,
            'zb7RCO77SUk'
        ),
        (
            'Protocolo do Sono Profundo 💤 HISTÓRIA 2 "O Cachorrinho Tobias e o Lugar Onde o Coração Descansa" 🐶 — Para Crianças',
            'Perfeito para momentos em que a criança precisa de se sentir protegida antes de adormecer. Tobias percorre a pequena vila até encontrar o lugar onde o coração descansa — porque o verdadeiro lar é onde nos sentimos em paz.',
            2,
            'DFO8651JhdE'
        ),
        (
            'Protocolo do Sono Profundo 💤 HISTÓRIA 3 "O Capivara e a Coragem de Dormir Sozinho" 🦫 — Para Crianças',
            'O recurso certo para quem tem medo de dormir sozinho. Junto ao rio e à toca, a Capivara descobre que a luz dourada da coragem já vive dentro dela — e que pode adormecer em segurança.',
            3,
            'nWKwlXi-7SM'
        ),
        (
            'Protocolo do Sono Profundo 💤 HISTÓRIA 4 "O Eco do Quarto Vazio" 🍃',
            'Ideal para adolescentes que ficam inquietos quando tudo fica em silêncio. Esta história mostra que o silêncio não está vazio — é um espaço de descanso, como folhas leves que o vento conduz suavemente até ao sono.',
            4,
            'x2BekULPuU0'
        ),
        (
            'Protocolo do Sono Profundo 💤 HISTÓRIA 5 "A Luz que Ficou Acesa" 💡',
            'Perfeito para quem não consegue desligar a mente à hora de deitar. A história convida a apagar, uma a uma, as pequenas luzes dos pensamentos — até restar apenas a calma necessária para dormir.',
            5,
            '1CTvfwAHuMM'
        ),
        (
            'Protocolo do Sono Profundo 💤 HISTÓRIA 6 "A Ponte que Só Aparece de Noite" 🌉',
            'O recurso ideal para momentos em que as dúvidas e perguntas impedem o descanso. Esta história ensina que não precisamos de ter todas as respostas de imediato — a ponte iluminada pela Lua mostra apenas o próximo passo, ajudando a confiar, largar o controlo e encontrar calma mental profunda para descansar.',
            6,
            'tTzhR0y1KaI'
        )
) AS aula(title, description, sort_order, youtube_id)
WHERE cm.product_id = 'clube-super-cerebros'
  AND cm.sort_order = 2
  AND cm.parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM content_modules child WHERE child.parent_id = cm.id
  );
