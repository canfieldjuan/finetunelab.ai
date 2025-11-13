// Tools Configuration Loader
// Loads and validates tools.config.yaml with fallback to defaults
// Date: 2025-10-15

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';

// ============================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================

const FilesystemConfigSchema = z.object({
  enabled: z.boolean().default(true),
  security: z.object({
    allowedPaths: z.array(z.string()).default([process.cwd()]),
    blockedPaths: z.array(z.string()).default([]),
    blockedExtensions: z.array(z.string()).default(['.exe', '.bat', '.cmd', '.sh', '.ps1']),
    allowedExtensions: z.array(z.string()).default([]),
  }),
  limits: z.object({
    maxFileSize: z.number().positive().default(1024 * 1024),
    maxDirectoryItems: z.number().positive().default(1000),
  }),
  options: z.object({
    followSymlinks: z.boolean().default(false),
    readOnly: z.boolean().default(true),
  }),
});

const ToolsConfigSchema = z.object({
  filesystem: FilesystemConfigSchema,
});

// ============================================
// TYPES
// ============================================

export type FilesystemConfig = z.infer<typeof FilesystemConfigSchema>;
export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONFIG: ToolsConfig = {
  filesystem: {
    enabled: true,
    security: {
      allowedPaths: [process.cwd()],
      blockedPaths: [],
      blockedExtensions: ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.dll', '.so'],
      allowedExtensions: [],
    },
    limits: {
      maxFileSize: 1024 * 1024,
      maxDirectoryItems: 1000,
    },
    options: {
      followSymlinks: false,
      readOnly: true,
    },
  },
};

// ============================================
// CONFIG LOADER
// ============================================

function loadToolsConfig(): ToolsConfig {
  // Only load config on server-side (Node.js environment)
  if (typeof window !== 'undefined') {
    // Browser environment - return defaults
    return DEFAULT_CONFIG;
  }

  const configPath = join(process.cwd(), 'tools.config.yaml');

  // If config file doesn't exist, use defaults (backward compatible)
  if (!existsSync(configPath)) {
    console.log('[ToolsConfig] No config file found, using defaults');
    return DEFAULT_CONFIG;
  }

  try {
    // Load and parse YAML
    const fileContent = readFileSync(configPath, 'utf8');
    const rawConfig = yaml.load(fileContent);

    // Validate with Zod schema
    const validatedConfig = ToolsConfigSchema.parse(rawConfig);

    console.log('[ToolsConfig] Loaded from tools.config.yaml');
    return validatedConfig;
  } catch (error) {
    console.error('[ToolsConfig] Error loading config:', error);
    console.warn('[ToolsConfig] Falling back to defaults');
    return DEFAULT_CONFIG;
  }
}

// Load config once at module initialization
const toolsConfig = loadToolsConfig();

// Export config and getter
export function getToolsConfig(): ToolsConfig {
  return toolsConfig;
}

export function getFilesystemConfig(): FilesystemConfig {
  return toolsConfig.filesystem;
}
