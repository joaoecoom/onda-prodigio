-- Clube — Módulo «Começa aqui»: aula Bem-vinda com vídeo MP4

ALTER TABLE content_modules ADD COLUMN IF NOT EXISTS video_path TEXT;

UPDATE content_modules
SET
    description = 'Começa por aqui — vê a mensagem de boas-vindas ao clube.',
    youtube_id = NULL,
    video_path = NULL,
    pdf_path = NULL,
    audio_path = NULL
WHERE product_id = 'clube-super-cerebros'
  AND sort_order = 1
  AND parent_id IS NULL;

INSERT INTO content_modules (product_id, parent_id, title, description, type, sort_order, video_path, image_url)
SELECT
    'clube-super-cerebros',
    cm.id,
    'Bem-vinda ☀️',
    'Neste vídeo a Dra. Elena Navarro apresenta-te o percurso de aprendizagem para os teus filhos e filhas. Descobre os desafios mensais que os ajudam a melhorar a concentração, desenvolver novas competências e tornarem-se verdadeiros super cérebros.',
    'video',
    1,
    '/comunidade/assets/videos/clube-bem-vinda.mp4',
    'comunidade/assets/modulos/clube/01-comeca-aqui.png'
FROM content_modules cm
WHERE cm.product_id = 'clube-super-cerebros'
  AND cm.sort_order = 1
  AND cm.parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM content_modules child WHERE child.parent_id = cm.id
  );
