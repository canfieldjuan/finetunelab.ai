import * as path from 'path';
import * as fs from 'fs/promises';
import { getFilesystemConfig } from '../../../config/toolsConfig';

export interface PathValidationResult {
  isValid: boolean;
  normalizedPath?: string;
  error?: string;
}

export class PathValidator {
  private allowedBasePaths: string[];
  private maxPathLength: number;
  private blockedPatterns: RegExp[];

  constructor(
    allowedBasePaths: string[] = [process.cwd()],
    maxPathLength: number = 4096
  ) {
    // Normalize and resolve allowed base paths
    this.allowedBasePaths = allowedBasePaths.map(basePath => 
      path.resolve(path.normalize(basePath))
    );
    this.maxPathLength = maxPathLength;
    
    // Patterns to block potentially dangerous paths
    this.blockedPatterns = [
      /\.\./,                    // Path traversal attempts
      /\/\/+/,                  // Multiple consecutive slashes
      /^\/proc\//,              // Linux proc filesystem
      /^\/sys\//,               // Linux sys filesystem
      /^\/dev\//,               // Device files
      /\0/,                     // Null bytes
      /[\x00-\x1f\x7f]/,       // Control characters
      /^[A-Z]:\\Windows\\/i,    // Windows system directory
      /^[A-Z]:\\Program Files/i, // Windows program files
    ];
  }

  /**
   * Validates and normalizes a file path
   */
  async validatePath(inputPath: string): Promise<PathValidationResult> {
    try {
      // Basic input validation
      if (!inputPath || typeof inputPath !== 'string') {
        return {
          isValid: false,
          error: 'FileSystem ValidationError: Path must be a non-empty string'
        };
      }

      if (inputPath.length > this.maxPathLength) {
        return {
          isValid: false,
          error: `FileSystem ValidationError: Path exceeds maximum length of ${this.maxPathLength} characters`
        };
      }

      // Check for blocked patterns
      for (const pattern of this.blockedPatterns) {
        if (pattern.test(inputPath)) {
          return {
            isValid: false,
            error: `FileSystem SecurityError: Path contains blocked pattern: ${pattern.source}`
          };
        }
      }

      // Normalize and resolve the path
      const normalizedPath = path.resolve(path.normalize(inputPath));

      // Check if path is within allowed base paths
      const isWithinAllowedPath = this.allowedBasePaths.some(basePath => {
        return normalizedPath.startsWith(basePath + path.sep) || 
               normalizedPath === basePath;
      });

      if (!isWithinAllowedPath) {
        return {
          isValid: false,
          error: `FileSystem SecurityError: Path is outside allowed directories. Allowed paths: ${this.allowedBasePaths.join(', ')}`
        };
      }

      // Additional security check: ensure path doesn't escape via symlinks
      // Only check if the path actually exists to avoid blocking legitimate operations
      try {
        await fs.access(normalizedPath);
        const realPath = await fs.realpath(normalizedPath);
        const isRealPathAllowed = this.allowedBasePaths.some(basePath => {
          return realPath.startsWith(basePath + path.sep) || 
                 realPath === basePath;
        });

        if (!isRealPathAllowed) {
          return {
            isValid: false,
            error: 'FileSystem SecurityError: Symlink points outside allowed directories'
          };
        }
      } catch {
        // If access or realpath fails, the path doesn't exist or is not accessible
        // This is acceptable - let the actual operation handle the error
      }

      return {
        isValid: true,
        normalizedPath
      };

    } catch (error) {
      return {
        isValid: false,
        error: `FileSystem ValidationError: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validates multiple paths at once
   */
  async validatePaths(inputPaths: string[]): Promise<PathValidationResult[]> {
    const results = await Promise.all(
      inputPaths.map(path => this.validatePath(path))
    );
    return results;
  }

  /**
   * Checks if a path is within the allowed directories without file system access
   */
  isPathAllowed(inputPath: string): boolean {
    try {
      if (!inputPath || typeof inputPath !== 'string') return false;
      
      const normalizedPath = path.resolve(path.normalize(inputPath));
      
      return this.allowedBasePaths.some(basePath => {
        return normalizedPath.startsWith(basePath + path.sep) || 
               normalizedPath === basePath;
      });
    } catch {
      return false;
    }
  }

  /**
   * Get allowed base paths
   */
  getAllowedPaths(): string[] {
    return [...this.allowedBasePaths];
  }

  /**
   * Add an allowed base path
   */
  addAllowedPath(basePath: string): void {
    const normalizedPath = path.resolve(path.normalize(basePath));
    if (!this.allowedBasePaths.includes(normalizedPath)) {
      this.allowedBasePaths.push(normalizedPath);
    }
  }
}

// Export a default instance for general use with config
const config = getFilesystemConfig();
export const defaultPathValidator = new PathValidator(config.security.allowedPaths);
