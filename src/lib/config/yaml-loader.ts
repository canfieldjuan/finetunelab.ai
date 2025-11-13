/**
 * YAML Configuration Loader Utility
 *
 * Provides centralized YAML configuration loading with:
 * - Schema validation using Zod
 * - Caching for performance
 * - Type-safe configuration access
 * - Comprehensive error handling
 *
 * @module lib/config/yaml-loader
 * @created 2025-01-31
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';

/**
 * Configuration cache to avoid repeated file reads
 */
const configCache = new Map<string, unknown>();

/**
 * Base configuration directory (relative to project root)
 */
const CONFIG_BASE_DIR = process.cwd();

/**
 * Load and parse a YAML configuration file
 *
 * @param relativePath - Path relative to project root or component directory
 * @param schema - Optional Zod schema for validation
 * @returns Parsed and validated configuration object
 * @throws Error if file not found, invalid YAML, or validation fails
 */
export function loadYamlConfig<T = unknown>(
  relativePath: string,
  schema?: z.ZodSchema<T>,
  options: LoadConfigOptions = {}
): T {
  const { useCache = true, throwOnError = true } = options;

  // Generate cache key
  const cacheKey = `yaml:${relativePath}`;

  // Check cache if enabled
  if (useCache && configCache.has(cacheKey)) {
    return configCache.get(cacheKey) as T;
  }

  try {
    // Resolve absolute path
    const absolutePath = path.isAbsolute(relativePath)
      ? relativePath
      : path.join(CONFIG_BASE_DIR, relativePath);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      const error = new Error(`Configuration file not found: ${relativePath}`);
      if (throwOnError) throw error;
      console.error('[yaml-loader] File not found:', relativePath);
      return {} as T;
    }

    // Read file content
    const fileContent = fs.readFileSync(absolutePath, 'utf8');

    // Parse YAML
    const parsedData = yaml.load(fileContent) as T;

    // Validate with schema if provided
    if (schema) {
      const validationResult = schema.safeParse(parsedData);

      if (!validationResult.success) {
        const error = new Error(
          `Configuration validation failed for ${relativePath}: ${validationResult.error.message}`
        );
        if (throwOnError) throw error;
        console.error('[yaml-loader] Validation failed:', validationResult.error.issues);
        return {} as T;
      }

      // Cache validated data
      if (useCache) {
        configCache.set(cacheKey, validationResult.data);
      }

      return validationResult.data;
    }

    // Cache parsed data (no validation)
    if (useCache) {
      configCache.set(cacheKey, parsedData);
    }

    return parsedData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[yaml-loader] Error loading config from ${relativePath}:`, errorMessage);

    if (throwOnError) throw error;
    return {} as T;
  }
}

/**
 * Configuration loader options
 */
export interface LoadConfigOptions {
  /**
   * Enable caching (default: true)
   */
  useCache?: boolean;

  /**
   * Throw errors instead of returning empty object (default: true)
   */
  throwOnError?: boolean;
}

/**
 * Clear the configuration cache
 *
 * Useful for testing or when configurations change at runtime
 */
export function clearConfigCache(): void {
  configCache.clear();
  console.log('[yaml-loader] Configuration cache cleared');
}

/**
 * Clear a specific configuration from cache
 *
 * @param relativePath - Path to the config file to remove from cache
 */
export function clearConfigCacheKey(relativePath: string): void {
  const cacheKey = `yaml:${relativePath}`;
  configCache.delete(cacheKey);
  console.log(`[yaml-loader] Cleared cache for: ${relativePath}`);
}

/**
 * Get the current cache size
 *
 * @returns Number of cached configurations
 */
export function getConfigCacheSize(): number {
  return configCache.size;
}

/**
 * Load component-specific configuration
 *
 * Helper for loading configs from components/training/workflow/*.config.yaml
 *
 * @param componentName - Name of the component (e.g., 'Step1ModelSelection')
 * @param schema - Optional Zod schema for validation
 * @returns Parsed configuration
 */
export function loadComponentConfig<T = unknown>(
  componentName: string,
  schema?: z.ZodSchema<T>
): T {
  const relativePath = `components/training/workflow/${componentName}.config.yaml`;
  return loadYamlConfig<T>(relativePath, schema);
}

/**
 * Load service-specific configuration
 *
 * Helper for loading configs from lib/training/*.config.yaml
 *
 * @param serviceName - Name of the service (e.g., 'model-browser')
 * @param schema - Optional Zod schema for validation
 * @returns Parsed configuration
 */
export function loadServiceConfig<T = unknown>(
  serviceName: string,
  schema?: z.ZodSchema<T>
): T {
  const relativePath = `lib/training/${serviceName}.config.yaml`;
  return loadYamlConfig<T>(relativePath, schema);
}
