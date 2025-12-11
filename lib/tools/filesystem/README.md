# Filesystem Tool

**Version:** 2.0.0
**Location:** `/lib/tools/filesystem`
**Type:** File System Operations
**Access:** READ + WRITE (Security-First)

---

## Overview

The **Filesystem Tool** provides secure filesystem operations with comprehensive security validation. It implements a defense-in-depth approach with path validation, permission checking, path sanitization, and configurable access controls.

### Key Features

- **12 Operations:** Read, write, search, list, move, copy, delete, archive
- **Triple-Layer Security:** Path validation, permission checks, path sanitization
- **Path Traversal Protection:** Blocks `../`, symlink escapes, dangerous paths
- **Size Limits:** Configurable file size and directory item limits
- **Allowed Paths:** Whitelist-based directory access control
- **Safe Defaults:** Read-only focus with explicit opt-in for writes
- **Modular Architecture:** Separate operation modules for maintainability
- **Comprehensive Error Handling:** Detailed, actionable error messages

---

## What It Does

### 12 Core Operations

**Read Operations:**
1. **list_directory** - List files and subdirectories
2. **read_file** - Read complete file contents
3. **file_info** - Get file/directory metadata
4. **read_chunk** - Read specific line ranges
5. **search_content** - Search files with regex support

**Write Operations:**
6. **write_file** - Write or overwrite files
7. **create_directory** - Create directories

**File Management:**
8. **move** - Move/rename files and directories
9. **copy** - Copy files and directories
10. **delete** - Delete files and directories (requires confirmation)

**Archive Operations:**
11. **create_archive** - Create ZIP archives
12. **extract_archive** - Extract ZIP archives

---

## Architecture

### File Structure

```
filesystem/
├── index.ts                    # FilesystemTool class and exports
├── filesystem.tool.ts          # Tool definition for registry
├── operations/                 # Operation implementations
│   ├── index.ts                # Operation exports
│   ├── listDirectory.ts        # Directory listing
│   ├── readFile.ts             # File reading
│   ├── getFileInfo.ts          # Metadata retrieval
│   ├── readChunk.ts            # Chunked reading
│   ├── search.ts               # Content search
│   ├── writeFile.ts            # File writing
│   ├── createDirectory.ts      # Directory creation
│   ├── move.ts                 # Move/rename
│   ├── copy.ts                 # Copy operations
│   ├── delete.ts               # Delete operations
│   └── archive.ts              # ZIP creation/extraction
├── security/                   # Security layer
│   ├── pathValidator.ts        # Path validation
│   ├── permissionCheck.ts      # Permission checking
│   └── sanitizer.ts            # Path sanitization
└── types/                      # TypeScript types
```

### Security Architecture

**Triple-Layer Defense:**

1. **Path Validation (`pathValidator.ts`):**
   - Normalize and resolve paths
   - Block path traversal (`../`)
   - Block dangerous paths (`/proc`, `/sys`, `/dev`, etc.)
   - Verify within allowed directories
   - Check symlink targets

2. **Permission Checking (`permissionCheck.ts`):**
   - Verify read/write permissions
   - Check file/directory existence
   - Validate operation type

3. **Path Sanitization (`sanitizer.ts`):**
   - Remove sensitive path information
   - Safe path display in responses

**Security Flow:**
```typescript
User Request
    ↓
Path Validation (pathValidator)
    ↓
Permission Check (permissionChecker)
    ↓
Operation Execution
    ↓
Path Sanitization (sanitizer)
    ↓
Response
```

---

## How to Use

### Basic Usage

```typescript
import { filesystemTool } from '@/lib/tools/filesystem/filesystem.tool';

// List directory
const files = await filesystemTool.execute({
  operation: 'list_directory',
  path: '/path/to/directory'
});

// Read file
const content = await filesystemTool.execute({
  operation: 'read_file',
  path: '/path/to/file.txt',
  encoding: 'utf8'
});

// Search content
const results = await filesystemTool.execute({
  operation: 'search_content',
  path: '/path/to/search',
  query: 'search term',
  options: { recursive: true }
});
```

### Direct Operation Usage

```typescript
import { readFile, listDirectory, searchContent } from '@/lib/tools/filesystem';

// Read file directly
const file = await readFile('/path/to/file.txt', {
  encoding: 'utf8',
  maxSize: 1024 * 1024  // 1MB limit
});

// List directory
const dir = await listDirectory('/path/to/dir', {
  maxItems: 1000
});

// Search content
const search = await searchContent('/path', 'pattern', {
  recursive: true,
  isRegex: true,
  maxResults: 100
});
```

---

## Operations

### 1. List Directory

List files and subdirectories in a directory.

**Parameters:**
```typescript
{
  operation: 'list_directory',
  path: string,           // Directory path
  options?: {
    maxItems?: number     // Max items to return (default: 1000)
  }
}
```

**Response:**
```typescript
{
  path: string,
  totalItems: number,
  items: Array<{
    name: string,
    type: 'file' | 'directory' | 'symlink' | 'other',
    size: number,
    modified: string,      // ISO timestamp
    permissions: string
  }>
}
```

**Example:**
```typescript
const result = await filesystemTool.execute({
  operation: 'list_directory',
  path: '/home/user/projects'
});

console.log(`Found ${result.totalItems} items`);
result.items.forEach(item => {
  console.log(`${item.type.padEnd(10)} ${item.name} (${item.size} bytes)`);
});
```

**Use Cases:**
- Browse project structure
- List log files
- Find configuration files
- Inventory directories

---

### 2. Read File

Read complete file contents with encoding support.

**Parameters:**
```typescript
{
  operation: 'read_file',
  path: string,           // File path
  encoding?: string,      // 'utf8', 'ascii', 'latin1', 'base64', 'hex'
  options?: {
    maxSize?: number      // Max file size (default: 1MB)
  }
}
```

**Response:**
```typescript
{
  path: string,
  size: number,
  encoding: string,
  content: string,
  modified: string         // ISO timestamp
}
```

**Example:**
```typescript
// Read text file
const text = await filesystemTool.execute({
  operation: 'read_file',
  path: '/config/settings.json',
  encoding: 'utf8'
});

const config = JSON.parse(text.content);
console.log('Config:', config);

// Read binary file as base64
const binary = await filesystemTool.execute({
  operation: 'read_file',
  path: '/images/logo.png',
  encoding: 'base64'
});

console.log('Base64 image:', binary.content.substring(0, 50) + '...');
```

**Supported Encodings:**
- `utf8` (default): Unicode text
- `ascii`: ASCII text
- `latin1`: Latin-1 text
- `base64`: Binary as base64
- `hex`: Binary as hexadecimal

**Size Limits:**
- Default: 1MB
- Configurable per request
- Prevents memory exhaustion

---

### 3. File Info

Get file or directory metadata without reading contents.

**Parameters:**
```typescript
{
  operation: 'file_info',
  path: string             // File or directory path
}
```

**Response:**
```typescript
{
  path: string,
  exists: boolean,
  type: 'file' | 'directory' | 'symlink' | 'other',
  size: number,
  created: string,         // ISO timestamp
  modified: string,        // ISO timestamp
  accessed: string,        // ISO timestamp
  permissions: string,
  isReadable: boolean,
  isWritable: boolean
}
```

**Example:**
```typescript
const info = await filesystemTool.execute({
  operation: 'file_info',
  path: '/var/log/app.log'
});

console.log('File:', info.path);
console.log('Size:', info.size, 'bytes');
console.log('Modified:', new Date(info.modified).toLocaleString());
console.log('Readable:', info.isReadable);
console.log('Writable:', info.isWritable);
```

**Use Cases:**
- Check if file exists
- Get file size before reading
- Check modification time
- Verify permissions

---

### 4. Read Chunk

Read specific line ranges from a file without loading the entire file.

**Parameters:**
```typescript
{
  operation: 'read_chunk',
  path: string,            // File path
  options?: {
    startLine?: number,    // Starting line (1-indexed, default: 1)
    endLine?: number,      // Ending line (inclusive)
    maxLines?: number      // Max lines to read (default: 100)
  }
}
```

**Response:**
```typescript
{
  path: string,
  startLine: number,
  endLine: number,
  totalLines: number,
  lines: string[]
}
```

**Example:**
```typescript
// Read lines 100-200 from a log file
const chunk = await filesystemTool.execute({
  operation: 'read_chunk',
  path: '/var/log/app.log',
  options: {
    startLine: 100,
    endLine: 200
  }
});

console.log(`Lines ${chunk.startLine}-${chunk.endLine}:`);
chunk.lines.forEach((line, i) => {
  console.log(`${chunk.startLine + i}: ${line}`);
});

// Read first 50 lines
const header = await filesystemTool.execute({
  operation: 'read_chunk',
  path: '/data/dataset.csv',
  options: { maxLines: 50 }
});

console.log('CSV Header:', header.lines[0]);
```

**Use Cases:**
- Read log file excerpts
- Sample large files
- View file headers
- Paginate file contents

---

### 5. Search Content

Search for text or regex patterns in files with recursive directory support.

**Parameters:**
```typescript
{
  operation: 'search_content',
  path: string,            // File or directory path
  query: string,           // Search query or regex
  options?: {
    recursive?: boolean,   // Search subdirectories (default: false)
    isRegex?: boolean,     // Treat query as regex (default: false)
    maxDepth?: number,     // Max directory depth (default: 10, max: 20)
    maxResults?: number,   // Max matches (default: 1000)
    caseSensitive?: boolean // Case-sensitive search (default: false)
  }
}
```

**Response:**
```typescript
{
  query: string,
  totalMatches: number,
  filesSearched: number,
  matches: Array<{
    file: string,
    lineNumber: number,
    line: string,          // Truncated to 500 chars
    matchStart?: number,   // Match position in line
    matchEnd?: number
  }>
}
```

**Example:**
```typescript
// Simple text search
const results = await filesystemTool.execute({
  operation: 'search_content',
  path: '/project',
  query: 'TODO',
  options: {
    recursive: true,
    caseSensitive: false
  }
});

console.log(`Found ${results.totalMatches} TODOs in ${results.filesSearched} files:`);
results.matches.forEach(match => {
  console.log(`${match.file}:${match.lineNumber}`);
  console.log(`  ${match.line}`);
});

// Regex search for function definitions
const functions = await filesystemTool.execute({
  operation: 'search_content',
  path: '/src',
  query: 'function\\s+\\w+\\s*\\(',
  options: {
    recursive: true,
    isRegex: true,
    maxDepth: 5
  }
});

console.log(`Found ${functions.totalMatches} function definitions`);
```

**Use Cases:**
- Find TODO comments
- Search error messages in logs
- Locate function/class definitions
- Find configuration values
- Code analysis

---

### 6. Write File

Write or overwrite file contents.

**Parameters:**
```typescript
{
  operation: 'write_file',
  path: string,            // File path
  content: string,         // File content
  options?: {
    encoding?: string,     // Encoding (default: 'utf8')
    createDirs?: boolean   // Create parent directories (default: false)
  }
}
```

**Response:**
```typescript
{
  path: string,
  bytesWritten: number,
  created: boolean         // true if new file, false if overwritten
}
```

**Example:**
```typescript
// Write JSON config
const config = { apiKey: 'xxx', timeout: 30000 };
const result = await filesystemTool.execute({
  operation: 'write_file',
  path: '/config/app.json',
  content: JSON.stringify(config, null, 2)
});

console.log(`Wrote ${result.bytesWritten} bytes to ${result.path}`);

// Create file with parent directories
await filesystemTool.execute({
  operation: 'write_file',
  path: '/logs/2025/10/app.log',
  content: 'Application started\n',
  options: { createDirs: true }
});
```

**Security:**
- Requires write permission
- Overwrites existing files
- Creates directories if `createDirs: true`
- Respects allowed path restrictions

---

### 7. Create Directory

Create a directory with optional recursive creation.

**Parameters:**
```typescript
{
  operation: 'create_directory',
  path: string,            // Directory path
  options?: {
    recursive?: boolean    // Create parent directories (default: true)
  }
}
```

**Response:**
```typescript
{
  path: string,
  created: boolean         // true if created, false if already existed
}
```

**Example:**
```typescript
// Create single directory
await filesystemTool.execute({
  operation: 'create_directory',
  path: '/data/exports'
});

// Create nested directories
await filesystemTool.execute({
  operation: 'create_directory',
  path: '/data/2025/10/22/logs',
  options: { recursive: true }
});
```

---

### 8. Move

Move or rename files and directories.

**Parameters:**
```typescript
{
  operation: 'move',
  source: string,          // Source path
  destination: string      // Destination path
}
```

**Response:**
```typescript
{
  source: string,
  destination: string,
  success: boolean
}
```

**Example:**
```typescript
// Rename file
await filesystemTool.execute({
  operation: 'move',
  source: '/data/old-name.txt',
  destination: '/data/new-name.txt'
});

// Move to different directory
await filesystemTool.execute({
  operation: 'move',
  source: '/tmp/report.pdf',
  destination: '/reports/2025/report.pdf'
});
```

**Security:**
- Both paths must be in allowed directories
- Destination cannot already exist
- Atomic operation (all or nothing)

---

### 9. Copy

Copy files or directories.

**Parameters:**
```typescript
{
  operation: 'copy',
  source: string,          // Source path
  destination: string,     // Destination path
  options?: {
    recursive?: boolean,   // Copy directories recursively (default: false)
    overwrite?: boolean    // Overwrite existing files (default: false)
  }
}
```

**Response:**
```typescript
{
  source: string,
  destination: string,
  itemsCopied: number,
  success: boolean
}
```

**Example:**
```typescript
// Copy single file
await filesystemTool.execute({
  operation: 'copy',
  source: '/data/template.txt',
  destination: '/data/new-file.txt'
});

// Copy directory recursively
await filesystemTool.execute({
  operation: 'copy',
  source: '/project/src',
  destination: '/backup/src',
  options: { recursive: true }
});
```

---

### 10. Delete

Delete files or directories with confirmation requirement.

**Parameters:**
```typescript
{
  operation: 'delete',
  path: string,            // Path to delete
  options: {
    i_am_sure: boolean,    // REQUIRED confirmation flag
    recursive?: boolean    // Delete directories recursively (default: false)
  }
}
```

**Response:**
```typescript
{
  path: string,
  deleted: boolean,
  type: 'file' | 'directory'
}
```

**Example:**
```typescript
// Delete single file
await filesystemTool.execute({
  operation: 'delete',
  path: '/tmp/cache.txt',
  options: { i_am_sure: true }
});

// Delete directory recursively
await filesystemTool.execute({
  operation: 'delete',
  path: '/tmp/old-data',
  options: {
    i_am_sure: true,
    recursive: true
  }
});
```

**Safety Features:**
- Requires explicit `i_am_sure: true` flag
- Throws error if confirmation missing
- Recursive deletion requires explicit flag
- No recovery after deletion

---

### 11. Create Archive

Create ZIP archive from file or directory.

**Parameters:**
```typescript
{
  operation: 'create_archive',
  source: string,          // File or directory to archive
  destination: string      // ZIP file path
}
```

**Response:**
```typescript
{
  source: string,
  destination: string,
  size: number,            // Archive size in bytes
  filesArchived: number
}
```

**Example:**
```typescript
// Archive directory
const archive = await filesystemTool.execute({
  operation: 'create_archive',
  source: '/project/dist',
  destination: '/backups/dist-2025-10-22.zip'
});

console.log(`Archived ${archive.filesArchived} files`);
console.log(`Archive size: ${(archive.size / 1024 / 1024).toFixed(2)} MB`);
```

---

### 12. Extract Archive

Extract ZIP archive to destination directory.

**Parameters:**
```typescript
{
  operation: 'extract_archive',
  source: string,          // ZIP file path
  destination: string      // Extraction directory
}
```

**Response:**
```typescript
{
  source: string,
  destination: string,
  filesExtracted: number
}
```

**Example:**
```typescript
// Extract archive
const extracted = await filesystemTool.execute({
  operation: 'extract_archive',
  source: '/downloads/package.zip',
  destination: '/temp/extracted'
});

console.log(`Extracted ${extracted.filesExtracted} files to ${extracted.destination}`);
```

---

## Security Features

### Path Validation

**Blocked Patterns:**
```typescript
/\.\./                      // Path traversal attempts
/\/\/+/                    // Multiple consecutive slashes
/^\/proc\//                // Linux proc filesystem
/^\/sys\//                 // Linux sys filesystem
/^\/dev\//                 // Device files
/\0/                       // Null bytes
/[\x00-\x1f\x7f]/         // Control characters
/^[A-Z]:\\Windows\\/i      // Windows system directory
/^[A-Z]:\\Program Files/i  // Windows Program Files
```

**Allowed Paths:**
```typescript
// Configured in config/toolsConfig
allowedPaths: [
  '/home/user/projects',
  '/var/log/app',
  '/data'
]
```

**Symlink Protection:**
```typescript
// Validates symlink targets
// Ensures symlinks don't escape allowed directories
const realPath = await fs.realpath(path);
const isAllowed = allowedPaths.some(base =>
  realPath.startsWith(base)
);
```

---

### Configuration

**Environment Variables:**
```bash
# Enable/disable filesystem tool
FILESYSTEM_ENABLED=true

# Size limits
FILESYSTEM_MAX_FILE_SIZE=1048576          # 1MB
FILESYSTEM_MAX_DIRECTORY_ITEMS=1000

# Allowed paths (comma-separated)
FILESYSTEM_ALLOWED_PATHS=/home/user/projects,/var/log,/data
```

**YAML Configuration:**
```yaml
# config/tools.yaml
filesystem:
  enabled: true
  limits:
    maxFileSize: 1048576
    maxDirectoryItems: 1000
  security:
    allowedPaths:
      - /home/user/projects
      - /var/log
      - /data
```

**Runtime Configuration:**
```typescript
import { FilesystemTool } from '@/lib/tools/filesystem';

const tool = new FilesystemTool(
  1024 * 1024 * 5,  // 5MB max file size
  2000              // 2000 max directory items
);
```

---

## When to Use

### ✅ Use Filesystem Tool When:

1. **File Reading**
   - Read configuration files
   - Parse log files
   - Load datasets
   - Read source code

2. **Directory Browsing**
   - List project structure
   - Find files
   - Inventory directories
   - Navigate file trees

3. **Content Search**
   - Find TODOs
   - Search logs for errors
   - Locate code patterns
   - Find configuration values

4. **File Management**
   - Create build artifacts
   - Organize files
   - Clean up temporary files
   - Backup data

5. **Archive Operations**
   - Create deployment packages
   - Backup directories
   - Extract downloads
   - Bundle assets

---

## When NOT to Use

### ❌ Do NOT Use Filesystem Tool When:

1. **System Files Access Needed**
   - **Limitation:** Blocked paths (`/proc`, `/sys`, `/dev`)
   - **Alternative:** Use system-specific tools
   - **Why:** Security risk, not portable

2. **Extremely Large Files**
   - **Limitation:** 1MB default file size limit
   - **Alternative:** Use streaming APIs or database
   - **Why:** Memory constraints

3. **Real-Time File Monitoring**
   - **Limitation:** Snapshot operations only
   - **Alternative:** Use file watchers (chokidar, fs.watch)
   - **Why:** Not event-driven

4. **Database-Like Queries**
   - **Limitation:** Simple text search only
   - **Alternative:** Use actual database
   - **Why:** No indexing, slow for large datasets

5. **Binary File Processing**
   - **Limitation:** Limited binary support
   - **Alternative:** Use specialized binary parsers
   - **Why:** Text-focused tool

6. **Cross-Platform Path Handling**
   - **Limitation:** Platform-specific paths
   - **Alternative:** Use path normalization
   - **Why:** Windows vs Unix differences

---

## Common Workflows

### 1. Find and Read Config Files

```typescript
async function loadConfig() {
  // List config directory
  const dir = await filesystemTool.execute({
    operation: 'list_directory',
    path: '/config'
  });

  // Find JSON files
  const configs = dir.items.filter(item =>
    item.type === 'file' && item.name.endsWith('.json')
  );

  // Read all configs
  const configData = await Promise.all(
    configs.map(async (file) => {
      const content = await filesystemTool.execute({
        operation: 'read_file',
        path: `/config/${file.name}`
      });
      return {
        name: file.name,
        data: JSON.parse(content.content)
      };
    })
  );

  console.log('Loaded configs:', configData.map(c => c.name));
  return configData;
}
```

---

### 2. Search Codebase for Issues

```typescript
async function findCodeIssues(projectPath: string) {
  // Search for TODOs
  const todos = await filesystemTool.execute({
    operation: 'search_content',
    path: projectPath,
    query: 'TODO|FIXME|HACK',
    options: {
      recursive: true,
      isRegex: true,
      maxResults: 500
    }
  });

  // Search for console.log statements
  const debugLogs = await filesystemTool.execute({
    operation: 'search_content',
    path: projectPath,
    query: 'console\\.log\\(',
    options: {
      recursive: true,
      isRegex: true
    }
  });

  console.log('Code Issues Found:');
  console.log(`  TODOs: ${todos.totalMatches}`);
  console.log(`  Debug Logs: ${debugLogs.totalMatches}`);

  return { todos, debugLogs };
}
```

---

### 3. Log File Analysis

```typescript
async function analyzeLogs(logPath: string) {
  // Get log file info
  const info = await filesystemTool.execute({
    operation: 'file_info',
    path: logPath
  });

  console.log(`Log Size: ${(info.size / 1024 / 1024).toFixed(2)} MB`);

  // Search for errors
  const errors = await filesystemTool.execute({
    operation: 'search_content',
    path: logPath,
    query: 'ERROR|FATAL|CRITICAL',
    options: {
      isRegex: true,
      caseSensitive: false
    }
  });

  console.log(`\nFound ${errors.totalMatches} errors:`);
  errors.matches.slice(0, 10).forEach(match => {
    console.log(`Line ${match.lineNumber}: ${match.line.substring(0, 100)}`);
  });

  // Read recent entries (last 100 lines)
  const recent = await filesystemTool.execute({
    operation: 'read_chunk',
    path: logPath,
    options: {
      startLine: Math.max(1, info.size / 80 - 100),  // Approximate line count
      maxLines: 100
    }
  });

  console.log('\nRecent Entries:');
  recent.lines.slice(-5).forEach(line => console.log(line));
}
```

---

### 4. Backup and Archive

```typescript
async function backupProject(projectPath: string) {
  const timestamp = new Date().toISOString().split('T')[0];
  const backupName = `backup-${timestamp}.zip`;
  const backupPath = `/backups/${backupName}`;

  // Create backup directory
  await filesystemTool.execute({
    operation: 'create_directory',
    path: '/backups',
    options: { recursive: true }
  });

  // Create archive
  const archive = await filesystemTool.execute({
    operation: 'create_archive',
    source: projectPath,
    destination: backupPath
  });

  console.log(`Backup created: ${backupPath}`);
  console.log(`  Files: ${archive.filesArchived}`);
  console.log(`  Size: ${(archive.size / 1024 / 1024).toFixed(2)} MB`);

  return backupPath;
}
```

---

### 5. File Organization

```typescript
async function organizeDownloads(downloadsPath: string) {
  // List all files
  const dir = await filesystemTool.execute({
    operation: 'list_directory',
    path: downloadsPath
  });

  // Group by extension
  const filesByType = new Map();
  dir.items.forEach(item => {
    if (item.type === 'file') {
      const ext = item.name.split('.').pop() || 'no-ext';
      if (!filesByType.has(ext)) {
        filesByType.set(ext, []);
      }
      filesByType.get(ext).push(item.name);
    }
  });

  // Create directories and move files
  for (const [ext, files] of filesByType) {
    const targetDir = `${downloadsPath}/${ext}`;

    await filesystemTool.execute({
      operation: 'create_directory',
      path: targetDir
    });

    for (const file of files) {
      await filesystemTool.execute({
        operation: 'move',
        source: `${downloadsPath}/${file}`,
        destination: `${targetDir}/${file}`
      });
    }

    console.log(`Organized ${files.length} .${ext} files`);
  }
}
```

---

## Troubleshooting

### Issue: "Path is outside allowed directories"

**Error:** `SecurityError: Path is outside allowed directories`

**Cause:** Attempting to access path not in whitelist

**Solution:**
```bash
# Add to allowed paths in config
FILESYSTEM_ALLOWED_PATHS=/home/user/projects,/var/log,/new/path
```

---

### Issue: "File size exceeds limit"

**Error:** `LimitError: File size (X bytes) exceeds limit (Y bytes)`

**Cause:** File larger than configured limit

**Solution:**
```typescript
// Increase limit for specific operation
const content = await readFile('/large-file.txt', {
  maxSize: 1024 * 1024 * 10  // 10MB
});

// Or configure globally
FILESYSTEM_MAX_FILE_SIZE=10485760  # 10MB
```

---

### Issue: "Path contains blocked pattern"

**Error:** `SecurityError: Path contains blocked pattern: \.\.`

**Cause:** Path contains `../` or other blocked patterns

**Solution:** Use absolute paths only
```typescript
// ❌ Bad
{ path: '../secret/file.txt' }

// ✅ Good
{ path: '/home/user/projects/file.txt' }
```

---

### Issue: "Permission denied"

**Error:** `PermissionError: Read/Write access denied`

**Cause:** Insufficient file system permissions

**Solution:** Check file permissions
```bash
ls -la /path/to/file
chmod 644 /path/to/file  # Read/write for owner
```

---

## Testing

```bash
# Run tests
cd /lib/tools/filesystem
npm test

# Manual test
npx tsx test.ts
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Oct 13, 2025 | Initial implementation with read operations |
| 2.0.0 | Oct 20, 2025 | Added write, move, copy, delete, archive operations |

---

**Last Updated:** October 22, 2025
**Maintained By:** FineTune Lab Development Team
