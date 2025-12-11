// ModelSelector Component
// Dropdown for selecting LLM models in chat interface
// Date: 2025-10-14
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Zap, Eye, Bot, Search } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface LLMModelDisplay {
  id: string;
  name: string;
  provider: string;
  supports_streaming: boolean;
  supports_functions: boolean;
  supports_vision: boolean;
  context_length: number;
  enabled: boolean;
  is_global: boolean;
  is_default?: boolean;
}

interface ModelSelectorProps {
  value?: string;
  onChange: (modelId: string, model?: LLMModelDisplay) => void;
  sessionToken?: string;  // Changed from userId to use actual JWT token
  disabled?: boolean;
}

// ============================================================================
// ModelSelector Component
// ============================================================================

export function ModelSelector({ value, onChange, sessionToken, disabled }: ModelSelectorProps) {
  const [models, setModels] = useState<LLMModelDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchModels = useCallback(async () => {
    console.log('[ModelSelector] Fetching models, authenticated:', !!sessionToken);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/models', {
        headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load models');
      }

      console.log('[ModelSelector] Loaded', data.models.length, 'models');
      setModels(data.models);

      // Auto-select default model if no model is currently selected
      if (!value || value === '__default__') {
        const defaultModel = data.models.find((m: LLMModelDisplay) => m.is_default);
        if (defaultModel) {
          console.log('[ModelSelector] Auto-selecting default model:', defaultModel.name);
          onChange(defaultModel.id, defaultModel);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ModelSelector] Error fetching models:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [sessionToken, value, onChange]);

  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Filter models: exclude global models, only show user-added models
  // Then apply search query filter
  const filteredModels = models
    .filter(model => !model.is_global) // Only show user's own models
    .filter(model =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Group filtered models by provider
  const modelsByProvider = filteredModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, LLMModelDisplay[]>);

  const handleModelChange = (modelId: string) => {
    const selectedModel = models.find(m => m.id === modelId);
    console.log('[ModelSelector] Model changed:', {
      modelId,
      modelName: selectedModel?.name,
      contextLength: selectedModel?.context_length
    });
    onChange(modelId, selectedModel);
  };

  const selectedModel = models.find(m => m.id === value);
  const isGPT5Pro = value === 'gpt-5-pro';

  return (
    <Select value={value || "__default__"} onValueChange={handleModelChange} disabled={disabled || loading}>
      <SelectTrigger 
        variant="ghost" 
        className={`[&>svg]:rotate-0 data-[state=open]:[&>svg]:rotate-0 ${isGPT5Pro ? 'border-amber-400 dark:border-amber-600' : ''}`}
        title={isGPT5Pro ? '⚠️ Premium Model - 10x cost. Use for LLM-as-a-Judge only.' : undefined}
      >
        <SelectValue placeholder={loading ? "Loading..." : "Select model"} />
        {isGPT5Pro && <span className="ml-1 text-amber-500">💰</span>}
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        {/* Manage Models Link */}
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open('/models', '_blank');
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-muted rounded-sm transition-colors text-xs"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              window.open('/models', '_blank');
            }
          }}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Manage Models</span>
        </div>

        {/* Search Input */}
        <div className="px-2.5 py-1.5 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full pl-7 pr-2 py-1 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="px-2 py-1.5 text-sm text-destructive">
            Error: {error}
          </div>
        )}

        {/* Default Model Option */}
        <div className="border-b border-border">
          <SelectItem value="__default__" className="pl-4">
            <span className="font-medium">Moderator</span>
          </SelectItem>
        </div>

        {/* Empty State */}
        {!error && filteredModels.length === 0 && (
          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
            {searchQuery ? 'No models match your search' : 'No models available'}
          </div>
        )}

        {/* Models List - Scrollable */}
        <div className="max-h-[250px] overflow-y-auto">
          {!error && Object.entries(modelsByProvider).map(([provider, providerModels]) => (
            <div key={provider}>
              <div className="px-2.5 py-1.5 text-xs font-semibold text-muted-foreground uppercase sticky top-0 bg-background">
                {provider}
              </div>
              {providerModels.map((model) => (
                <SelectItem key={model.id} value={model.id} className="pl-4">
                  <div className="flex items-center gap-2">
                    <span className={model.id === 'gpt-5-pro' ? 'font-semibold' : ''}>{model.name}</span>
                    <div className="flex gap-0.5">
                      {model.id === 'gpt-5-pro' && (
                        <span className="text-amber-500 text-xs font-bold" title="Premium pricing - 10x cost">💰</span>
                      )}
                      {model.supports_streaming && (
                        <Zap className="w-3 h-3" />
                      )}
                      {model.supports_functions && (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {model.supports_vision && (
                        <Eye className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </div>
          ))}
        </div>
      </SelectContent>
    </Select>
  );
}

console.log('[ModelSelector] Component loaded');
