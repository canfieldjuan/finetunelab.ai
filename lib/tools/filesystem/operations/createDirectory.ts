import { defaultPathValidator } from '../security/pathValidator';
import { defaultPermissionChecker } from '../security/permissionCheck';
import { defaultPathSanitizer } from '../security/sanitizer';
import * as fs from 'fs/promises';

export interface CreateDirectoryOptions {
  recursive?: boolean;
}

/**
 * Create a directory with security validation
 * Supports recursive creation of nested directories
 */
export async function createDirectory(
  dirPath: string,
  options: CreateDirectoryOptions = {}
) {
  const { recursive = false } = options;

  const pathValidation = await defaultPathValidator.validatePath(dirPath);
  if (!pathValidation.isValid) {
    throw new Error(pathValidation.error || '[FileSystem] SecurityError: Invalid directory path');
  }

  const permissionCheck = await defaultPermissionChecker.canWrite(
    pathValidation.normalizedPath!
  );
  if (!permissionCheck.hasPermission) {
    throw new Error(permissionCheck.error || '[FileSystem] PermissionError: Write access denied');
  }

  const dirExists = await fs.access(pathValidation.normalizedPath!)
    .then(() => true)
    .catch(() => false);

  if (dirExists) {
    const stats = await fs.stat(pathValidation.normalizedPath!);
    if (stats.isDirectory()) {
      throw new Error('[FileSystem] OperationError: Directory already exists');
    } else {
      throw new Error('[FileSystem] OperationError: Path exists but is not a directory');
    }
  }

  await fs.mkdir(pathValidation.normalizedPath!, { recursive });

  const stats = await fs.stat(pathValidation.normalizedPath!);

  return {
    path: defaultPathSanitizer.sanitizePath(pathValidation.normalizedPath!),
    created: stats.birthtime.toISOString(),
    operation: 'create_directory'
  };
}
