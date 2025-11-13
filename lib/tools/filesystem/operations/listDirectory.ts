// Filesystem Operations - List Directory
// Phase 2: Core read-only operation

import { defaultPathValidator } from '../security/pathValidator';
import { defaultPermissionChecker } from '../security/permissionCheck';
import { defaultPathSanitizer } from '../security/sanitizer';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ListDirectoryOptions {
  maxItems?: number;
}

export async function listDirectory(
  directoryPath: string,
  options: ListDirectoryOptions = {}
) {
  const { maxItems = 1000 } = options;
  
  // Security validation
  const pathValidation = await defaultPathValidator.validatePath(directoryPath);
  if (!pathValidation.isValid) {
    throw new Error(pathValidation.error || 'FileSystem SecurityError: Invalid directory path');
  }

  const permissionCheck = await defaultPermissionChecker.canListDirectory(
    pathValidation.normalizedPath!
  );
  if (!permissionCheck.hasPermission) {
    throw new Error(permissionCheck.error || 'FileSystem PermissionError: Read access denied');
  }

  // Check if path exists and is a directory
  const stats = await fs.stat(pathValidation.normalizedPath!);
  if (!stats.isDirectory()) {
    throw new Error('FileSystem OperationError: Path is not a directory');
  }

  // Read directory contents
  const entries = await fs.readdir(pathValidation.normalizedPath!, { withFileTypes: true });
  
  if (entries.length > maxItems) {
    throw new Error(`FileSystem LimitError: Directory contains too many items (${entries.length} > ${maxItems})`);
  }

  const items = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(pathValidation.normalizedPath!, entry.name);
      try {
        const itemStats = await fs.stat(fullPath);
        return {
          name: defaultPathSanitizer.sanitizeFilename(entry.name),
          type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
          size: itemStats.size,
          modified: itemStats.mtime.toISOString(),
          permissions: {
            readable: true,
            writable: false,
            executable: false
          }
        };
      } catch {
        return {
          name: defaultPathSanitizer.sanitizeFilename(entry.name),
          type: 'error',
          error: 'Access denied or stat failed'
        };
      }
    })
  );

  return {
    path: defaultPathSanitizer.sanitizePath(pathValidation.normalizedPath!),
    itemCount: items.length,
    items
  };
}
