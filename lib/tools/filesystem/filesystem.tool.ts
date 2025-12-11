// Filesystem Tool Definition - Phase 2 Implementation
// Read-only filesystem operations with security-first design
// Date: October 13, 2025
// Updated: 2025-10-15 - Added YAML config support

import { ToolDefinition } from '../types';
import { defaultFilesystemTool } from './index';
import { getFilesystemConfig } from '../../config/toolsConfig';

// Load configuration from YAML or use defaults
const config = getFilesystemConfig();

/**
 * Filesystem Tool Definition
 * Provides secure filesystem operations with comprehensive security validation
 */
const filesystemTool: ToolDefinition = {
  name: 'filesystem',
  description: 'Secure filesystem operations for LOCAL files only. ONLY use when the user explicitly asks to read, write, list, or search files on their computer. Do NOT use for web search results or reports. Supports read, write, search, and archive operations.',
  version: '2.0.0',

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Filesystem operation to perform',
        enum: [
          'list_directory', 'read_file', 'file_info', 'read_chunk', 'search_content',
          'write_file', 'create_directory',
          'move', 'copy', 'delete',
          'create_archive', 'extract_archive'
        ],
      },
      path: {
        type: 'string',
        description: 'File or directory path (relative to allowed directories)',
      },
      source: {
        type: 'string',
        description: 'Source path for move, copy, or archive operations',
      },
      destination: {
        type: 'string',
        description: 'Destination path for move, copy, or archive operations',
      },
      content: {
        type: 'string',
        description: 'Content for write_file operation',
      },
      query: {
        type: 'string',
        description: 'Search query for search_content operation',
      },
      encoding: {
        type: 'string',
        description: 'Text encoding for file reading (default: utf8)',
        enum: ['utf8', 'ascii', 'latin1', 'base64', 'hex'],
        default: 'utf8',
      },
      options: {
        type: 'object',
        description: 'Operation-specific options (e.g., { recursive: true, i_am_sure: true })',
      },
    },
    required: ['operation'],
  },

  config: {
    enabled: config.enabled,
    maxFileSize: config.limits.maxFileSize,
    maxDirectoryItems: config.limits.maxDirectoryItems,
    allowedPaths: config.security.allowedPaths,
  },
  
  async execute(params: Record<string, unknown>) {
    const {
      operation,
      path: targetPath,
      source,
      destination,
      content,
      query,
      encoding = 'utf8',
      options = {}
    } = params;
    
    // Type validation
    if (typeof operation !== 'string') {
      throw new Error('[FileSystem] ValidationError: operation must be a string');
    }
    
    // Execute the requested operation (operations throw errors on failure)
    switch (operation) {
      case 'list_directory':
        if (!targetPath || typeof targetPath !== 'string') {
          throw new Error('[FileSystem] ValidationError: path is required and must be a string');
        }
        return await defaultFilesystemTool.listDirectory(targetPath);
        
      case 'read_file':
        if (!targetPath || typeof targetPath !== 'string') {
          throw new Error('[FileSystem] ValidationError: path is required and must be a string');
        }
        return await defaultFilesystemTool.readFile(targetPath, encoding as string);
        
      case 'file_info':
        if (!targetPath || typeof targetPath !== 'string') {
          throw new Error('[FileSystem] ValidationError: path is required and must be a string');
        }
        return await defaultFilesystemTool.getFileInfo(targetPath);

      case 'read_chunk':
        if (!targetPath || typeof targetPath !== 'string') {
          throw new Error('[FileSystem] ValidationError: path is required and must be a string');
        }
        return await defaultFilesystemTool.readChunk(targetPath, options as Record<string, unknown>);

      case 'search_content':
        if (!targetPath || typeof targetPath !== 'string') {
          throw new Error('[FileSystem] ValidationError: path is required and must be a string');
        }
        if (!query || typeof query !== 'string') {
          throw new Error('[FileSystem] ValidationError: query is required and must be a string');
        }
        return await defaultFilesystemTool.searchContent(targetPath, query, options as Record<string, unknown>);

      case 'write_file':
        if (!targetPath || typeof targetPath !== 'string') {
          throw new Error('[FileSystem] ValidationError: path is required and must be a string');
        }
        if (!content || typeof content !== 'string') {
          throw new Error('[FileSystem] ValidationError: content is required and must be a string');
        }
        return await defaultFilesystemTool.writeFile(targetPath, content, options as Record<string, unknown>);

      case 'create_directory':
        if (!targetPath || typeof targetPath !== 'string') {
          throw new Error('[FileSystem] ValidationError: path is required and must be a string');
        }
        return await defaultFilesystemTool.createDirectory(targetPath, options as Record<string, unknown>);

      case 'move':
        if (!source || typeof source !== 'string') {
          throw new Error('[FileSystem] ValidationError: source is required and must be a string');
        }
        if (!destination || typeof destination !== 'string') {
          throw new Error('[FileSystem] ValidationError: destination is required and must be a string');
        }
        return await defaultFilesystemTool.move(source, destination);

      case 'copy':
        if (!source || typeof source !== 'string') {
          throw new Error('[FileSystem] ValidationError: source is required and must be a string');
        }
        if (!destination || typeof destination !== 'string') {
          throw new Error('[FileSystem] ValidationError: destination is required and must be a string');
        }
        return await defaultFilesystemTool.copy(source, destination, options as Record<string, unknown>);

      case 'delete':
        if (!targetPath || typeof targetPath !== 'string') {
          throw new Error('[FileSystem] ValidationError: path is required and must be a string');
        }
        return await defaultFilesystemTool.delete(targetPath, options as Record<string, unknown>);

      case 'create_archive':
        if (!source || typeof source !== 'string') {
          throw new Error('[FileSystem] ValidationError: source is required and must be a string');
        }
        if (!destination || typeof destination !== 'string') {
          throw new Error('[FileSystem] ValidationError: destination is required and must be a string');
        }
        return await defaultFilesystemTool.createArchive(source, destination);

      case 'extract_archive':
        if (!source || typeof source !== 'string') {
          throw new Error('[FileSystem] ValidationError: source is required and must be a string');
        }
        if (!destination || typeof destination !== 'string') {
          throw new Error('[FileSystem] ValidationError: destination is required and must be a string');
        }
        return await defaultFilesystemTool.extractArchive(source, destination);
        
      default:
        throw new Error(`[FileSystem] OperationError: Unknown operation '${operation}'`);
    }
  }
};

export { filesystemTool };
