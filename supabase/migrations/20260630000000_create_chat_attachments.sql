-- Private, message-scoped chat attachments.
-- These rows are intentionally separate from GraphRAG documents: an attachment
-- supplies bounded context to one chat turn and is not ingested into the user's
-- durable knowledge graph unless a future explicit promotion flow does that.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  filename TEXT NOT NULL CHECK (length(filename) > 0),
  content_type TEXT,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  storage_bucket TEXT NOT NULL DEFAULT 'chat-attachments',
  storage_path TEXT NOT NULL,
  kind TEXT NOT NULL,
  extracted_text TEXT,
  extracted_chars INTEGER NOT NULL DEFAULT 0 CHECK (extracted_chars >= 0),
  status TEXT NOT NULL DEFAULT 'uploaded',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (storage_bucket, storage_path)
);

ALTER TABLE public.chat_attachments
  ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS extracted_chars INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.chat_attachments
   SET extracted_chars = 0
 WHERE extracted_chars IS NULL;

UPDATE public.chat_attachments
   SET status = 'uploaded'
 WHERE status IS NULL;

UPDATE public.chat_attachments
   SET metadata = '{}'::jsonb
 WHERE metadata IS NULL;

UPDATE public.chat_attachments
   SET updated_at = COALESCE(updated_at, NOW());

ALTER TABLE public.chat_attachments
  ALTER COLUMN extracted_chars SET DEFAULT 0,
  ALTER COLUMN extracted_chars SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'uploaded',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'chat_attachments_kind_check'
       AND conrelid = 'public.chat_attachments'::regclass
  ) THEN
    ALTER TABLE public.chat_attachments
      ADD CONSTRAINT chat_attachments_kind_check
      CHECK (kind IN ('text', 'document', 'code', 'image', 'unknown'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'chat_attachments_status_check'
       AND conrelid = 'public.chat_attachments'::regclass
  ) THEN
    ALTER TABLE public.chat_attachments
      ADD CONSTRAINT chat_attachments_status_check
      CHECK (status IN ('uploaded', 'attached', 'deleted'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_attachments_user_id
  ON public.chat_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_conversation_id
  ON public.chat_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id
  ON public.chat_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_status
  ON public.chat_attachments(status);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_created_at
  ON public.chat_attachments(created_at DESC);

ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_attachments_select_own ON public.chat_attachments;
CREATE POLICY chat_attachments_select_own
  ON public.chat_attachments
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS chat_attachments_insert_own ON public.chat_attachments;
CREATE POLICY chat_attachments_insert_own
  ON public.chat_attachments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
        FROM public.conversations c
       WHERE c.id = chat_attachments.conversation_id
         AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_attachments_update_own ON public.chat_attachments;
CREATE POLICY chat_attachments_update_own
  ON public.chat_attachments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
        FROM public.conversations c
       WHERE c.id = chat_attachments.conversation_id
         AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_attachments_delete_own ON public.chat_attachments;
CREATE POLICY chat_attachments_delete_own
  ON public.chat_attachments
  FOR DELETE
  USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat-attachments: users upload to own folder" ON storage.objects;
CREATE POLICY "chat-attachments: users upload to own folder" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chat-attachments: users read own files" ON storage.objects;
CREATE POLICY "chat-attachments: users read own files" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chat-attachments: users delete own files" ON storage.objects;
CREATE POLICY "chat-attachments: users delete own files" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMENT ON TABLE public.chat_attachments IS
  'Private per-chat files attached to a user turn; separate from durable GraphRAG documents';
COMMENT ON COLUMN public.chat_attachments.message_id IS
  'Nullable because files upload before a user message row may exist';
COMMENT ON COLUMN public.chat_attachments.extracted_text IS
  'Bounded server-extracted text used as one-turn chat context';
