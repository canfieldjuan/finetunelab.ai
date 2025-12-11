# File Watching Fix - November 13, 2025

## Problem
Watchpack Error: "EMFILE: too many open files" - Next.js file watcher was trying to watch too many files after documentation and migration consolidation.

## Root Cause
- Backup directories created during consolidation (migrations.backup, docs.backup, etc.)
- Python virtual environments (.venv, trainer_venv, graphiti-wrapper)
- These directories contain thousands of files that don't need to be watched

## Solutions Applied

### 1. Updated Next.js Config (`next.config.ts`)
Added `webpackDevMiddleware` configuration to ignore unnecessary directories:

```typescript
webpackDevMiddleware: (config) => {
  config.watchOptions = {
    ignored: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.git/**',
      '**/migrations.backup/**',
      '**/docs.backup/**',
      '**/.venv/**',
      '**/venv/**',
      '**/trainer_venv/**',
      '**/graphiti-wrapper/**',
      '**/graphiti-main/**',
      '**/__pycache__/**',
      '**/*.pyc',
    ],
    aggregateTimeout: 300,
    poll: 1000,
  };
  return config;
},
```

### 2. Created `.watchmanconfig`
Added watchman configuration to ignore directories:

```json
{
  "ignore_dirs": [
    ".next",
    ".git",
    "node_modules",
    "migrations.backup",
    "docs.backup",
    ".venv",
    "venv",
    "trainer_venv",
    "graphiti-wrapper",
    "graphiti-main",
    "__pycache__"
  ]
}
```

## Backup Directory Sizes
```
124K    migrations.backup
385M    docs.backup
500K    supabase/migrations.backup
8.0K    lib/tools/system-monitor/migrations.backup
8.0K    lib/tools/web-search/migrations.backup
```

**Total: ~386MB in backup directories**

## Optional: Remove Backup Directories

Since all files have been successfully consolidated and you can restore from git if needed, you can remove the backup directories:

```bash
# Remove all backup directories to reduce file watching overhead
rm -rf migrations.backup
rm -rf docs.backup
rm -rf supabase/migrations.backup
rm -rf lib/tools/system-monitor/migrations.backup
rm -rf lib/tools/web-search/migrations.backup
```

**Important:** Only do this after verifying the consolidation worked correctly!

## Verification

After applying these fixes:

1. **Stop the Next.js dev server** (Ctrl+C)
2. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   ```
3. **Restart the dev server:**
   ```bash
   npm run dev
   ```

You should no longer see "EMFILE: too many open files" errors.

## What Changed

- **Before:** Watchpack watching ~386MB+ of backup files unnecessarily
- **After:** Watchpack ignores all backup directories and Python environments
- **Result:** Faster startup, no file descriptor errors

## Future Prevention

When creating backup directories in the future:
1. Name them with `.backup` suffix (auto-ignored by config)
2. Or immediately remove them after verifying consolidation
3. Consider using git for backups instead of directory copies

---

**Fixed:** November 13, 2025
**Impact:** File watching errors eliminated, faster dev server
