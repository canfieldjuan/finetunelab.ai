// Filesystem Operations - Get File Info
// Phase 2: Core read-only operation with adapter support

import { defaultAdapter } from '../adapters';

export async function getFileInfo(targetPath: string) {
  return defaultAdapter.getFileInfo(targetPath);
}
