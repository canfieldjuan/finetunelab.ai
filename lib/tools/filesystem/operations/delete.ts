import { defaultPathValidator } from '../security/pathValidator';
import { defaultPermissionChecker } from '../security/permissionCheck';
import { defaultPathSanitizer } from '../security/sanitizer';
import * as fs from 'fs/promises';

export interface DeleteOptions {
  recursive?: boolean;
  force?: boolean;
  i_am_sure?: boolean;
}

/**
 * Delete a file or directory with explicit confirmation requirement
 * DANGEROUS OPERATION - Requires i_am_sure: true parameter
 */
export async function deleteFile(
  targetPath: string,
  options: DeleteOptions = {}
) {
  const { recursive = false, force = false, i_am_sure = false } = options;

  if (!i_am_sure) {
    throw new Error(
      '[FileSystem] SafetyError: Delete operation requires explicit confirmation. ' +
      'Set i_am_sure: true to proceed.'
    );
  }

  const pathValidation = await defaultPathValidator.validatePath(targetPath);
  if (!pathValidation.isValid) {
    throw new Error(pathValidation.error || '[FileSystem] SecurityError: Invalid path');
  }

  const permissionCheck = await defaultPermissionChecker.canWrite(
    pathValidation.normalizedPath!
  );
  if (!permissionCheck.hasPermission) {
    throw new Error(
      permissionCheck.error || '[FileSystem] PermissionError: Write access denied'
    );
  }

  const exists = await fs.access(pathValidation.normalizedPath!)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    throw new Error('[FileSystem] OperationError: Path does not exist');
  }

  const stats = await fs.stat(pathValidation.normalizedPath!);
  const isDirectory = stats.isDirectory();

  if (isDirectory && !recursive) {
    throw new Error(
      '[FileSystem] OperationError: Path is a directory but recursive option is false'
    );
  }

  const targetInfo = {
    path: defaultPathSanitizer.sanitizePath(pathValidation.normalizedPath!),
    type: isDirectory ? 'directory' : 'file',
    size: stats.size
  };

  await fs.rm(pathValidation.normalizedPath!, { recursive, force });

  return {
    ...targetInfo,
    operation: 'delete',
    deleted: new Date().toISOString()
  };
}
