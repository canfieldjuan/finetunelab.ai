/**
 * Step1ModelSelection Component
 * Model selection step for training package workflow
 * Supports: Popular models, HuggingFace search, local models
 * Date: 2025-01-31
 * Phase 2: Step Components Implementation
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Check, Loader2, AlertCircle } from 'lucide-react';
import { type Step1Config } from './Step1ModelSelection.schema';
import { searchModels } from '@/lib/training/model-browser';
import { createLogger } from '@/lib/logging';
import type {
  Step1ModelData,
  ModelInfo,
  ModelSource,
  ModelSearchFilters,
  StepId
} from './types';

const logger = createLogger('Step1ModelSelection');

/**
 * Component props
 */
interface Step1ModelSelectionProps {
  stepId: StepId;
  initialData?: Step1ModelData | null;
  onComplete: (stepId: StepId, data: Step1ModelData) => void;
  onValidationChange?: (isValid: boolean) => void;
}

/**
 * Display mode for model list
 */
type ViewMode = 'grid' | 'list';

/**
 * Component state for model selection
 */
interface ComponentState {
  // Configuration
  config: Step1Config | null;

  // Models
  popularModels: ModelInfo[];
  searchResults: ModelInfo[];

  // UI state
  isLoadingPopular: boolean;
  isSearching: boolean;
  searchQuery: string;
  viewMode: ViewMode;

  // Selection
  selectedModel: ModelInfo | null;
  modelSource: ModelSource;

  // Error handling
  error: string | null;
}

/**
 * Step1ModelSelection Component
 */
export function Step1ModelSelection({
  stepId,
  initialData,
  onComplete,
  onValidationChange,
}: Step1ModelSelectionProps) {
  logger.info('Component rendered', { stepId, hasInitialData: !!initialData });

  // Component state
  const [state, setState] = useState<ComponentState>({
    config: null,
    popularModels: [],
    searchResults: [],
    isLoadingPopular: false,
    isSearching: false,
    searchQuery: '',
    viewMode: 'grid',
    selectedModel: initialData?.modelInfo || null,
    modelSource: initialData?.source || 'popular',
    error: null,
  });

  // Destructure for easier access
  const {
    config,
    popularModels,
    searchResults,
    isLoadingPopular,
    isSearching,
    searchQuery,
    selectedModel,
    modelSource,
    error,
  } = state;

  /**
   * Load configuration and popular models on mount
   */
  useEffect(() => {
    async function loadInitialData() {
      try {
        logger.info('Loading configuration and popular models');
        setState(prev => ({ ...prev, isLoadingPopular: true, error: null }));

        // Load configuration from API (server-side)
        const configResponse = await fetch('/api/training/workflow/step1-config');
        if (!configResponse.ok) {
          throw new Error('Failed to load configuration');
        }

        const configData = await configResponse.json();
        if (!configData.success) {
          throw new Error(configData.error || 'Configuration load failed');
        }

        const loadedConfig = configData.config as Step1Config;
        logger.info('Configuration loaded', {
          popularModelsCount: loadedConfig.popularModels.length,
          hfSearchEnabled: loadedConfig.features.enableHFSearch,
        });

        // Convert popular models from config to ModelInfo format
        const models: ModelInfo[] = loadedConfig.popularModels.map(model => ({
          id: model.id,
          name: model.name,
          author: model.author,
          sizeGB: model.sizeGB,
          isCached: false,
          supportsChatTemplate: model.supportsChatTemplate,
          supportsLoRA: model.supportsLoRA,
          parameterCount: model.parameterCount,
          description: model.description,
        }));

        logger.info('Popular models loaded', { count: models.length });

        setState(prev => ({
          ...prev,
          config: loadedConfig,
          popularModels: models,
          isLoadingPopular: false,
        }));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load models';
        logger.error('Failed to load initial data', err as Error);
        setState(prev => ({
          ...prev,
          isLoadingPopular: false,
          error: errorMsg,
        }));
      }
    }

    loadInitialData();
  }, []);

  /**
   * Handle search with debouncing
   */
  useEffect(() => {
    if (!config?.features.enableHFSearch) {
      return; // Search disabled
    }

    if (!searchQuery.trim()) {
      // Clear search results when query is empty
      setState(prev => ({ ...prev, searchResults: [], modelSource: 'popular' }));
      return;
    }

    if (searchQuery.length < (config?.limits.minNameLength || 3)) {
      return; // Query too short
    }

    // Debounce search
    const timeoutId = setTimeout(async () => {
      try {
        logger.info('Searching models', { query: searchQuery });
        setState(prev => ({ ...prev, isSearching: true, error: null }));

        const filters: ModelSearchFilters = {
          query: searchQuery,
          limit: config?.limits.defaultPageSize || 10,
        };

        const results = await searchModels(filters, config || undefined);
        logger.info('Search results received', { count: results.length });

        setState(prev => ({
          ...prev,
          searchResults: results,
          isSearching: false,
          modelSource: 'hf_search',
        }));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Search failed';
        logger.error('Search failed', err as Error);
        setState(prev => ({
          ...prev,
          isSearching: false,
          error: errorMsg,
        }));
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, config]);

  /**
   * Notify parent of validation state changes
   */
  useEffect(() => {
    const isValid = selectedModel !== null;
    onValidationChange?.(isValid);
  }, [selectedModel, onValidationChange]);

  /**
   * Handle model selection
   */
  const handleModelSelect = useCallback((model: ModelInfo) => {
    logger.info('Model selected', { modelId: model.id, source: modelSource });

    setState(prev => ({
      ...prev,
      selectedModel: model,
    }));

    // Create step data
    const stepData: Step1ModelData = {
      source: modelSource,
      modelInfo: model,
      selectedAt: new Date(),
    };

    // Notify parent (wizard will handle completion)
    onComplete(stepId, stepData);
  }, [stepId, modelSource, onComplete]);

  /**
   * Get models to display (search results or popular)
   */
  const modelsToDisplay = useMemo(() => {
    if (searchQuery.trim() && searchResults.length > 0) {
      return searchResults;
    }
    return popularModels;
  }, [searchQuery, searchResults, popularModels]);

  /**
   * Render model card
   */
  const renderModelCard = useCallback((model: ModelInfo) => {
    const isSelected = selectedModel?.id === model.id;
    const sizeWarning = config && model.sizeGB > config.validation.warnSizeGB;

    return (
      <Card
        key={model.id}
        className={`cursor-pointer transition-all hover:border-primary ${
          isSelected ? 'border-primary ring-2 ring-primary/20' : ''
        }`}
        onClick={() => handleModelSelect(model)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate">{model.name}</CardTitle>
              <CardDescription className="text-sm truncate">
                {model.author || 'Unknown'}
              </CardDescription>
            </div>
            {isSelected && (
              <Check className="h-5 w-5 text-primary flex-shrink-0" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-xs">
              {model.sizeGB.toFixed(1)}GB
            </Badge>
            {model.supportsChatTemplate && (
              <Badge variant="outline" className="text-xs">Chat</Badge>
            )}
            {model.supportsLoRA && (
              <Badge variant="outline" className="text-xs">LoRA</Badge>
            )}
          </div>
          {model.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {model.description}
            </p>
          )}
          {sizeWarning && (
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              ⚠️ Large model ({model.sizeGB}GB)
            </p>
          )}
        </CardContent>
      </Card>
    );
  }, [selectedModel, config, handleModelSelect]);

  // Render component
  return (
    <div className="space-y-6">
      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search input */}
      {config?.features.enableHFSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search HuggingFace models..."
            value={searchQuery}
            onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
            className="pl-10"
            disabled={isLoadingPopular}
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
          )}
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {searchQuery.trim() ? 'Search Results' : 'Popular Models'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery.trim()
              ? `Found ${modelsToDisplay.length} models`
              : 'Recommended models for fine-tuning'}
          </p>
        </div>
      </div>

      {/* Loading state */}
      {isLoadingPopular && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Model grid */}
      {!isLoadingPopular && modelsToDisplay.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modelsToDisplay.map(model => renderModelCard(model))}
        </div>
      )}

      {/* No results */}
      {!isLoadingPopular && modelsToDisplay.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery.trim() ? 'No models found. Try a different search.' : 'No models available.'}
          </p>
        </div>
      )}
    </div>
  );
}
