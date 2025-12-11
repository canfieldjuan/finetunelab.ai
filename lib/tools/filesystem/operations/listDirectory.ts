// Filesystem Operations - List Directory
// Phase 2: Core read-only operation with adapter support

import { defaultAdapter } from '../adapters';

export interface ListDirectoryOptions {
  maxItems?: number;
}

export async function listDirectory(
  directoryPath: string,
  options: ListDirectoryOptions = {}
) {
  return defaultAdapter.listDirectory(directoryPath, options as Record<string, unknown>);
}
