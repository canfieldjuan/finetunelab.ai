/**
 * Model Browser Service
 *
 * Provides HuggingFace model search, browsing, and caching functionality.
 * Uses configuration from Step1ModelSelection.config.yaml
 *
 * @module lib/training/model-browser
 * @created 2025-01-31
 */

import { createLogger } from '@/lib/logging';
import { loadComponentConfig } from '@/lib/config/yaml-loader';
import { step1ConfigSchema, type Step1Config } from '@/components/training/workflow/Step1ModelSelection.schema';
import type { ModelInfo, ModelSearchFilters } from '@/components/training/workflow/types';

/**
 * Logger instance for this service
 */
const logger = createLogger('ModelBrowser');

/**
 * Service configuration (loaded from YAML)
 */
let config: Step1Config | null = null;

/**
 * In-memory cache for model search results
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Load configuration from YAML file
 *
 * @throws Error if config fails to load or validate
 */
function loadConfig(): Step1Config {
  if (config) {
    return config;
  }

  try {
    logger.info('Loading Step1ModelSelection configuration');
    config = loadComponentConfig<Step1Config>('Step1ModelSelection', step1ConfigSchema);
    logger.info('Configuration loaded successfully', {
      popularModels: config.popularModels.length,
      cacheEnabled: config.cache.enabled,
    });
    return config;
  } catch (error) {
    logger.error('Failed to load configuration', error as Error);
    throw error;
  }
}

/**
 * Generate cache key for a request
 */
function getCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${JSON.stringify(params[key])}`)
    .join('|');
  return `${prefix}:${sortedParams}`;
}

/**
 * Get data from cache if not expired
 */
function getCached<T>(key: string, cfg: Step1Config): T | null {
  if (!cfg.cache.enabled) {
    return null;
  }

  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    return null;
  }

  const age = Date.now() - entry.timestamp;
  if (age > entry.ttl) {
    cache.delete(key);
    logger.debug('Cache expired', { key, age });
    return null;
  }

  logger.debug('Cache hit', { key });
  return entry.data;
}

/**
 * Store data in cache
 */
function setCache<T>(key: string, data: T, cfg: Step1Config, ttl?: number): void {
  if (!cfg.cache.enabled) {
    return;
  }

  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl: ttl ?? cfg.cache.ttl * 1000, // Convert seconds to milliseconds
  };

  cache.set(key, entry);

  // Enforce max cache size
  if (cache.size > cfg.cache.maxEntries) {
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
      logger.debug('Cache evicted oldest entry', { key: firstKey });
    }
  }

  logger.debug('Cache set', { key, ttl: entry.ttl });
}

/**
 * Get popular/featured models from configuration
 *
 * @returns Array of popular models with cache status
 */
export async function getPopularModels(): Promise<ModelInfo[]> {
  const cfg = loadConfig();

  logger.info('Fetching popular models', { count: cfg.popularModels.length });

  // Convert config models to ModelInfo format
  const models: ModelInfo[] = cfg.popularModels.map(model => ({
    id: model.id,
    name: model.name,
    author: model.author,
    sizeGB: model.sizeGB,
    isCached: false, // Will be checked by local detection if enabled
    supportsChatTemplate: model.supportsChatTemplate,
    supportsLoRA: model.supportsLoRA,
    parameterCount: model.parameterCount,
    description: model.description,
  }));

  logger.info('Popular models loaded', { count: models.length });

  return models;
}

/**
 * Search HuggingFace Hub for models
 *
 * @param filters - Search filters
 * @returns Array of matching models
 */
export async function searchModels(filters: ModelSearchFilters, config?: Step1Config): Promise<ModelInfo[]> {
  const cfg = config || loadConfig();

  if (!cfg.features.enableHFSearch) {
    logger.warn('HuggingFace search is disabled');
    return [];
  }

  // Check cache first
  const cacheKey = getCacheKey('search', filters as Record<string, unknown>);
  const cached = getCached<ModelInfo[]>(cacheKey, cfg);
  if (cached) {
    logger.info('Returning cached search results', { count: cached.length });
    return cached;
  }

  try {
    logger.info('Searching HuggingFace models', { filters });

    // Build query parameters
    const params = new URLSearchParams();
    if (filters.query) {
      params.append('search', filters.query);
    }
    params.append('limit', String(filters.limit ?? cfg.limits.defaultPageSize));

    // Add filter for text-generation models
    if (cfg.filters.allowedTaskTypes.length > 0) {
      params.append('filter', `task:${cfg.filters.allowedTaskTypes[0]}`);
    }

    // Add sort parameter
    if (filters.sort) {
      params.append('sort', filters.sort);
    }

    // Construct URL
    const url = `${cfg.api.baseUrl}${cfg.api.searchEndpoint}?${params.toString()}`;

    logger.debug('Fetching from HuggingFace API', { url });

    // Fetch with timeout and retries
    const response = await fetchWithRetry(url, cfg.api.timeout, cfg.api.retries, cfg);

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    logger.debug('HuggingFace API response received', {
      count: Array.isArray(data) ? data.length : 'unknown',
    });

    // Parse results to ModelInfo format
    const models: ModelInfo[] = (Array.isArray(data) ? data : []).map(parseHFModel).filter(Boolean) as ModelInfo[];

    // Apply client-side filters
    let filteredModels = models;

    if (filters.sizeMaxGB !== undefined) {
      filteredModels = filteredModels.filter(m => m.sizeGB <= filters.sizeMaxGB!);
    }

    if (filters.loraCompatible) {
      filteredModels = filteredModels.filter(m => m.supportsLoRA);
    }

    if (filters.chatCapable) {
      filteredModels = filteredModels.filter(m => m.supportsChatTemplate);
    }

    // Limit results
    const maxResults = Math.min(
      filteredModels.length,
      cfg.limits.maxSearchResults
    );
    const limitedModels = filteredModels.slice(0, maxResults);

    logger.info('Search complete', { found: models.length, filtered: limitedModels.length });

    // Cache results
    setCache(cacheKey, limitedModels, cfg);

    return limitedModels;
  } catch (error) {
    logger.error('Failed to search models', error as Error);
    throw error;
  }
}

/**
 * HuggingFace API model response structure
 */
interface HFModelResponse {
  id?: string;
  modelId?: string;
  name?: string;
  description?: string;
  summary?: string;
  tags?: string[];
  downloads?: number;
  likes?: number;
  lastModified?: string;
  size?: number;
  params?: number;
  safetensors?: {
    total?: number;
  };
}

/**
 * Parse HuggingFace API model response to ModelInfo
 */
function parseHFModel(hfModel: HFModelResponse): ModelInfo | null {
  try {
    // Extract model ID
    const id = hfModel.id || hfModel.modelId;
    if (!id) {
      logger.warn('Model missing ID', { model: hfModel });
      return null;
    }

    // Extract author from ID (format: "author/model-name")
    const [author, ...nameParts] = id.split('/');
    const modelName = nameParts.join('/') || id;

    // Estimate size from safetensors or model file info
    let sizeGB = 0;
    if (hfModel.safetensors?.total) {
      sizeGB = hfModel.safetensors.total / (1024 * 1024 * 1024); // Convert bytes to GB
    } else if (hfModel.size) {
      sizeGB = hfModel.size / (1024 * 1024 * 1024);
    } else {
      // Default estimate based on common model sizes
      sizeGB = 7; // Assume 7B model if no size info
    }

    // Detect capabilities from tags
    const tags = hfModel.tags || [];
    const supportsChatTemplate = tags.some((t: string) =>
      t.includes('chat') || t.includes('instruct') || t.includes('conversational')
    );

    const supportsLoRA = !tags.some((t: string) =>
      t.includes('gguf') || t.includes('quantized')
    ); // Assume LoRA supported unless quantized

    // Build ModelInfo object
    const modelInfo: ModelInfo = {
      id,
      name: hfModel.name || modelName,
      author: author || 'Unknown',
      sizeGB: Math.round(sizeGB * 10) / 10, // Round to 1 decimal place
      isCached: false,
      supportsChatTemplate,
      supportsLoRA,
      parameterCount: hfModel.params,
      description: hfModel.description || hfModel.summary,
      tags: tags.slice(0, 5), // Limit tags
      downloads: hfModel.downloads,
      likes: hfModel.likes,
      updatedAt: hfModel.lastModified ? new Date(hfModel.lastModified) : undefined,
    };

    return modelInfo;
  } catch (error) {
    logger.warn('Failed to parse HF model', { error, model: hfModel });
    return null;
  }
}

/**
 * Fetch with timeout and retry logic
 *
 * @param url - URL to fetch
 * @param timeout - Timeout in milliseconds
 * @param retries - Number of retries
 * @param cfg - Configuration object
 * @returns Response object
 */
async function fetchWithRetry(url: string, timeout: number, retries: number, cfg: Step1Config): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'TrainingPackageWizard/1.0',
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      const isLastAttempt = attempt === retries;

      if (isLastAttempt) {
        logger.error('Fetch failed after all retries', { url, attempts: attempt + 1, error });
        throw error;
      }

      logger.warn('Fetch failed, retrying', { url, attempt: attempt + 1, retries });

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, cfg.api.retryDelay * (attempt + 1)));
    }
  }

  throw new Error('Fetch failed: Unexpected error');
}
