import {
  listDirectory,
  readFile,
  getFileInfo,
  readChunk,
  searchContent,
  writeFile,
  createDirectory,
  move,
  copy,
  deleteFile,
  createArchive,
  extractArchive,
  ReadChunkOptions,
  SearchContentOptions,
  WriteFileOptions,
  CreateDirectoryOptions,
  CopyOptions,
  DeleteOptions
} from './operations';

/**
 * Read-only filesystem operations with security-first design
 * Phase 2: Core Operations Implementation (Modular Structure)
 */
export class FilesystemTool {
  readonly name = 'filesystem';
  readonly description = 'Read-only filesystem operations with security validation';

  private readonly maxFileSize: number;
  private readonly maxDirectoryItems: number;

  constructor(
    maxFileSize: number = 1024 * 1024, // 1MB default
    maxDirectoryItems: number = 1000
  ) {
    this.maxFileSize = maxFileSize;
    this.maxDirectoryItems = maxDirectoryItems;
  }

  /**
   * List directory contents
   */
  async listDirectory(directoryPath: string) {
    return listDirectory(directoryPath, { maxItems: this.maxDirectoryItems });
  }

  /**
   * Read file contents with size limit
   */
  async readFile(filePath: string, encoding: string = 'utf8') {
    return readFile(filePath, { encoding, maxSize: this.maxFileSize });
  }

  /**
   * Get file or directory information
   */
  async getFileInfo(targetPath: string) {
    return getFileInfo(targetPath);
  }

  /**
   * Read a chunk of a file by line numbers
   */
  async readChunk(filePath: string, options: ReadChunkOptions = {}) {
    return readChunk(filePath, options);
  }

  /**
   * Search for content in files
   */
  async searchContent(targetPath: string, query: string, options: SearchContentOptions = {}) {
    return searchContent(targetPath, query, options);
  }

  /**
   * Write content to a file
   */
  async writeFile(filePath: string, content: string, options: WriteFileOptions = {}) {
    return writeFile(filePath, content, options);
  }

  /**
   * Create a directory
   */
  async createDirectory(dirPath: string, options: CreateDirectoryOptions = {}) {
    return createDirectory(dirPath, options);
  }

  /**
   * Move or rename a file or directory
   */
  async move(sourcePath: string, destinationPath: string) {
    return move(sourcePath, destinationPath);
  }

  /**
   * Copy a file or directory
   */
  async copy(sourcePath: string, destinationPath: string, options: CopyOptions = {}) {
    return copy(sourcePath, destinationPath, options);
  }

  /**
   * Delete a file or directory (requires confirmation)
   */
  async delete(targetPath: string, options: DeleteOptions = {}) {
    return deleteFile(targetPath, options);
  }

  /**
   * Create a zip archive
   */
  async createArchive(sourcePath: string, destinationPath: string) {
    return createArchive(sourcePath, destinationPath);
  }

  /**
   * Extract a zip archive
   */
  async extractArchive(sourcePath: string, destinationPath: string) {
    return extractArchive(sourcePath, destinationPath);
  }
}

// Export a default instance
export const defaultFilesystemTool = new FilesystemTool();

// Re-export operations for direct use
export {
  listDirectory,
  readFile,
  getFileInfo,
  readChunk,
  searchContent,
  writeFile,
  createDirectory,
  move,
  copy,
  deleteFile,
  createArchive,
  extractArchive
} from './operations';
