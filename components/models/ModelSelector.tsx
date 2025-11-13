// ModelSelector Component
// Dropdown for selecting LLM models in chat interface
// Date: 2025-10-14
"use client";

import React, { useEffect, useState } from 'react';
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

  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, [sessionToken]);

  async function fetchModels() {
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ModelSelector] Error fetching models:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  // Filter models by search query
  const filteredModels = models.filter(model =>
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

  return (
    <Select value={value || "__default__"} onValueChange={handleModelChange} disabled={disabled || loading}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder={loading ? "Loading..." : "Select model"} />
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        {/* Manage Models Link */}
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open('/models', '_blank');
          }}
          className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-accent rounded-sm transition-colors"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              window.open('/models', '_blank');
            }
          }}
        >
          <Bot className="w-4 h-4 text-primary" />
          <span className="font-medium">Manage Models</span>
        </div>

        {/* Search Input */}
        <div className="px-2 py-2 border-b border-border">
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
          <SelectItem value="__default__">
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
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase sticky top-0 bg-background">
                {provider}
              </div>
              {providerModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    <span>{model.name}</span>
                    <div className="flex gap-0.5">
                      {model.supports_streaming && (
                        <Zap className="w-3 h-3 text-green-500" />
                      )}
                      {model.supports_functions && (
                        <Sparkles className="w-3 h-3 text-blue-500" />
                      )}
                      {model.supports_vision && (
                        <Eye className="w-3 h-3 text-purple-500" />
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
