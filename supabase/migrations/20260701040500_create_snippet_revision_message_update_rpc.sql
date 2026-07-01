-- Atomic assistant-message update for snippet revision persistence.
-- Keeps the expected full message content in the RPC body instead of a
-- PostgREST query-string filter, and binds the update to auth.uid().

CREATE OR REPLACE FUNCTION public.update_assistant_message_content_if_current(
  p_message_id UUID,
  p_conversation_id UUID,
  p_expected_content TEXT,
  p_updated_content TEXT
)
RETURNS TABLE(id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.messages AS messages
  SET content = p_updated_content
  WHERE messages.id = p_message_id
    AND messages.conversation_id = p_conversation_id
    AND messages.user_id = auth.uid()
    AND messages.role = 'assistant'
    AND messages.content = p_expected_content
  RETURNING messages.id;
END;
$$;

COMMENT ON FUNCTION public.update_assistant_message_content_if_current(
  UUID,
  UUID,
  TEXT,
  TEXT
) IS 'Atomically updates an owned assistant message only when its content still matches the expected snippet-revision source.';
