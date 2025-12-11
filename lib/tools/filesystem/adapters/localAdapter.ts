// Local Filesystem Adapter
// Phase 2: Direct filesystem access via Node.js fs module

import {
  FilesystemAdapter,
  ListDirectoryResult,
  ReadFileResult,
  FileInfoResult
} from './types';
import { defaultPathValidator } from '../security/pathValidator';
import { defaultPermissionChecker } from '../security/permissionCheck';
import { defaultPathSanitizer } from '../security/sanitizer';
import * as fs from 'fs/promises';
import * as path from 'path';

export class LocalAdapter implements FilesystemAdapter {
  async listDirectory(
    directoryPath: string,
    options: { maxItems?: number } = {}
  ): Promise<ListDirectoryResult> {
    const { maxItems = 1000 } = options;

    console.log(`[LocalAdapter] listDirectory: ${directoryPath}`);

    const pathValidation = await defaultPathValidator.validatePath(directoryPath);
    if (!pathValidation.isValid) {
      throw new Error(pathValidation.error || 'Invalid directory path');
    }

    const permissionCheck = await defaultPermissionChecker.canListDirectory(
      pathValidation.normalizedPath!
    );
    if (!permissionCheck.hasPermission) {
      throw new Error(permissionCheck.error || 'Read access denied');
    }

    const stats = await fs.stat(pathValidation.normalizedPath!);
    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory');
    }

    const entries = await fs.readdir(pathValidation.normalizedPath!, {
      withFileTypes: true
    });

    if (entries.length > maxItems) {
      throw new Error(
        `Directory contains too many items (${entries.length} > ${maxItems})`
      );
    }

    const items = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(pathValidation.normalizedPath!, entry.name);
        try {
          const itemStats = await fs.stat(fullPath);
          return {
            name: defaultPathSanitizer.sanitizeFilename(entry.name),
            type: entry.isDirectory()
              ? ('directory' as const)
              : entry.isFile()
                ? ('file' as const)
                : ('other' as const),
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
            type: 'error' as const,
            error: 'Access denied or stat failed'
          };
        }
      })
    );

    console.log(`[LocalAdapter] Found ${items.length} items`);

    return {
      path: defaultPathSanitizer.sanitizePath(pathValidation.normalizedPath!),
      itemCount: items.length,
      items
    };
  }

  async readFile(
    filePath: string,
    options: { encoding?: string; maxSize?: number } = {}
  ): Promise<ReadFileResult> {
    const { encoding = 'utf8', maxSize = 1024 * 1024 } = options;

    console.log(`[LocalAdapter] readFile: ${filePath}`);

    const pathValidation = await defaultPathValidator.validatePath(filePath);
    if (!pathValidation.isValid) {
      throw new Error(pathValidation.error || 'Invalid file path');
    }

    const permissionCheck = await defaultPermissionChecker.canRead(
      pathValidation.normalizedPath!
    );
    if (!permissionCheck.hasPermission) {
      throw new Error(permissionCheck.error || 'Read access denied');
    }

    const stats = await fs.stat(pathValidation.normalizedPath!);
    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }

    if (stats.size > maxSize) {
      throw new Error(
        `File size (${stats.size} bytes) exceeds limit (${maxSize} bytes)`
      );
    }

    const content = await fs.readFile(
      pathValidation.normalizedPath!,
      encoding as BufferEncoding
    );

    console.log(`[LocalAdapter] Read ${stats.size} bytes`);

    return {
      path: defaultPathSanitizer.sanitizePath(pathValidation.normalizedPath!),
      size: stats.size,
      encoding,
      content: content.toString(),
      modified: stats.mtime.toISOString()
    };
  }

  async getFileInfo(targetPath: string): Promise<FileInfoResult> {
    console.log(`[LocalAdapter] getFileInfo: ${targetPath}`);

    const pathValidation = await defaultPathValidator.validatePath(targetPath);
    if (!pathValidation.isValid) {
      throw new Error(pathValidation.error || 'Invalid path');
    }

    const permissionCheck = await defaultPermissionChecker.canRead(
      pathValidation.normalizedPath!
    );
    if (!permissionCheck.hasPermission) {
      throw new Error(permissionCheck.error || 'Read access denied');
    }

    const stats = await fs.stat(pathValidation.normalizedPath!);

    return {
      path: defaultPathSanitizer.sanitizePath(pathValidation.normalizedPath!),
      type: stats.isFile()
        ? ('file' as const)
        : stats.isDirectory()
          ? ('directory' as const)
          : ('other' as const),
      size: stats.size,
      modified: stats.mtime.toISOString(),
      accessed: stats.atime.toISOString(),
      created: stats.birthtime.toISOString(),
      permissions: {
        readable: true,
        writable: false,
        executable: false
      }
    };
  }
}
