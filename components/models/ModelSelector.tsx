// ModelSelector Component
// Dropdown for selecting LLM models in chat interface
// Date: 2025-10-14
"use client";

import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Zap, Eye, Bot } from 'lucide-react';

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
  enabled: boolean;
  is_global: boolean;
}

interface ModelSelectorProps {
  value?: string;
  onChange: (modelId: string) => void;
  userId?: string;
  disabled?: boolean;
}

// ============================================================================
// ModelSelector Component
// ============================================================================

export function ModelSelector({ value, onChange, userId, disabled }: ModelSelectorProps) {
  const [models, setModels] = useState<LLMModelDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, [userId]);

  async function fetchModels() {
    console.log('[ModelSelector] Fetching models, userId:', userId);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/models', {
        headers: userId ? { 'Authorization': `Bearer ${userId}` } : {},
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

  // Group models by provider
  const modelsByProvider = models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, LLMModelDisplay[]>);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || loading}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder={loading ? "Loading..." : "Select model"} />
      </SelectTrigger>
      <SelectContent>
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

        {/* Separator */}
        <div className="my-1 border-t border-border" />

        {/* Error State */}
        {error && (
          <div className="px-2 py-1.5 text-sm text-destructive">
            Error: {error}
          </div>
        )}

        {/* Models List - Scrollable */}
        {!error && Object.entries(modelsByProvider).map(([provider, providerModels]) => (
          <div key={provider}>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
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
      </SelectContent>
    </Select>
  );
}

console.log('[ModelSelector] Component loaded');
