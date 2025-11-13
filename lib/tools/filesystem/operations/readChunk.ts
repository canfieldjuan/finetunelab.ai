import { defaultPathValidator } from '../security/pathValidator';
import { defaultPermissionChecker } from '../security/permissionCheck';
import { defaultPathSanitizer } from '../security/sanitizer';
import * as fs from 'fs/promises';
import * as readline from 'readline';
import { createReadStream } from 'fs';

export interface ReadChunkOptions {
  startLine?: number;
  endLine?: number;
  maxLines?: number;
}

/**
 * Read a chunk of a file by line numbers
 * Useful for reading large files without loading entire content into memory
 */
export async function readChunk(
  filePath: string,
  options: ReadChunkOptions = {}
) {
  const { startLine = 1, endLine, maxLines = 1000 } = options;
  
  if (startLine < 1) {
    throw new Error('[FileSystem] ValidationError: startLine must be >= 1');
  }
  
  if (endLine !== undefined && endLine < startLine) {
    throw new Error('[FileSystem] ValidationError: endLine must be >= startLine');
  }
  
  const requestedLines = endLine ? endLine - startLine + 1 : maxLines;
  if (requestedLines > maxLines) {
    throw new Error(
      `[FileSystem] LimitError: Requested ${requestedLines} lines exceeds maximum of ${maxLines}`
    );
  }

  // Security validation
  const pathValidation = await defaultPathValidator.validatePath(filePath);
  if (!pathValidation.isValid) {
    throw new Error(pathValidation.error || '[FileSystem] SecurityError: Invalid file path');
  }

  const permissionCheck = await defaultPermissionChecker.canRead(
    pathValidation.normalizedPath!
  );
  if (!permissionCheck.hasPermission) {
    throw new Error(permissionCheck.error || '[FileSystem] PermissionError: Read access denied');
  }

  const stats = await fs.stat(pathValidation.normalizedPath!);
  if (!stats.isFile()) {
    throw new Error('[FileSystem] OperationError: Path is not a file');
  }

  const lines: string[] = [];
  let currentLine = 0;
  let totalLines = 0;

  const fileStream = createReadStream(pathValidation.normalizedPath!);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    currentLine++;
    totalLines = currentLine;
    
    if (currentLine >= startLine && (!endLine || currentLine <= endLine)) {
      lines.push(line);
    }
    
    if (endLine && currentLine > endLine) {
      break;
    }
    
    if (!endLine && lines.length >= maxLines) {
      break;
    }
  }

  return {
    path: defaultPathSanitizer.sanitizePath(pathValidation.normalizedPath!),
    startLine,
    endLine: currentLine,
    totalLinesRead: totalLines,
    linesReturned: lines.length,
    lines,
    modified: stats.mtime.toISOString()
  };
}
