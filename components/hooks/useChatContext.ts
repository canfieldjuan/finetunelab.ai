
import { useRef, useEffect } from 'react';
import { ContextTracker } from '../../lib/context/context-tracker';
import { supabase } from '../../lib/supabaseClient';
import { log } from '../../lib/utils/logger';
import type { ConversationModelContextRecord } from '@/lib/context/types';


/**
 * A hook for managing the chat context.
 * @param activeId - The active conversation ID.
 * @param selectedModelId - The ID of the selected model.
 * @param selectedModel - The selected model.
 * @returns A ref to the context tracker.
 */
export function useChatContext(activeId: string, selectedModelId: string, selectedModel: { id: string; name: string; context_length: number } | null) {
  const contextTrackerRef = useRef<ContextTracker | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!activeId) {
      contextTrackerRef.current = null;
      return;
    }

    const maxTokens = selectedModel?.context_length || 128000;
    const modelName = selectedModel?.name || 'Moderator';
    const modelId = selectedModelId === '__default__' ? null : selectedModelId;

    const tracker = new ContextTracker(
      activeId,
      modelId,
      maxTokens,
      {},
      modelName
    );

    supabase
      .from('conversation_model_contexts')
      .select('*')
      .eq('conversation_id', activeId)
      .order('last_message_at', { ascending: false }).limit(25).then(({ data: contexts, error }) => {
        if (cancelled) return;

        if (error) {
          log.error('useChatContext', 'Error fetching context', { error });
          contextTrackerRef.current = tracker;
          return;
        }

        if (contexts && contexts.length > 0) {
          contexts.forEach((record) => {
            const typedRecord = record as unknown as ConversationModelContextRecord;
            const recordModelName = typedRecord.model_id === modelId ? modelName : typedRecord.model_id;
            tracker.restoreFromDatabase(typedRecord, maxTokens, recordModelName);
          });

          contextTrackerRef.current = tracker;
        } else {
          contextTrackerRef.current = tracker;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeId, selectedModelId, selectedModel]);

  return { contextTrackerRef };
}
