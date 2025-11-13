// Filesystem Operations - Read File
// Phase 2: Core read-only operation

import { defaultPathValidator } from '../security/pathValidator';
import { defaultPermissionChecker } from '../security/permissionCheck';
import { defaultPathSanitizer } from '../security/sanitizer';
import * as fs from 'fs/promises';

export interface ReadFileOptions {
  encoding?: string;
  maxSize?: number;
}

export async function readFile(
  filePath: string,
  options: ReadFileOptions = {}
) {
  const { encoding = 'utf8', maxSize = 1024 * 1024 } = options;
  
  // Security validation
  const pathValidation = await defaultPathValidator.validatePath(filePath);
  if (!pathValidation.isValid) {
    throw new Error(pathValidation.error || 'FileSystem SecurityError: Invalid file path');
  }

  const permissionCheck = await defaultPermissionChecker.canRead(
    pathValidation.normalizedPath!
  );
  if (!permissionCheck.hasPermission) {
    throw new Error(permissionCheck.error || 'FileSystem PermissionError: Read access denied');
  }

  // Check file exists and get stats
  const stats = await fs.stat(pathValidation.normalizedPath!);
  if (!stats.isFile()) {
    throw new Error('FileSystem OperationError: Path is not a file');
  }

  // Check file size limit
  if (stats.size > maxSize) {
    throw new Error(`FileSystem LimitError: File size (${stats.size} bytes) exceeds limit (${maxSize} bytes)`);
  }

  // Read file content
  const content = await fs.readFile(
    pathValidation.normalizedPath!,
    encoding as BufferEncoding
  );

  return {
    path: defaultPathSanitizer.sanitizePath(pathValidation.normalizedPath!),
    size: stats.size,
    encoding,
    content,
    modified: stats.mtime.toISOString()
  };
}
