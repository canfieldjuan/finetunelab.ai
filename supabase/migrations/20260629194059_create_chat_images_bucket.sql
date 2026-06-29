-- Private Storage bucket for chat-generated images (gap #3, slice 3ii).
-- Images are stored under a per-user prefix (`<user_id>/<uuid>.<ext>`, see
-- lib/tools/image-gen/storage.ts), so the storage.objects policies restrict
-- each user to their own folder. The bucket is private; the app hands out
-- short-lived signed URLs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "chat-images: users upload to own folder" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "chat-images: users read own files" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'chat-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "chat-images: users delete own files" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'chat-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
