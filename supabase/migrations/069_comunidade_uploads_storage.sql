-- Ficheiros uploadados pelo editor de conteúdo (PDF, vídeo, áudio, imagens)

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('comunidade-uploads', 'comunidade-uploads', true, 52428800)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "Public read comunidade uploads" ON storage.objects;

CREATE POLICY "Public read comunidade uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'comunidade-uploads');
