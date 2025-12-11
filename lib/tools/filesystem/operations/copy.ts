import { defaultPathValidator } from '../security/pathValidator';
import { defaultPermissionChecker } from '../security/permissionCheck';
import { defaultPathSanitizer } from '../security/sanitizer';
import * as fs from 'fs/promises';

export interface CopyOptions {
  recursive?: boolean;
}

/**
 * Copy a file or directory
 * Both source and destination paths must be within allowed directories
 */
export async function copy(
  sourcePath: string,
  destinationPath: string,
  options: CopyOptions = {}
) {
  const { recursive = false } = options;

  const sourceValidation = await defaultPathValidator.validatePath(sourcePath);
  if (!sourceValidation.isValid) {
    throw new Error(
      sourceValidation.error || '[FileSystem] SecurityError: Invalid source path'
    );
  }

  const destValidation = await defaultPathValidator.validatePath(destinationPath);
  if (!destValidation.isValid) {
    throw new Error(
      destValidation.error || '[FileSystem] SecurityError: Invalid destination path'
    );
  }

  const sourcePermission = await defaultPermissionChecker.canRead(
    sourceValidation.normalizedPath!
  );
  if (!sourcePermission.hasPermission) {
    throw new Error(
      sourcePermission.error || '[FileSystem] PermissionError: Cannot read source'
    );
  }

  const destPermission = await defaultPermissionChecker.canWrite(
    destValidation.normalizedPath!
  );
  if (!destPermission.hasPermission) {
    throw new Error(
      destPermission.error || '[FileSystem] PermissionError: Cannot write to destination'
    );
  }

  const sourceStats = await fs.stat(sourceValidation.normalizedPath!);
  
  if (sourceStats.isDirectory() && !recursive) {
    throw new Error(
      '[FileSystem] OperationError: Source is a directory but recursive option is false'
    );
  }

  const destExists = await fs.access(destValidation.normalizedPath!)
    .then(() => true)
    .catch(() => false);

  if (destExists) {
    throw new Error(
      '[FileSystem] OperationError: Destination path already exists'
    );
  }

  await fs.cp(
    sourceValidation.normalizedPath!,
    destValidation.normalizedPath!,
    { recursive }
  );

  const stats = await fs.stat(destValidation.normalizedPath!);

  return {
    source: defaultPathSanitizer.sanitizePath(sourceValidation.normalizedPath!),
    destination: defaultPathSanitizer.sanitizePath(destValidation.normalizedPath!),
    operation: 'copy',
    type: stats.isDirectory() ? 'directory' : 'file',
    size: stats.size,
    modified: stats.mtime.toISOString()
  };
}
