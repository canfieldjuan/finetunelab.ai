// Filesystem Adapter Interface
// Phase 2: Web App Support - Adapter Pattern

export interface FileItem {
  name: string;
  type: 'directory' | 'file' | 'other' | 'error';
  size?: number;
  modified?: string;
  permissions?: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
  };
  error?: string;
}

export interface ListDirectoryResult {
  path: string;
  itemCount: number;
  items: FileItem[];
}

export interface ReadFileResult {
  path: string;
  size: number;
  encoding: string;
  content: string;
  modified: string;
}

export interface FileInfoResult {
  path: string;
  type: 'file' | 'directory' | 'other';
  size: number;
  modified: string;
  accessed?: string;
  created?: string;
  permissions?: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
  };
}

export interface FilesystemAdapter {
  listDirectory(path: string, options?: Record<string, unknown>): Promise<ListDirectoryResult>;
  readFile(path: string, options?: Record<string, unknown>): Promise<ReadFileResult>;
  getFileInfo(path: string): Promise<FileInfoResult>;
}

export type FilesystemMode = 'local' | 'remote';
