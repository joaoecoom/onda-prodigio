-- Módulo 3 — títulos e descrições dos 6 contos (layout «Informações da aula»)

UPDATE content_modules
SET
    title = 'Protocolo do Sono Profundo 💤 HISTÓRIA 1 "O Coala Kiko que Não Queria Dormir" 🐨 — Para Crianças',
    description = 'O conto ideal para a criança que resiste à hora de deitar. Na floresta de eucaliptos, Kiko descobre que o sono é como uma bateria dourada que recarrega o corpo — e que descansar é o passo mais importante para acordar cheio de energia.'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 1;

UPDATE content_modules
SET
    title = 'Protocolo do Sono Profundo 💤 HISTÓRIA 2 "O Cachorrinho Tobias e o Lugar Onde o Coração Descansa" 🐶 — Para Crianças',
    description = 'Perfeito para momentos em que a criança precisa de se sentir protegida antes de adormecer. Tobias percorre a pequena vila até encontrar o lugar onde o coração descansa — porque o verdadeiro lar é onde nos sentimos em paz.'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 2;

UPDATE content_modules
SET
    title = 'Protocolo do Sono Profundo 💤 HISTÓRIA 3 "O Capivara e a Coragem de Dormir Sozinho" 🦫 — Para Crianças',
    description = 'O recurso certo para quem tem medo de dormir sozinho. Junto ao rio e à toca, a Capivara descobre que a luz dourada da coragem já vive dentro dela — e que pode adormecer em segurança.'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 3;

UPDATE content_modules
SET
    title = 'Protocolo do Sono Profundo 💤 HISTÓRIA 4 "O Eco do Quarto Vazio" 🍃 — Para Adolescentes',
    description = 'Ideal para adolescentes que ficam inquietos quando tudo fica em silêncio. Esta história mostra que o silêncio não está vazio — é um espaço de descanso, como folhas leves que o vento conduz suavemente até ao sono.'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 4;

UPDATE content_modules
SET
    title = 'Protocolo do Sono Profundo 💤 HISTÓRIA 5 "A Luz que Ficou Acesa" 💡 — Para Adolescentes',
    description = 'Perfeito para quem não consegue desligar a mente à hora de deitar. A história convida a apagar, uma a uma, as pequenas luzes dos pensamentos — até restar apenas a calma necessária para dormir.'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 5;

UPDATE content_modules
SET
    title = 'Protocolo do Sono Profundo 💤 HISTÓRIA 6 "A Ponte que Só Aparece de Noite" 🌉 — Para Adolescentes',
    description = 'O recurso ideal para momentos em que as dúvidas e perguntas impedem o descanso. Esta história ensina que não precisamos de ter todas as respostas de imediato — a ponte iluminada pela Lua mostra apenas o próximo passo, ajudando a confiar, largar o controlo e encontrar calma mental profunda para descansar.'
WHERE product_id = 'onda-prodigio'
  AND parent_id = (
      SELECT id FROM content_modules
      WHERE product_id = 'onda-prodigio'
        AND sort_order = 3
        AND parent_id IS NULL
  )
  AND sort_order = 6;
