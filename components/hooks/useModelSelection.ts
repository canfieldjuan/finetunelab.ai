
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { log } from '../../lib/utils/logger';
import { useAuth } from '../../contexts/AuthContext';

export function useModelSelection() {
  const { user, session } = useAuth();
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<{ id: string; name: string; context_length: number } | null>(null);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load user's default model from settings
  useEffect(() => {
    const loadDefaultModel = async () => {
      if (!user || !session?.access_token || isInitialized) return;

      try {
        const response = await fetch('/api/settings', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.settings?.defaultModelId) {
            log.info('useModelSelection', 'Loaded default model from settings', {
              modelId: data.settings.defaultModelId,
            });
            setSelectedModelId(data.settings.defaultModelId);
          } else {
            log.info('useModelSelection', 'No default model set in settings, using __default__');
            setSelectedModelId("__default__");
          }
        } else {
          log.warn('useModelSelection', 'Failed to load settings, using __default__');
          setSelectedModelId("__default__");
        }
      } catch (err) {
        log.error('useModelSelection', 'Error loading default model', { error: err });
        setSelectedModelId("__default__");
      } finally {
        setIsInitialized(true);
      }
    };

    loadDefaultModel();
  }, [user, session?.access_token, isInitialized]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const { data, error } = await supabase.from('llm_models').select('id, name, context_length');
        if (error) {
          console.error('[useModelSelection] Supabase error:', error);
          throw error;
        }
        setAvailableModels(data || []);

        // If we have a selected model ID but no model object, find it
        if (selectedModelId && selectedModelId !== "__default__" && !selectedModel && data) {
          const model = data.find((m: { id: string; name: string; context_length: number }) => m.id === selectedModelId);
          if (model) {
            setSelectedModel(model);
          }
        }
      } catch (err: unknown) {
        console.error('[useModelSelection] Raw error object:', err);
        console.error('[useModelSelection] Error details:', {
          message: err instanceof Error ? err.message : 'Unknown error',
          code: (err as { code?: string })?.code,
          details: (err as { details?: unknown })?.details,
          hint: (err as { hint?: string })?.hint,
          name: err instanceof Error ? err.name : 'Unknown',
          stack: err instanceof Error ? err.stack : undefined
        });

        log.error('useModelSelection', 'Error fetching models', {
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
          errorCode: (err as { code?: string })?.code,
          errorDetails: (err as { details?: unknown })?.details,
          errorHint: (err as { hint?: string })?.hint,
          errorName: err instanceof Error ? err.name : 'Unknown'
        });
      }
    };

    fetchModels();
  }, [selectedModelId, selectedModel]);

  const handleModelChange = (modelId: string, model?: { id: string; name: string; context_length: number }) => {
    setSelectedModelId(modelId);
    setSelectedModel(model || null);
  };

  return {
    selectedModelId: selectedModelId || "__default__",
    selectedModel,
    availableModels,
    handleModelChange,
  };
}
