// Remote Filesystem Adapter
// Phase 2: HTTP API access to local agent filesystem endpoints

import {
  FilesystemAdapter,
  ListDirectoryResult,
  ReadFileResult,
  FileInfoResult
} from './types';

export interface RemoteAdapterConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export class RemoteAdapter implements FilesystemAdapter {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;

  constructor(config: RemoteAdapterConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;

    console.log(`[RemoteAdapter] Initialized with baseUrl: ${this.baseUrl}`);
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    return headers;
  }

  async listDirectory(
    directoryPath: string,
    options: { maxItems?: number } = {}
  ): Promise<ListDirectoryResult> {
    console.log(`[RemoteAdapter] listDirectory: ${directoryPath}`);

    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/filesystem/list`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            path: directoryPath,
            max_items: options.maxItems
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`[RemoteAdapter] Found ${data.total_count} items`);

      return {
        path: data.path,
        itemCount: data.total_count,
        items: data.items
      };
    } catch (error) {
      console.error(`[RemoteAdapter] Error:`, error);
      throw error;
    }
  }

  async readFile(
    filePath: string,
    options: { encoding?: string; maxSize?: number } = {}
  ): Promise<ReadFileResult> {
    const { encoding = 'utf8', maxSize } = options;

    console.log(`[RemoteAdapter] readFile: ${filePath}`);

    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/filesystem/read`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            path: filePath,
            encoding,
            max_size: maxSize
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`[RemoteAdapter] Read ${data.size_bytes} bytes`);

      return {
        path: data.path,
        size: data.size_bytes,
        encoding: data.encoding,
        content: data.content,
        modified: data.modified
      };
    } catch (error) {
      console.error(`[RemoteAdapter] Error:`, error);
      throw error;
    }
  }

  async getFileInfo(targetPath: string): Promise<FileInfoResult> {
    console.log(`[RemoteAdapter] getFileInfo: ${targetPath}`);

    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/filesystem/info`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ path: targetPath })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        path: data.path,
        type: data.type,
        size: data.size_bytes,
        modified: data.modified,
        accessed: data.accessed,
        created: data.created,
        permissions: data.permissions
      };
    } catch (error) {
      console.error(`[RemoteAdapter] Error:`, error);
      throw error;
    }
  }
}
