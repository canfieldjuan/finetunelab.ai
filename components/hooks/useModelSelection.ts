
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { log } from '../../lib/utils/logger';

export function useModelSelection() {
  const [selectedModelId, setSelectedModelId] = useState<string>("__default__");
  const [selectedModel, setSelectedModel] = useState<{ id: string; name: string; context_length: number } | null>(null);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const { data, error } = await supabase.from('llm_models').select('id, name');
        if (error) {
          console.error('[useModelSelection] Supabase error:', error);
          throw error;
        }
        setAvailableModels(data || []);
      } catch (err: any) {
        console.error('[useModelSelection] Raw error object:', err);
        console.error('[useModelSelection] Error details:', {
          message: err?.message,
          code: err?.code,
          details: err?.details,
          hint: err?.hint,
          name: err?.name,
          stack: err?.stack
        });

        log.error('useModelSelection', 'Error fetching models', {
          errorMessage: err?.message || 'Unknown error',
          errorCode: err?.code,
          errorDetails: err?.details,
          errorHint: err?.hint,
          errorName: err?.name
        });
      }
    };

    fetchModels();
  }, []);

  const handleModelChange = (modelId: string, model?: { id: string; name: string; context_length: number }) => {
    setSelectedModelId(modelId);
    setSelectedModel(model || null);
  };

  return {
    selectedModelId,
    selectedModel,
    availableModels,
    handleModelChange,
  };
}
