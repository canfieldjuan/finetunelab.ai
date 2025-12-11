import fs from 'fs/promises';
import { constants } from 'fs';

export interface PermissionCheckResult {
  hasPermission: boolean;
  permissions?: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
  };
  error?: string;
}

export interface FileStats {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  modified: Date;
  permissions: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
  };
}

export class PermissionChecker {
  private maxFileSize: number;
  private allowedExtensions: Set<string>;
  private blockedExtensions: Set<string>;

  constructor(
    maxFileSize: number = 1024 * 1024, // 1MB default
    allowedExtensions: string[] = [],
    blockedExtensions: string[] = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.dll', '.so']
  ) {
    this.maxFileSize = maxFileSize;
    this.allowedExtensions = new Set(allowedExtensions.map(ext => ext.toLowerCase()));
    this.blockedExtensions = new Set(blockedExtensions.map(ext => ext.toLowerCase()));
  }

  /**
   * Check if we have read permission for a file or directory
   */
  async checkReadPermission(filePath: string): Promise<PermissionCheckResult> {
    try {
      // Check if file/directory exists and is accessible
      await fs.access(filePath, constants.F_OK);
      
      // Check read permission
      await fs.access(filePath, constants.R_OK);

      // Get detailed permissions
      const permissions = await this.getPermissions(filePath);
      
      return {
        hasPermission: true,
        permissions
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('ENOENT')) {
        return {
          hasPermission: false,
          error: 'FileSystem AccessError: File or directory does not exist'
        };
      } else if (errorMessage.includes('EACCES')) {
        return {
          hasPermission: false,
          error: 'FileSystem PermissionError: Read access denied'
        };
      } else {
        return {
          hasPermission: false,
          error: `FileSystem AccessError: ${errorMessage}`
        };
      }
    }
  }

  /**
   * Get detailed file statistics and permissions
   */
  async getFileStats(filePath: string): Promise<FileStats | null> {
    try {
      const stats = await fs.stat(filePath);
      const permissions = await this.getPermissions(filePath);

      return {
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime,
        permissions
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if file size is within allowed limits
   */
  async checkFileSize(filePath: string): Promise<PermissionCheckResult> {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.size > this.maxFileSize) {
        return {
          hasPermission: false,
          error: `FileSystem SizeError: File size (${stats.size} bytes) exceeds maximum allowed size (${this.maxFileSize} bytes)`
        };
      }

      return {
        hasPermission: true
      };
    } catch (error) {
      return {
        hasPermission: false,
        error: `FileSystem AccessError: Cannot check file size - ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if file extension is allowed
   */
  checkFileExtension(filePath: string): PermissionCheckResult {
    try {
      const extension = this.getFileExtension(filePath);
      
      // If allowedExtensions is specified and not empty, only allow those
      if (this.allowedExtensions.size > 0) {
        if (!this.allowedExtensions.has(extension)) {
          return {
            hasPermission: false,
            error: `FileSystem ExtensionError: File extension '${extension}' is not in allowed list: ${Array.from(this.allowedExtensions).join(', ')}`
          };
        }
      }
      
      // Check blocked extensions
      if (this.blockedExtensions.has(extension)) {
        return {
          hasPermission: false,
          error: `FileSystem ExtensionError: File extension '${extension}' is blocked for security reasons`
        };
      }

      return {
        hasPermission: true
      };
    } catch (error) {
      return {
        hasPermission: false,
        error: `FileSystem ValidationError: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Comprehensive permission check combining all validations
   */
  async checkAllPermissions(filePath: string): Promise<PermissionCheckResult> {
    try {
      // Check read permission
      const readCheck = await this.checkReadPermission(filePath);
      if (!readCheck.hasPermission) {
        return readCheck;
      }

      // Check file extension
      const extensionCheck = this.checkFileExtension(filePath);
      if (!extensionCheck.hasPermission) {
        return extensionCheck;
      }

      // Check file size (only for files, not directories)
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        const sizeCheck = await this.checkFileSize(filePath);
        if (!sizeCheck.hasPermission) {
          return sizeCheck;
        }
      }

      return {
        hasPermission: true,
        permissions: readCheck.permissions
      };
    } catch (error) {
      return {
        hasPermission: false,
        error: `FileSystem ValidationError: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get file permissions (read, write, execute)
   */
  private async getPermissions(filePath: string): Promise<{ readable: boolean; writable: boolean; executable: boolean; }> {
    const permissions = {
      readable: false,
      writable: false,
      executable: false
    };

    try {
      await fs.access(filePath, constants.R_OK);
      permissions.readable = true;
    } catch {
      // Read permission not available
    }

    try {
      await fs.access(filePath, constants.W_OK);
      permissions.writable = true;
    } catch {
      // Write permission not available
    }

    try {
      await fs.access(filePath, constants.X_OK);
      permissions.executable = true;
    } catch {
      // Execute permission not available
    }

    return permissions;
  }

  /**
   * Get file extension in lowercase
   */
  private getFileExtension(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === filePath.length - 1) {
      return '';
    }
    return filePath.substring(lastDotIndex).toLowerCase();
  }

  /**
   * Update configuration
   */
  updateConfig(config: {
    maxFileSize?: number;
    allowedExtensions?: string[];
    blockedExtensions?: string[];
  }): void {
    if (config.maxFileSize !== undefined) {
      this.maxFileSize = config.maxFileSize;
    }
    if (config.allowedExtensions !== undefined) {
      this.allowedExtensions = new Set(config.allowedExtensions.map(ext => ext.toLowerCase()));
    }
    if (config.blockedExtensions !== undefined) {
      this.blockedExtensions = new Set(config.blockedExtensions.map(ext => ext.toLowerCase()));
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      maxFileSize: this.maxFileSize,
      allowedExtensions: Array.from(this.allowedExtensions),
      blockedExtensions: Array.from(this.blockedExtensions)
    };
  }
}

// Export a default instance
export const defaultPermissionChecker = new PermissionChecker();
