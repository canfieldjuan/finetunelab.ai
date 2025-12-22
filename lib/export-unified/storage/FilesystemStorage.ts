/**
 * Filesystem Storage Provider
 * Stores exports on the local filesystem
 * Phase 1: Foundation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { StorageProvider, ExportFormat, StorageType } from '../interfaces';
import { FILE_EXTENSIONS } from '../config';

export class FilesystemStorage implements StorageProvider {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    console.log(`[FilesystemStorage] Initialized with basePath: ${basePath}`);
  }

  /**
   * Initialize storage (create directory if needed)
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      console.log(`[FilesystemStorage] Storage directory ready: ${this.basePath}`);
    } catch (error) {
      console.error(`[FilesystemStorage] Failed to initialize storage:`, error);
      throw new Error(`Failed to initialize filesystem storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save export file
   */
  async saveExport(
    userId: string,
    exportId: string,
    content: string | Buffer,
    format: ExportFormat
  ): Promise<{ filePath: string; fileSize: number }> {
    console.log(`[FilesystemStorage] Saving export: ${exportId}`);

    try {
      // Create user directory
      const userDir = path.join(this.basePath, this.sanitizeUserId(userId));
      await fs.mkdir(userDir, { recursive: true });

      // Generate file path
      const extension = FILE_EXTENSIONS[format] || format;
      const fileName = `${exportId}.${extension}`;
      const filePath = path.join(userDir, fileName);

      // Write file
      if (typeof content === 'string') {
        await fs.writeFile(filePath, content, 'utf8');
      } else {
        await fs.writeFile(filePath, content);
      }

      // Get file size
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      console.log(`[FilesystemStorage] Export saved: ${filePath} (${fileSize} bytes)`);

      // Return relative path for storage in database
      const relativePath = path.join(this.sanitizeUserId(userId), fileName);

      return {
        filePath: relativePath,
        fileSize,
      };
    } catch (error) {
      console.error(`[FilesystemStorage] Failed to save export:`, error);
      throw new Error(`Failed to save export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get export file
   */
  async getExport(filePath: string): Promise<Buffer> {
    console.log(`[FilesystemStorage] Retrieving export: ${filePath}`);

    try {
      const absolutePath = path.join(this.basePath, filePath);

      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        throw new Error(`Export file not found: ${filePath}`);
      }

      // Read file
      const content = await fs.readFile(absolutePath);

      console.log(`[FilesystemStorage] Export retrieved: ${filePath} (${content.length} bytes)`);
      return content;
    } catch (error) {
      console.error(`[FilesystemStorage] Failed to get export:`, error);
      throw new Error(`Failed to get export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete export file
   */
  async deleteExport(filePath: string): Promise<void> {
    console.log(`[FilesystemStorage] Deleting export: ${filePath}`);

    try {
      const absolutePath = path.join(this.basePath, filePath);

      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        console.warn(`[FilesystemStorage] Export file not found (already deleted?): ${filePath}`);
        return;
      }

      // Delete file
      await fs.unlink(absolutePath);

      console.log(`[FilesystemStorage] Export deleted: ${filePath}`);
    } catch (error) {
      console.error(`[FilesystemStorage] Failed to delete export:`, error);
      throw new Error(`Failed to delete export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if export exists
   */
  async exportExists(filePath: string): Promise<boolean> {
    try {
      const absolutePath = path.join(this.basePath, filePath);
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage type identifier
   */
  getStorageType(): StorageType {
    return 'filesystem';
  }

  /**
   * Clean up expired exports
   */
  async cleanupExpired(expirationDate: Date): Promise<number> {
    console.log(`[FilesystemStorage] Cleaning up exports older than: ${expirationDate.toISOString()}`);

    let deletedCount = 0;

    try {
      // Get all user directories
      const userDirs = await fs.readdir(this.basePath, { withFileTypes: true });

      for (const userDir of userDirs) {
        if (!userDir.isDirectory()) continue;

        const userPath = path.join(this.basePath, userDir.name);
        const files = await fs.readdir(userPath);

        for (const file of files) {
          const filePath = path.join(userPath, file);
          const stats = await fs.stat(filePath);

          // Delete if modified time is before expiration date
          if (stats.mtime < expirationDate) {
            await fs.unlink(filePath);
            deletedCount++;
            console.log(`[FilesystemStorage] Deleted expired file: ${file}`);
          }
        }

        // Remove empty user directories
        const remainingFiles = await fs.readdir(userPath);
        if (remainingFiles.length === 0) {
          await fs.rmdir(userPath);
          console.log(`[FilesystemStorage] Removed empty user directory: ${userDir.name}`);
        }
      }

      console.log(`[FilesystemStorage] Cleanup complete: ${deletedCount} files deleted`);
      return deletedCount;
    } catch (error) {
      console.error(`[FilesystemStorage] Cleanup failed:`, error);
      throw new Error(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get total storage size for a user
   */
  async getUserStorageSize(userId: string): Promise<number> {
    try {
      const userDir = path.join(this.basePath, this.sanitizeUserId(userId));

      try {
        await fs.access(userDir);
      } catch {
        // User directory doesn't exist
        return 0;
      }

      const files = await fs.readdir(userDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(userDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      return totalSize;
    } catch (error) {
      console.error(`[FilesystemStorage] Failed to get user storage size:`, error);
      return 0;
    }
  }

  /**
   * Sanitize user ID for use in filesystem paths
   */
  private sanitizeUserId(userId: string): string {
    // Remove any characters that could be used for path traversal
    return userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}
