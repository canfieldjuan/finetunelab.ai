import { defaultPathValidator } from '../security/pathValidator';
import { defaultPermissionChecker } from '../security/permissionCheck';
import { defaultPathSanitizer } from '../security/sanitizer';
import * as fs from 'fs/promises';
import { dataConfig } from '@/lib/config/data';

export interface WriteFileOptions {
  overwrite?: boolean;
  append?: boolean;
  encoding?: string;
  maxSize?: number;
}

/**
 * Write content to a file with security validation
 * Supports overwrite and append modes
 */
export async function writeFile(
  filePath: string,
  content: string,
  options: WriteFileOptions = {}
) {
  const {
    overwrite = false,
    append = false,
    encoding = 'utf8',
    maxSize = dataConfig.fileSizeLimits.maxWriteSizeBytes
  } = options;

  if (overwrite && append) {
    throw new Error(
      '[FileSystem] ValidationError: overwrite and append cannot both be true'
    );
  }

  if (!content || typeof content !== 'string') {
    throw new Error('[FileSystem] ValidationError: content must be a non-empty string');
  }

  const contentSize = Buffer.byteLength(content, encoding as BufferEncoding);
  if (contentSize > maxSize) {
    throw new Error(
      `[FileSystem] LimitError: Content size (${contentSize} bytes) exceeds maximum (${maxSize} bytes)`
    );
  }

  const pathValidation = await defaultPathValidator.validatePath(filePath);
  if (!pathValidation.isValid) {
    throw new Error(pathValidation.error || '[FileSystem] SecurityError: Invalid file path');
  }

  const permissionCheck = await defaultPermissionChecker.canWrite(
    pathValidation.normalizedPath!
  );
  if (!permissionCheck.hasPermission) {
    throw new Error(permissionCheck.error || '[FileSystem] PermissionError: Write access denied');
  }

  const fileExists = await fs.access(pathValidation.normalizedPath!)
    .then(() => true)
    .catch(() => false);

  if (fileExists && !overwrite && !append) {
    throw new Error(
      '[FileSystem] OperationError: File already exists. Use overwrite or append option.'
    );
  }

  if (append) {
    await fs.appendFile(pathValidation.normalizedPath!, content, encoding as BufferEncoding);
  } else {
    await fs.writeFile(pathValidation.normalizedPath!, content, encoding as BufferEncoding);
  }

  const stats = await fs.stat(pathValidation.normalizedPath!);

  return {
    path: defaultPathSanitizer.sanitizePath(pathValidation.normalizedPath!),
    size: stats.size,
    operation: append ? 'append' : fileExists ? 'overwrite' : 'create',
    modified: stats.mtime.toISOString()
  };
}
