# Filesystem Tool - Quick Start Guide

**For developers who need to use the tool immediately.**

## What It Does

Secure filesystem operations with comprehensive security validation: read, write, search, list, move, copy, delete, and archive files with triple-layer security protection.

## Import

```typescript
import { filesystemTool } from '@/lib/tools/filesystem/filesystem.tool';
// Or use operations directly
import { readFile, listDirectory, searchContent } from '@/lib/tools/filesystem';
```

## 12 Operations

### Read Operations

#### 1. List Directory

```typescript
const result = await filesystemTool.execute({
  operation: 'list_directory',
  path: '/path/to/directory'
});
// Returns: { path, totalItems, items: [{ name, type, size, modified, permissions }] }
```

#### 2. Read File

```typescript
const result = await filesystemTool.execute({
  operation: 'read_file',
  path: '/path/to/file.txt',
  encoding: 'utf8'  // 'utf8', 'ascii', 'base64', 'hex'
});
// Returns: { path, size, encoding, content, modified }
```

#### 3. File Info

```typescript
const result = await filesystemTool.execute({
  operation: 'file_info',
  path: '/path/to/file'
});
// Returns: { path, exists, type, size, created, modified, permissions, isReadable, isWritable }
```

#### 4. Read Chunk

```typescript
const result = await filesystemTool.execute({
  operation: 'read_chunk',
  path: '/path/to/file.txt',
  options: {
    startLine: 100,
    endLine: 200
  }
});
// Returns: { path, startLine, endLine, totalLines, lines }
```

#### 5. Search Content

```typescript
const result = await filesystemTool.execute({
  operation: 'search_content',
  path: '/path/to/search',
  query: 'search term',
  options: {
    recursive: true,
    isRegex: false,
    caseSensitive: false
  }
});
// Returns: { query, totalMatches, filesSearched, matches: [{ file, lineNumber, line }] }
```

### Write Operations

#### 6. Write File

```typescript
const result = await filesystemTool.execute({
  operation: 'write_file',
  path: '/path/to/file.txt',
  content: 'File content here',
  options: {
    createDirs: true  // Create parent directories
  }
});
// Returns: { path, bytesWritten, created }
```

#### 7. Create Directory

```typescript
const result = await filesystemTool.execute({
  operation: 'create_directory',
  path: '/path/to/new/dir',
  options: {
    recursive: true
  }
});
// Returns: { path, created }
```

### File Management

#### 8. Move

```typescript
const result = await filesystemTool.execute({
  operation: 'move',
  source: '/path/to/source.txt',
  destination: '/path/to/destination.txt'
});
// Returns: { source, destination, success }
```

#### 9. Copy

```typescript
const result = await filesystemTool.execute({
  operation: 'copy',
  source: '/path/to/source',
  destination: '/path/to/destination',
  options: {
    recursive: true,
    overwrite: false
  }
});
// Returns: { source, destination, itemsCopied, success }
```

#### 10. Delete

```typescript
const result = await filesystemTool.execute({
  operation: 'delete',
  path: '/path/to/delete',
  options: {
    i_am_sure: true,  // REQUIRED confirmation
    recursive: true
  }
});
// Returns: { path, deleted, type }
```

### Archive Operations

#### 11. Create Archive

```typescript
const result = await filesystemTool.execute({
  operation: 'create_archive',
  source: '/path/to/directory',
  destination: '/path/to/archive.zip'
});
// Returns: { source, destination, size, filesArchived }
```

#### 12. Extract Archive

```typescript
const result = await filesystemTool.execute({
  operation: 'extract_archive',
  source: '/path/to/archive.zip',
  destination: '/path/to/extract'
});
// Returns: { source, destination, filesExtracted }
```

## Direct Operation Usage

```typescript
import { readFile, listDirectory, searchContent } from '@/lib/tools/filesystem';

// Read file
const file = await readFile('/path/to/file.txt', {
  encoding: 'utf8',
  maxSize: 1024 * 1024  // 1MB
});

console.log(file.content);

// List directory
const dir = await listDirectory('/path/to/dir', {
  maxItems: 1000
});

dir.items.forEach(item => {
  console.log(`${item.type}: ${item.name}`);
});

// Search
const results = await searchContent('/path', 'query', {
  recursive: true,
  maxResults: 100
});

console.log(`Found ${results.totalMatches} matches`);
```

## Common Patterns

### 1. Read and Parse Config

```typescript
async function loadConfig() {
  const file = await filesystemTool.execute({
    operation: 'read_file',
    path: '/config/app.json'
  });

  const config = JSON.parse(file.content);
  console.log('Config loaded:', config);
  return config;
}
```

### 2. Search for TODOs

```typescript
async function findTodos(projectPath: string) {
  const results = await filesystemTool.execute({
    operation: 'search_content',
    path: projectPath,
    query: 'TODO|FIXME|HACK',
    options: {
      recursive: true,
      isRegex: true
    }
  });

  console.log(`Found ${results.totalMatches} TODOs:`);
  results.matches.forEach(m => {
    console.log(`${m.file}:${m.lineNumber}`);
    console.log(`  ${m.line}`);
  });
}
```

### 3. List Files by Extension

```typescript
async function findFiles(dir: string, extension: string) {
  const listing = await filesystemTool.execute({
    operation: 'list_directory',
    path: dir
  });

  const files = listing.items.filter(item =>
    item.type === 'file' && item.name.endsWith(extension)
  );

  console.log(`Found ${files.length} .${extension} files`);
  return files;
}
```

### 4. Backup Directory

```typescript
async function backup(sourcePath: string) {
  const timestamp = new Date().toISOString().split('T')[0];
  const backupPath = `/backups/backup-${timestamp}.zip`;

  const archive = await filesystemTool.execute({
    operation: 'create_archive',
    source: sourcePath,
    destination: backupPath
  });

  console.log(`Backed up ${archive.filesArchived} files`);
  console.log(`Size: ${(archive.size / 1024 / 1024).toFixed(2)} MB`);
  return backupPath;
}
```

### 5. Organize Files

```typescript
async function organizeByExtension(dir: string) {
  const listing = await filesystemTool.execute({
    operation: 'list_directory',
    path: dir
  });

  const byExt = new Map();
  listing.items.forEach(item => {
    if (item.type === 'file') {
      const ext = item.name.split('.').pop() || 'no-ext';
      if (!byExt.has(ext)) byExt.set(ext, []);
      byExt.get(ext).push(item.name);
    }
  });

  for (const [ext, files] of byExt) {
    const extDir = `${dir}/${ext}`;

    await filesystemTool.execute({
      operation: 'create_directory',
      path: extDir
    });

    for (const file of files) {
      await filesystemTool.execute({
        operation: 'move',
        source: `${dir}/${file}`,
        destination: `${extDir}/${file}`
      });
    }

    console.log(`Organized ${files.length} .${ext} files`);
  }
}
```

### 6. Log Analysis

```typescript
async function analyzeLogs(logPath: string) {
  // Get file size
  const info = await filesystemTool.execute({
    operation: 'file_info',
    path: logPath
  });

  console.log(`Log size: ${(info.size / 1024 / 1024).toFixed(2)} MB`);

  // Search for errors
  const errors = await filesystemTool.execute({
    operation: 'search_content',
    path: logPath,
    query: 'ERROR|FATAL',
    options: { isRegex: true }
  });

  console.log(`Found ${errors.totalMatches} errors`);

  // Read last 100 lines
  const recent = await filesystemTool.execute({
    operation: 'read_chunk',
    path: logPath,
    options: { maxLines: 100 }
  });

  console.log('Recent entries:');
  recent.lines.slice(-10).forEach(line => console.log(line));
}
```

## Security Features

### Allowed Paths

```bash
# Configure in environment
FILESYSTEM_ALLOWED_PATHS=/home/user/projects,/var/log,/data
```

Only paths within these directories are accessible.

### Blocked Patterns

Automatically blocked:
- Path traversal: `../`
- System directories: `/proc`, `/sys`, `/dev`
- Windows system: `C:\Windows`, `C:\Program Files`
- Control characters and null bytes

### Triple-Layer Security

1. **Path Validation**: Normalize, resolve, check allowed paths
2. **Permission Check**: Verify read/write permissions
3. **Path Sanitization**: Clean paths in responses

## Configuration

### Environment Variables

```bash
# Enable tool
FILESYSTEM_ENABLED=true

# Size limits
FILESYSTEM_MAX_FILE_SIZE=1048576          # 1MB
FILESYSTEM_MAX_DIRECTORY_ITEMS=1000

# Security
FILESYSTEM_ALLOWED_PATHS=/home/user/projects,/data
```

### Runtime Options

```typescript
import { FilesystemTool } from '@/lib/tools/filesystem';

const tool = new FilesystemTool(
  1024 * 1024 * 5,  // 5MB max file size
  2000              // Max directory items
);
```

## Encodings Supported

- `utf8` - Unicode text (default)
- `ascii` - ASCII text
- `latin1` - Latin-1 text
- `base64` - Binary as base64
- `hex` - Binary as hexadecimal

## Size Limits

| Item | Default Limit | Configurable |
|------|---------------|--------------|
| File size | 1MB | Yes |
| Directory items | 1000 | Yes |
| Path length | 4096 chars | No |
| Search results | 1000 | Yes (per query) |
| Directory depth | 20 levels | Yes (per query) |

## Error Handling

```typescript
try {
  const result = await filesystemTool.execute({
    operation: 'read_file',
    path: '/path/to/file.txt'
  });

  console.log('Success:', result.content);
} catch (error) {
  console.error('Error:', error.message);

  // Common errors:
  // - "ValidationError: Path must be a non-empty string"
  // - "SecurityError: Path is outside allowed directories"
  // - "SecurityError: Path contains blocked pattern"
  // - "PermissionError: Read access denied"
  // - "OperationError: Path is not a file"
  // - "LimitError: File size exceeds limit"
}
```

## When to Use

### ✅ Good Use Cases
- Read configuration files
- Parse log files
- Search codebases
- List project structure
- Create build artifacts
- Organize files
- Backup directories
- Extract archives

### ❌ Bad Use Cases
- System files (`/proc`, `/sys`, `/dev`)
- Extremely large files (>100MB)
- Real-time file monitoring
- Database-like queries
- Binary file processing (limited support)

## Quick Tips

1. **Use absolute paths**: Avoid relative paths and `../`
2. **Check file size first**: Use `file_info` before `read_file` for large files
3. **Limit search scope**: Use `maxDepth` and `maxResults` for searches
4. **Chunk large files**: Use `read_chunk` instead of `read_file` for huge files
5. **Confirm deletions**: Always set `i_am_sure: true` for delete operations
6. **Recursive operations**: Enable `recursive: true` for directories
7. **Check encoding**: Use correct encoding for binary vs text files
8. **Create parent dirs**: Set `createDirs: true` when writing to new locations

## Troubleshooting

### Path outside allowed directories

```bash
# Add to allowed paths
FILESYSTEM_ALLOWED_PATHS=/home/user/projects,/new/path
```

### File too large

```typescript
// Increase limit
const file = await readFile('/large.txt', {
  maxSize: 1024 * 1024 * 10  // 10MB
});
```

### Permission denied

```bash
# Check file permissions
ls -la /path/to/file
chmod 644 /path/to/file
```

### Path contains ../

```typescript
// Use absolute paths only
{ path: '/home/user/projects/file.txt' }  // Good
{ path: '../secret/file.txt' }             // Bad
```

## Real-World Examples

### Example 1: Find Large Files

```typescript
async function findLargeFiles(dir: string, minSizeMB: number) {
  const listing = await filesystemTool.execute({
    operation: 'list_directory',
    path: dir
  });

  const large = listing.items.filter(item =>
    item.type === 'file' &&
    item.size > minSizeMB * 1024 * 1024
  );

  large.sort((a, b) => b.size - a.size);

  console.log(`Large files (>${minSizeMB}MB):`);
  large.forEach(file => {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    console.log(`  ${file.name}: ${sizeMB} MB`);
  });

  return large;
}
```

### Example 2: Clean Old Logs

```typescript
async function cleanOldLogs(logDir: string, daysOld: number) {
  const listing = await filesystemTool.execute({
    operation: 'list_directory',
    path: logDir
  });

  const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

  const oldLogs = listing.items.filter(item =>
    item.type === 'file' &&
    item.name.endsWith('.log') &&
    new Date(item.modified).getTime() < cutoff
  );

  console.log(`Deleting ${oldLogs.length} old logs...`);

  for (const log of oldLogs) {
    await filesystemTool.execute({
      operation: 'delete',
      path: `${logDir}/${log.name}`,
      options: { i_am_sure: true }
    });
    console.log(`  Deleted: ${log.name}`);
  }
}
```

### Example 3: Extract and Process Archive

```typescript
async function processArchive(zipPath: string, extractTo: string) {
  // Extract
  const extracted = await filesystemTool.execute({
    operation: 'extract_archive',
    source: zipPath,
    destination: extractTo
  });

  console.log(`Extracted ${extracted.filesExtracted} files`);

  // List contents
  const listing = await filesystemTool.execute({
    operation: 'list_directory',
    path: extractTo
  });

  // Process each file
  for (const item of listing.items) {
    if (item.type === 'file' && item.name.endsWith('.json')) {
      const file = await filesystemTool.execute({
        operation: 'read_file',
        path: `${extractTo}/${item.name}`
      });

      const data = JSON.parse(file.content);
      console.log(`Processed: ${item.name}`, data);
    }
  }
}
```

## Need More Details?

See full documentation: `/lib/tools/filesystem/README.md`

## Test It

```bash
npx tsx -e "
import { filesystemTool } from './filesystem.tool';
const result = await filesystemTool.execute({
  operation: 'list_directory',
  path: '.'
});
console.log('Files:', result.totalItems);
"
```
