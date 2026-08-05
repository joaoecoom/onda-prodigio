-- Áudio do Módulo 2 — Método Onda Prodígio

ALTER TABLE content_modules ADD COLUMN IF NOT EXISTS audio_path TEXT;

UPDATE content_modules
SET
    audio_path = 'comunidade/assets/audio/metodo-onda-prodigio.mp3',
    description = 'INSTRUÇÕES

Duração: Só precisas de 7 minutos por dia para estimular a produção de oligodendrócitos (as células que aceleram a aprendizagem). Se quiseres potenciar os resultados e ver mudanças em menos tempo, deixa-o ouvir o áudio completo de 11 minutos.

Momento: Pode ouvi-lo durante o dia, mas o momento-chave é à noite. Ao dormir, o cérebro é muito mais receptivo, o que permite que o áudio trabalhe na reparação neuronal sem distracções.

Modo: Podes usar o altifalante do telemóvel ou auriculares. O teu filho pode ouvi-lo enquanto faz actividades tranquilas ou mesmo enquanto dorme; o áudio vai fortalecer o cérebro de forma automática.'
WHERE product_id = 'onda-prodigio'
  AND title = '🧠 Método Onda Prodígio'
  AND parent_id IS NULL;
