// Filesystem Operations - Get File Info
// Phase 2: Core read-only operation

import { defaultPathValidator } from '../security/pathValidator';
import { defaultPermissionChecker } from '../security/permissionCheck';
import { defaultPathSanitizer } from '../security/sanitizer';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function getFileInfo(targetPath: string) {
  // Security validation
  const pathValidation = await defaultPathValidator.validatePath(targetPath);
  if (!pathValidation.isValid) {
    throw new Error(pathValidation.error || 'FileSystem SecurityError: Invalid path');
  }

  const permissionCheck = await defaultPermissionChecker.canRead(
    pathValidation.normalizedPath!
  );
  if (!permissionCheck.hasPermission) {
    throw new Error(permissionCheck.error || 'FileSystem PermissionError: Read access denied');
  }

  // Get file/directory stats
  const stats = await fs.stat(pathValidation.normalizedPath!);

  return {
    path: defaultPathSanitizer.sanitizePath(pathValidation.normalizedPath!),
    name: defaultPathSanitizer.sanitizeFilename(
      path.basename(pathValidation.normalizedPath!)
    ),
    type: stats.isFile() ? 'file' : stats.isDirectory() ? 'directory' : 'other',
    size: stats.size,
    created: stats.birthtime.toISOString(),
    modified: stats.mtime.toISOString(),
    accessed: stats.atime.toISOString(),
    permissions: {
      readable: true,
      writable: false,
      executable: false
    }
  };
}
