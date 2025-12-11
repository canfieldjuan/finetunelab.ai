/**
 * Local Model Scanner
 * Purpose: Scan AI_Models directory for locally available models
 * Date: 2025-10-31
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Local model information
 */
export interface LocalModelInfo {
  id: string;              // Unique identifier (relative path)
  name: string;            // Display name
  path: string;            // Absolute path
  relativePath: string;    // Path relative to AI_Models
  category: string;        // Category (nlp, vision, audio, etc.)
  format: 'huggingface' | 'pytorch' | 'onnx' | 'safetensors' | 'unknown';
  sizeBytes?: number;      // Total size in bytes
  hasConfig: boolean;      // Has config.json
  hasWeights: boolean;     // Has model weights
  files: string[];         // List of files in directory
}

/**
 * Model file patterns for detection
 */
const MODEL_FILE_PATTERNS = {
  config: ['config.json', 'model_config.json'],
  weights: [
    'pytorch_model.bin',
    'model.safetensors',
    'adapter_model.bin',
    'model.onnx',
    'tf_model.h5',
  ],
};

/**
 * Determine model format based on files
 */
function detectModelFormat(files: string[]): LocalModelInfo['format'] {
  const fileSet = new Set(files.map(f => f.toLowerCase()));

  if (fileSet.has('model.safetensors') || files.some(f => f.endsWith('.safetensors'))) {
    return 'safetensors';
  }
  if (fileSet.has('model.onnx') || files.some(f => f.endsWith('.onnx'))) {
    return 'onnx';
  }
  if (fileSet.has('config.json') && files.some(f => f.includes('pytorch') || f.endsWith('.bin'))) {
    return 'huggingface';
  }
  if (files.some(f => f.endsWith('.bin') || f.endsWith('.pt') || f.endsWith('.pth'))) {
    return 'pytorch';
  }

  return 'unknown';
}

/**
 * Check if directory contains a model
 */
function isModelDirectory(files: string[]): boolean {
  const hasConfig = files.some(f => MODEL_FILE_PATTERNS.config.includes(f));
  const hasWeights = files.some(f =>
    MODEL_FILE_PATTERNS.weights.some(pattern => f.includes(pattern) || f.endsWith(pattern.split('.')[1]))
  );

  return hasConfig || hasWeights;
}

/**
 * Extract readable model name from directory structure
 * Handles HuggingFace cache patterns like:
 * - models-Author-ModelName → Author/ModelName
 * - models--Author--ModelName → Author/ModelName
 * - Author-ModelName → Author/ModelName
 * - HuggingFaceOrg--ModelName → HuggingFaceOrg/ModelName
 * - snapshots/hash → (uses parent directory)
 */
function extractModelName(dirName: string, relativePath: string): string {
  // If it's a snapshot hash (40 char hex), get the grandparent directory
  if (/^[a-f0-9]{40}$/i.test(dirName)) {
    const parts = relativePath.split(path.sep);
    // Go up to the root model directory (skip snapshots/)
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i] !== 'snapshots' && parts[i] !== dirName) {
        return extractModelName(parts[i], parts.slice(0, i + 1).join(path.sep));
      }
    }
  }

  // Handle HuggingFace double-dash patterns: HuggingFaceTB--SmolLM3-3B
  // FIXED: Match everything up to -- (not just up to first dash)
  // Old buggy pattern: /^([^-]+)--(.+)$/ would match "meta-llama--Model" as "meta" / "llama--Model"
  // New pattern: Use non-greedy match and lookahead to find the double-dash separator
  const doubleDashPattern = /^(.+?)--(.+)$/;
  const doubleDashMatch = dirName.match(doubleDashPattern);
  if (doubleDashMatch) {
    const [, author, modelName] = doubleDashMatch;
    return `${author}/${modelName}`;
  }

  // Handle models-Author-ModelName or models--Author--ModelName patterns
  const hfPattern = /^models-{1,2}([^-]+)-{1,2}(.+)$/i;
  const match = dirName.match(hfPattern);
  if (match) {
    const [, author, modelName] = match;
    return `${author}/${modelName}`;
  }

  // Handle Author-ModelName pattern (single dash between capitalized author)
  const authorPattern = /^([A-Z][a-zA-Z0-9]*)-(.+)$/;
  const authorMatch = dirName.match(authorPattern);
  if (authorMatch) {
    const [, author, modelName] = authorMatch;
    return `${author}/${modelName}`;
  }

  // Handle lowercase-author-ModelName patterns (e.g., meta-llama-Llama-3.2-1B, mistralai-Mistral-7B-Instruct)
  // Find first capital letter after a dash - that's where the model name starts
  // This fixes the bug where names like "mistralai-Mistral-7B-Instruct-v0.3" were not converted to "mistralai/Mistral-7B-Instruct"
  const lowercaseAuthorPattern = /^([a-z][a-z0-9-]*?)-([A-Z].+)$/;
  const lowercaseMatch = dirName.match(lowercaseAuthorPattern);
  if (lowercaseMatch) {
    let [, author, modelName] = lowercaseMatch;

    // Clean up version suffixes from modelName
    modelName = modelName
      .replace(/[-_]v?\d+(\.\d+)*$/i, '') // Remove version numbers like -v0.3
      .replace(/[-_](fp16|fp32|int8|int4|gguf|q4_0|q5_0)$/i, ''); // Remove quantization suffixes

    return `${author}/${modelName}`;
  }

  // Clean up common suffixes for remaining cases
  return dirName
    .replace(/[-_]v?\d+(\.\d+)*$/i, '') // Remove version numbers
    .replace(/[-_](fp16|fp32|int8|int4|gguf|q4_0|q5_0)$/i, '') // Remove quantization suffixes
    .trim();
}

/**
 * Get category from path
 */
function getCategoryFromPath(relativePath: string): string {
  const parts = relativePath.split(path.sep);
  
  // Check for known categories
  const knownCategories = ['nlp', 'vision', 'audio', 'code', 'medical', 'legal', 'finance', 'science', 'controlnet', 'image_generation'];
  
  for (const category of knownCategories) {
    if (parts.includes(category)) {
      return category;
    }
  }

  // Check parent directory
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }

  return 'general';
}

/**
 * Get directory size recursively
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip common cache directories
        if (entry.name === '.git' || entry.name === '__pycache__' || entry.name === 'node_modules') {
          continue;
        }
        totalSize += await getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.warn('[LocalModelScanner] Error calculating directory size:', error);
  }

  return totalSize;
}

/**
 * Scan a directory for models recursively
 */
async function scanDirectoryRecursive(
  dirPath: string,
  basePath: string,
  maxDepth: number = 6,
  currentDepth: number = 0
): Promise<LocalModelInfo[]> {
  const models: LocalModelInfo[] = [];

  if (currentDepth >= maxDepth) {
    return models;
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    // Include both files and symlinks (HuggingFace cache uses symlinks)
    const files = entries.filter(e => e.isFile() || e.isSymbolicLink()).map(e => e.name);

    // Check if current directory is a model
    if (isModelDirectory(files)) {
      const relativePath = path.relative(basePath, dirPath);
      const dirName = path.basename(dirPath);
      const modelName = extractModelName(dirName, relativePath);
      
      const hasConfig = files.some(f => MODEL_FILE_PATTERNS.config.includes(f));
      const hasWeights = files.some(f =>
        MODEL_FILE_PATTERNS.weights.some(pattern => f.includes(pattern) || f.endsWith(pattern.split('.')[1]))
      );

      const format = detectModelFormat(files);
      const category = getCategoryFromPath(relativePath);
      
      // Get directory size (async, but we'll await it)
      const sizeBytes = await getDirectorySize(dirPath);

      models.push({
        id: relativePath.replace(/\\/g, '/'), // Normalize path separators
        name: modelName,
        path: dirPath,
        relativePath: relativePath.replace(/\\/g, '/'),
        category,
        format,
        sizeBytes,
        hasConfig,
        hasWeights,
        files: files.slice(0, 20), // Limit to first 20 files for preview
      });
    }

    // Recursively scan subdirectories
    const directories = entries.filter(e => e.isDirectory());
    
    for (const dir of directories) {
      // Skip hidden directories and common non-model directories
      if (dir.name.startsWith('.') || dir.name === '__pycache__' || dir.name === 'node_modules') {
        continue;
      }

      // Skip blobs/ and refs/ directories (HuggingFace cache metadata)
      if (dir.name === 'blobs' || dir.name === 'refs') {
        continue;
      }

      const subDirPath = path.join(dirPath, dir.name);
      const subModels = await scanDirectoryRecursive(subDirPath, basePath, maxDepth, currentDepth + 1);
      models.push(...subModels);
    }
  } catch (error) {
    console.error('[LocalModelScanner] Error scanning directory:', dirPath, error);
  }

  return models;
}

/**
 * Scan AI_Models directory for local models
 * 
 * @param basePath - Base path to AI_Models directory (default: ../../AI_Models from project root)
 * @returns Array of local model information
 */
export async function scanLocalModels(basePath?: string): Promise<LocalModelInfo[]> {
  const aiModelsPath = basePath || path.join(process.cwd(), '..', 'AI_Models');

  console.log('[LocalModelScanner] Scanning directory:', aiModelsPath);

  try {
    // Verify directory exists
    await fs.access(aiModelsPath);
  } catch {
    console.error('[LocalModelScanner] AI_Models directory not found:', aiModelsPath);
    return [];
  }

  const models = await scanDirectoryRecursive(aiModelsPath, aiModelsPath);

  console.log('[LocalModelScanner] Found', models.length, 'local models');

  return models;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

console.log('[LocalModelScanner] Local model scanner utility loaded');
