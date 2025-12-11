export class PathSanitizer {
  /**
   * Sanitizes a file or directory path for safe display/logging
   */
  sanitizePath(inputPath: string): string {
    // Remove null bytes and control characters
    return inputPath.replace(/[\x00-\x1f\x7f]/g, '')
      .replace(/\/+/, '/');
  }

  /**
   * Sanitizes a filename for safe use (removes dangerous characters)
   */
  sanitizeFilename(filename: string): string {
    // Remove path separators and control characters
    return filename.replace(/[\x00-\x1f\x7f/\\]/g, '')
      .replace(/\.+$/, ''); // Remove trailing dots
  }
}

export const defaultPathSanitizer = new PathSanitizer();
