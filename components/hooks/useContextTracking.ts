
import { useState, useRef, useEffect } from 'react';
import { ContextTracker } from '../../lib/context/context-tracker';
import { supabase } from '../../lib/supabaseClient';
import { log } from '../../lib/utils/logger';
import type { ConversationModelContextRecord, ContextUsage } from '@/lib/context/types';

export function useContextTracking(activeId: string, selectedModelId: string, selectedModel: { id: string; name: string; context_length: number } | null) {
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const contextTrackerRef = useRef<ContextTracker | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!activeId) {
      contextTrackerRef.current = null;
      setContextUsage(null);
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
          log.error('useContextTracking', 'Error fetching context', { error });
          contextTrackerRef.current = tracker;
          setContextUsage(tracker.getUsage());
          return;
        }

        if (contexts && contexts.length > 0) {
          contexts.forEach((record) => {
            const typedRecord = record as unknown as ConversationModelContextRecord;
            const recordModelName = typedRecord.model_id === modelId ? modelName : typedRecord.model_id;
            tracker.restoreFromDatabase(typedRecord, maxTokens, recordModelName);
          });

          contextTrackerRef.current = tracker;
          setContextUsage(tracker.getUsage());
        } else {
          contextTrackerRef.current = tracker;
          setContextUsage(tracker.getUsage());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeId, selectedModelId, selectedModel]);

  return { contextUsage, setContextUsage, contextTrackerRef };
}
