import * as fs from 'fs/promises';
import * as path from 'path';

export interface PermissionCheckResult {
  hasPermission: boolean;
  error?: string;
}

export class PermissionChecker {
  /**
   * Checks if the current process can read the given file or directory
   */
  async canRead(path: string): Promise<PermissionCheckResult> {
    try {
      await fs.access(path, fs.constants.R_OK);
      return { hasPermission: true };
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;

      if (err.code === 'ENOENT') {
        return {
          hasPermission: false,
          error: `[Filesystem] FileNotFoundError: File or directory does not exist: ${path}`
        };
      } else if (err.code === 'EACCES') {
        return {
          hasPermission: false,
          error: `[Filesystem] PermissionError: Read access denied for path: ${path}`
        };
      } else {
        return {
          hasPermission: false,
          error: `[Filesystem] AccessError: Cannot access path: ${path} (${err.code || 'Unknown error'})`
        };
      }
    }
  }

  /**
   * Checks if the current process can list the given directory
   */
  async canListDirectory(path: string): Promise<PermissionCheckResult> {
    try {
      const stat = await fs.stat(path);
      if (!stat.isDirectory()) {
        return {
          hasPermission: false,
          error: `[Filesystem] ValidationError: Path is not a directory: ${path}`
        };
      }
      await fs.access(path, fs.constants.R_OK | fs.constants.X_OK);
      return { hasPermission: true };
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;

      if (err.code === 'ENOENT') {
        return {
          hasPermission: false,
          error: `[Filesystem] FileNotFoundError: Directory does not exist: ${path}`
        };
      } else if (err.code === 'EACCES') {
        return {
          hasPermission: false,
          error: `[Filesystem] PermissionError: Cannot list directory (permission denied): ${path}`
        };
      } else {
        return {
          hasPermission: false,
          error: `[Filesystem] AccessError: Cannot list directory: ${path} (${err.code || 'Unknown error'})`
        };
      }
    }
  }

  /**
   * Checks if the current process can write to the given path
   * For files: checks the parent directory's write permission
   * For directories: checks the directory's write permission
   */
  async canWrite(targetPath: string): Promise<PermissionCheckResult> {
    try {
      const stat = await fs.stat(targetPath).catch(() => null);
      
      if (stat && stat.isDirectory()) {
        await fs.access(targetPath, fs.constants.W_OK);
        return { hasPermission: true };
      }
      
      const parentDir = path.dirname(targetPath);
      await fs.access(parentDir, fs.constants.W_OK);
      return { hasPermission: true };
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;

      if (err.code === 'ENOENT') {
        return {
          hasPermission: false,
          error: `[Filesystem] FileNotFoundError: Parent directory does not exist: ${targetPath}`
        };
      } else if (err.code === 'EACCES') {
        return {
          hasPermission: false,
          error: `[Filesystem] PermissionError: Write access denied for path: ${targetPath}`
        };
      } else {
        return {
          hasPermission: false,
          error: `[Filesystem] AccessError: Cannot write to path: ${targetPath} (${err.code || 'Unknown error'})`
        };
      }
    }
  }
}

export const defaultPermissionChecker = new PermissionChecker();
