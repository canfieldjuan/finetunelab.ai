/**
 * Zod Schema for Step1ModelSelection Configuration
 *
 * Provides runtime type validation for the YAML configuration file
 *
 * @module components/training/workflow/Step1ModelSelection.schema
 * @created 2025-01-31
 */

import { z } from 'zod';

/**
 * Popular model schema
 */
const popularModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  author: z.string().min(1),
  sizeGB: z.number().positive(),
  category: z.enum(['small', 'medium', 'large']),
  supportsChatTemplate: z.boolean(),
  supportsLoRA: z.boolean(),
  parameterCount: z.number().positive(),
  description: z.string().optional(),
});

/**
 * Category schema
 */
const categorySchema = z.object({
  label: z.string(),
  description: z.string(),
  maxSizeGB: z.number().positive(),
  icon: z.string(),
});

/**
 * Size category schema
 */
const sizeCategorySchema = z.object({
  label: z.string(),
  max: z.number().positive(),
});

/**
 * Sort option schema
 */
const sortOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
});

/**
 * Main configuration schema
 */
export const step1ConfigSchema = z.object({
  api: z.object({
    baseUrl: z.string().url(),
    modelsEndpoint: z.string(),
    searchEndpoint: z.string(),
    timeout: z.number().positive(),
    retries: z.number().int().min(0),
    retryDelay: z.number().positive(),
  }),

  popularModels: z.array(popularModelSchema).min(1),

  categories: z.record(z.string(), categorySchema),

  limits: z.object({
    maxSearchResults: z.number().int().positive(),
    maxPopularModels: z.number().int().positive(),
    minNameLength: z.number().int().positive(),
    maxPageSize: z.number().int().positive(),
    defaultPageSize: z.number().int().positive(),
  }),

  filters: z.object({
    allowedTaskTypes: z.array(z.string()).min(1),
    minDownloads: z.number().int().min(0),
    minLikes: z.number().int().min(0),
    sizeCategories: z.array(sizeCategorySchema),
  }),

  cache: z.object({
    enabled: z.boolean(),
    ttl: z.number().int().positive(),
    maxEntries: z.number().int().positive(),
    localModelCheckInterval: z.number().int().positive(),
  }),

  ui: z.object({
    showDownloadCount: z.boolean(),
    showLikes: z.boolean(),
    showAuthor: z.boolean(),
    showSize: z.boolean(),
    showLastUpdated: z.boolean(),
    showDescription: z.boolean(),
    defaultView: z.enum(['grid', 'list']),
    cardsPerRow: z.number().int().positive(),
    cardMinHeight: z.number().int().positive(),
    searchDebounceMs: z.number().int().min(0),
    skeletonCards: z.number().int().positive(),
  }),

  validation: z.object({
    warnSizeGB: z.number().positive(),
    maxSizeGB: z.number().positive(),
    confirmSizeGB: z.number().positive(),
  }),

  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    logSearchQueries: z.boolean(),
    logModelSelections: z.boolean(),
    logCacheHits: z.boolean(),
    includeTimestamps: z.boolean(),
  }),

  features: z.object({
    enableLocalModelDetection: z.boolean(),
    enableHFSearch: z.boolean(),
    enableUpload: z.boolean(),
    enableSizeWarnings: z.boolean(),
    enableCategoryFilters: z.boolean(),
    enableSortOptions: z.boolean(),
  }),

  sortOptions: z.array(sortOptionSchema).min(1),
});

/**
 * Infer TypeScript type from schema
 */
export type Step1Config = z.infer<typeof step1ConfigSchema>;
