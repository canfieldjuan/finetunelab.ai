import { defaultPathValidator } from '../security/pathValidator';
import { defaultPermissionChecker } from '../security/permissionCheck';
import { defaultPathSanitizer } from '../security/sanitizer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { createReadStream } from 'fs';

export interface SearchContentOptions {
  recursive?: boolean;
  isRegex?: boolean;
  maxDepth?: number;
  maxResults?: number;
  caseSensitive?: boolean;
}

interface SearchMatch {
  file: string;
  lineNumber: number;
  line: string;
  matchStart?: number;
  matchEnd?: number;
}

interface SearchResult {
  query: string;
  totalMatches: number;
  filesSearched: number;
  matches: SearchMatch[];
}

/**
 * Search for content in a file or recursively in a directory
 */
export async function searchContent(
  targetPath: string,
  query: string,
  options: SearchContentOptions = {}
): Promise<SearchResult> {
  const {
    recursive = false,
    isRegex = false,
    maxDepth = 10,
    maxResults = 1000,
    caseSensitive = false
  } = options;

  if (!query || typeof query !== 'string') {
    throw new Error('[FileSystem] ValidationError: query must be a non-empty string');
  }

  if (maxDepth < 1 || maxDepth > 20) {
    throw new Error('[FileSystem] ValidationError: maxDepth must be between 1 and 20');
  }

  const pathValidation = await defaultPathValidator.validatePath(targetPath);
  if (!pathValidation.isValid) {
    throw new Error(pathValidation.error || '[FileSystem] SecurityError: Invalid path');
  }

  const permissionCheck = await defaultPermissionChecker.canRead(
    pathValidation.normalizedPath!
  );
  if (!permissionCheck.hasPermission) {
    throw new Error(permissionCheck.error || '[FileSystem] PermissionError: Read access denied');
  }

  const stats = await fs.stat(pathValidation.normalizedPath!);
  const matches: SearchMatch[] = [];
  let filesSearched = 0;

  let searchPattern: RegExp;
  try {
    if (isRegex) {
      searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } else {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchPattern = new RegExp(escapedQuery, caseSensitive ? 'g' : 'gi');
    }
  } catch (error) {
    throw new Error(
      `[FileSystem] ValidationError: Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  if (stats.isFile()) {
    await searchInFile(
      pathValidation.normalizedPath!,
      searchPattern,
      matches,
      maxResults
    );
    filesSearched = 1;
  } else if (stats.isDirectory() && recursive) {
    filesSearched = await searchInDirectory(
      pathValidation.normalizedPath!,
      searchPattern,
      matches,
      maxResults,
      maxDepth,
      0
    );
  } else {
    throw new Error(
      '[FileSystem] OperationError: Path is a directory but recursive option is false'
    );
  }

  return {
    query,
    totalMatches: matches.length,
    filesSearched,
    matches
  };
}

/**
 * Search for pattern in a single file
 */
async function searchInFile(
  filePath: string,
  pattern: RegExp,
  matches: SearchMatch[],
  maxResults: number
): Promise<void> {
  if (matches.length >= maxResults) {
    return;
  }

  const fileStream = createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    
    pattern.lastIndex = 0;
    const match = pattern.exec(line);
    
    if (match) {
      matches.push({
        file: defaultPathSanitizer.sanitizePath(filePath),
        lineNumber,
        line: line.substring(0, 500),
        matchStart: match.index,
        matchEnd: match.index + match[0].length
      });

      if (matches.length >= maxResults) {
        rl.close();
        break;
      }
    }
  }
}

/**
 * Recursively search in a directory
 */
async function searchInDirectory(
  dirPath: string,
  pattern: RegExp,
  matches: SearchMatch[],
  maxResults: number,
  maxDepth: number,
  currentDepth: number
): Promise<number> {
  if (currentDepth >= maxDepth || matches.length >= maxResults) {
    return 0;
  }

  let filesSearched = 0;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (matches.length >= maxResults) {
        break;
      }

      const fullPath = path.join(dirPath, entry.name);

      const pathValidation = await defaultPathValidator.validatePath(fullPath);
      if (!pathValidation.isValid) {
        continue;
      }

      const permissionCheck = await defaultPermissionChecker.canRead(fullPath);
      if (!permissionCheck.hasPermission) {
        continue;
      }

      if (entry.isFile()) {
        await searchInFile(fullPath, pattern, matches, maxResults);
        filesSearched++;
      } else if (entry.isDirectory()) {
        const subFilesSearched = await searchInDirectory(
          fullPath,
          pattern,
          matches,
          maxResults,
          maxDepth,
          currentDepth + 1
        );
        filesSearched += subFilesSearched;
      }
    }
  } catch (error) {
    console.error(`[FileSystem] Error searching directory ${dirPath}:`, error);
  }

  return filesSearched;
}
