/**
 * Model Selection Card
 * Purpose: Simple model selection for training workflow
 * Supports: Local models, HuggingFace models
 * Date: 2025-10-31
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  HardDrive,
  Globe,
  Search,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import type { ModelInfo } from '@/components/training/workflow/types';
import type { LocalModelInfo } from '@/lib/models/local-model-scanner';

/**
 * Selected model information (unified across sources)
 */
export interface SelectedModel {
  id: string;
  name: string;
  source: 'local' | 'huggingface';
  path?: string;           // For local models
  category?: string;       // For local models
  format?: string;         // For local models
  sizeGB?: number;         // For HF models
  author?: string;         // For HF models
}

interface ModelSelectionCardProps {
  onModelSelect: (model: SelectedModel | null) => void;
}

export function ModelSelectionCard({
  onModelSelect,
}: ModelSelectionCardProps) {
  const [activeTab, setActiveTab] = useState<'local' | 'huggingface'>('local');
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null);

  // Local models state
  const [localQuery, setLocalQuery] = useState('');
  const [localResults, setLocalResults] = useState<LocalModelInfo[]>([]);
  const [searchingLocal, setSearchingLocal] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // HuggingFace state
  const [hfQuery, setHfQuery] = useState('');
  const [hfResults, setHfResults] = useState<ModelInfo[]>([]);
  const [searchingHf, setSearchingHf] = useState(false);
  const [hfError, setHfError] = useState<string | null>(null);

  /**
   * Search local models with debouncing
   */
  useEffect(() => {
    if (!localQuery.trim() || localQuery.length < 3) {
      setLocalResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearchingLocal(true);
      setLocalError(null);

      try {
        const response = await fetch('/api/models/local');
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to load local models');
        }

        // Filter results based on search query
        const filtered = (data.models || []).filter((model: LocalModelInfo) => {
          // If a model is selected and search matches its name exactly, show ONLY that model
          if (selectedModel && selectedModel.source === 'local' && localQuery === selectedModel.name) {
            return model.id === selectedModel.id;
          }

          // Otherwise, use substring matching for search-as-you-type
          const query = localQuery.toLowerCase();
          return (
            model.name.toLowerCase().includes(query) ||
            model.category?.toLowerCase().includes(query) ||
            model.format?.toLowerCase().includes(query)
          );
        });

        setLocalResults(filtered);
        console.log('[ModelSelectionCard] Found', filtered.length, 'local models');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Search failed';
        console.error('[ModelSelectionCard] Local search error:', errorMsg);
        setLocalError(errorMsg);
      } finally {
        setSearchingLocal(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [localQuery, selectedModel]);

  /**
   * Search HuggingFace models with debouncing
   */
  useEffect(() => {
    if (!hfQuery.trim() || hfQuery.length < 3) {
      setHfResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearchingHf(true);
      setHfError(null);

      try {
        // Call API endpoint instead of direct import
        const response = await fetch(`/api/models/search?query=${encodeURIComponent(hfQuery)}&limit=20`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Search failed');
        }

        // Filter results: if model selected and query matches exactly, show only that model
        let results = data.models || [];
        if (selectedModel && selectedModel.source === 'huggingface' && hfQuery === selectedModel.name) {
          results = results.filter((model: ModelInfo) => model.id === selectedModel.id);
        }

        setHfResults(results);
        console.log('[ModelSelectionCard] Found', results.length, 'HF models');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Search failed';
        console.error('[ModelSelectionCard] HF search error:', errorMsg);
        setHfError(errorMsg);
      } finally {
        setSearchingHf(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [hfQuery, selectedModel]);

  /**
   * Handle model selection
   */
  function handleSelectLocal(model: LocalModelInfo) {
    const selected: SelectedModel = {
      id: model.id,
      name: model.name,
      source: 'local',
      path: model.path,
      category: model.category,
      format: model.format,
    };

    setSelectedModel(selected);
    onModelSelect(selected);
    setLocalQuery(model.name); // Fill search with selected model name
    console.log('[ModelSelectionCard] Selected local model:', selected.name);
  }

  function handleSelectHF(model: ModelInfo) {
    const selected: SelectedModel = {
      id: model.id,
      name: model.name,
      source: 'huggingface',
      sizeGB: model.sizeGB,
      author: model.author,
    };

    setSelectedModel(selected);
    setHfQuery(model.name); // Fill search with selected model name
    onModelSelect(selected);
    console.log('[ModelSelectionCard] Selected HF model:', selected.name);
  }

  function handleClearSelection() {
    setSelectedModel(null);
    onModelSelect(null);
    console.log('[ModelSelectionCard] Cleared selection');
  }

  /**
   * Format file size
   */
  function formatBytes(bytes?: number): string {
    if (!bytes) return 'Unknown';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  return (
    <div className="space-y-4">
      {/* Selected Model Display */}
      {selectedModel && (
          <Alert className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700">
            <Check className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <span className="font-medium">{selectedModel.name}</span>
                <Badge variant="outline" className="ml-2 text-xs">
                  {selectedModel.source}
                </Badge>
                {selectedModel.category && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {selectedModel.category}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
              >
                Change
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Model Source Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="local" className="flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Local
            </TabsTrigger>
            <TabsTrigger value="huggingface" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              HuggingFace
            </TabsTrigger>
          </TabsList>

          {/* Local Models Tab */}
          <TabsContent value="local" className="space-y-3 mt-4">
            {/* Compact Search Input */}
            <Input
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Search models..."
              className="text-sm"
            />

            {/* Search Results - Fixed height container to prevent layout shift */}
            <div className="h-[120px] overflow-hidden">
              {localError ? (
                <div className="h-full flex items-center justify-center">
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>{localError}</AlertDescription>
                  </Alert>
                </div>
              ) : localQuery.length < 3 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                  Type at least 3 characters
                </div>
              ) : searchingLocal ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 mb-2 animate-spin" />
                  <p className="text-xs">Searching...</p>
                </div>
              ) : localResults.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                  No models found for &quot;{localQuery}&quot;
                </div>
              ) : (
                <div className="space-y-2 h-full overflow-y-auto pr-2">
                  {localResults.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleSelectLocal(model)}
                    className={`w-full text-left p-2 rounded-md border transition-colors ${
                      selectedModel?.id === model.id
                        ? 'border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
                        : 'border-border hover:border-gray-400 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="font-medium text-sm truncate">{model.name}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{model.category}</span>
                          <span>•</span>
                          <span>{model.format}</span>
                          {model.sizeBytes && (
                            <>
                              <span>•</span>
                              <span>{formatBytes(model.sizeBytes)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {selectedModel?.id === model.id && (
                        <Check className="w-4 h-4 text-gray-700 dark:text-gray-300 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </button>
                ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* HuggingFace Tab */}
          <TabsContent value="huggingface" className="space-y-3 mt-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={hfQuery}
                onChange={(e) => setHfQuery(e.target.value)}
                placeholder="Search HuggingFace models..."
                className="pl-10"
              />
              {searchingHf && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Search Results */}
            {hfError ? (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{hfError}</AlertDescription>
              </Alert>
            ) : hfQuery.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Search for models on HuggingFace</p>
                <p className="text-xs mt-1">Try: llama, mistral, bert</p>
              </div>
            ) : hfQuery.length < 3 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Type at least 3 characters to search
              </div>
            ) : hfResults.length === 0 && !searchingHf ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No models found for &quot;{hfQuery}&quot;
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {hfResults.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleSelectHF(model)}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      selectedModel?.id === model.id
                        ? 'border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
                        : 'border-border hover:border-gray-400 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{model.name}</div>
                        {model.author && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            by {model.author}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {model.sizeGB ? `${model.sizeGB}GB` : 'Size unknown'}
                          {model.downloads && ` • ${model.downloads.toLocaleString()} downloads`}
                        </div>
                      </div>
                      {selectedModel?.id === model.id && (
                        <Check className="w-5 h-5 text-gray-700 dark:text-gray-300 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
    </div>
  );
}
