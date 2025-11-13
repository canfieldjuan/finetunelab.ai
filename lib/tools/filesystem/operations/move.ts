import { defaultPathValidator } from '../security/pathValidator';
import { defaultPermissionChecker } from '../security/permissionCheck';
import { defaultPathSanitizer } from '../security/sanitizer';
import * as fs from 'fs/promises';

/**
 * Move or rename a file or directory
 * Both source and destination paths must be within allowed directories
 */
export async function move(sourcePath: string, destinationPath: string) {
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

  const sourceExists = await fs.access(sourceValidation.normalizedPath!)
    .then(() => true)
    .catch(() => false);

  if (!sourceExists) {
    throw new Error('[FileSystem] OperationError: Source path does not exist');
  }

  const destExists = await fs.access(destValidation.normalizedPath!)
    .then(() => true)
    .catch(() => false);

  if (destExists) {
    throw new Error(
      '[FileSystem] OperationError: Destination path already exists'
    );
  }

  await fs.rename(sourceValidation.normalizedPath!, destValidation.normalizedPath!);

  const stats = await fs.stat(destValidation.normalizedPath!);

  return {
    source: defaultPathSanitizer.sanitizePath(sourceValidation.normalizedPath!),
    destination: defaultPathSanitizer.sanitizePath(destValidation.normalizedPath!),
    operation: 'move',
    type: stats.isDirectory() ? 'directory' : 'file',
    modified: stats.mtime.toISOString()
  };
}
