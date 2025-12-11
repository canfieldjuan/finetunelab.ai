// Filesystem Operations - Read File
// Phase 2: Core read-only operation with adapter support

import { defaultAdapter } from '../adapters';

export interface ReadFileOptions {
  encoding?: string;
  maxSize?: number;
}

export async function readFile(
  filePath: string,
  options: ReadFileOptions = {}
) {
  return defaultAdapter.readFile(filePath, options as Record<string, unknown>);
}
