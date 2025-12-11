# Phase 1 Foundation - Verification Plan

**Date**: November 1, 2025  
**Phase**: 1 of 8 - Foundation & Data Layer  
**Risk Level**: ⭐ LOWEST (pure data layer, no UI impact)

---

## 📋 Pre-Implementation Verification

### ✅ File Locations Verified

1. **Types**: `lib/training/terminal-monitor.types.ts` (matches pattern: `lib/training/*.types.ts`)
2. **Hooks**: `hooks/useTerminalData.ts` (matches pattern: `hooks/use*.ts`)
3. **Utils**: `lib/utils/terminal-format.ts` (matches pattern: `lib/utils/*.ts`)

### ✅ Existing Code Patterns Identified

- **Types**: Export interfaces with JSDoc comments, console.log at bottom
- **Utils**: Export functions with detailed JSDoc, use strict type safety
- **Hooks**: React hooks with error handling, TypeScript strict mode

### ✅ Dependencies Available

- `TrainingJobStatus` type from `lib/services/training-providers/local.provider.ts`
- React hooks (`useState`, `useEffect`, `useCallback`)
- Standard TypeScript utilities

---

## 📝 File 1: terminal-monitor.types.ts

### Purpose

TypeScript type definitions for terminal monitor data structures

### Location

```
c:\Users\Juan\Desktop\Dev_Ops\web-ui\lib\training\terminal-monitor.types.ts
```

### Dependencies

```typescript
import { TrainingJobStatus } from '@/lib/services/training-providers/local.provider';
```

### Verification Steps

1. ✅ **Before Creating**:
   - Confirm file doesn't exist: `Test-Path` check
   - Verify parent directory exists: `lib/training/` ✓

2. ✅ **After Creating**:
   - File exists and is readable
   - TypeScript compiles without errors
   - No import errors in VS Code
   - Exports are accessible

3. ✅ **Validation Command**:

```powershell
# Check file exists
Test-Path 'c:\Users\Juan\Desktop\Dev_Ops\web-ui\lib\training\terminal-monitor.types.ts'

# Try to compile TypeScript (from web-ui directory)
npx tsc --noEmit lib/training/terminal-monitor.types.ts
```

### Expected Exports

- `TerminalMetrics` - Aggregated metrics for display
- `TerminalConfig` - Display settings
- `ChartDataPoint` - Sparkline data point
- `GPUStatus` - GPU metrics
- `LogEntry` - Log line entry
- `CheckpointInfo` - Checkpoint information
- `MetricTrend` - Trend direction enum

### Backward Compatibility

✅ NEW FILE - No breaking changes possible

---

## 📝 File 2: terminal-format.ts

### Purpose

Pure utility functions for formatting data for terminal display

### Location

```
c:\Users\Juan\Desktop\Dev_Ops\web-ui\lib\utils\terminal-format.ts
```

### Dependencies

```typescript
// No external dependencies - pure functions
```

### Verification Steps

1. ✅ **Before Creating**:
   - Confirm file doesn't exist
   - Verify parent directory exists: `lib/utils/` ✓

2. ✅ **After Creating**:
   - File exists and is readable
   - TypeScript compiles without errors
   - All functions are pure (no side effects)
   - Unit test coverage possible

3. ✅ **Validation Command**:

```powershell
# Check file exists
Test-Path 'c:\Users\Juan\Desktop\Dev_Ops\web-ui\lib\utils\terminal-format.ts'

# Compile check
npx tsc --noEmit lib/utils/terminal-format.ts
```

### Expected Exports

- `formatDuration(ms: number): string` - "8h 45m"
- `formatBytes(bytes: number, total?: number): string` - "2.05 / 8.00 GB"
- `formatPercentage(value: number): string` - "25.6%"
- `formatNumber(num: number, decimals?: number): string` - "1,234.56"
- `formatTrend(current: number, previous?: number): { arrow: string; delta: string }` - "▼ [-0.123]"
- `generateProgressBar(value: number, width: number, chars?: ProgressChars): string` - "[█████▒▒▒▒▒]"
- `truncateString(str: string, maxLength: number): string` - "Very long t..."

### Unit Test Cases

```typescript
// formatDuration
formatDuration(0) === "0s"
formatDuration(1000) === "1s"
formatDuration(60000) === "1m 0s"
formatDuration(3661000) === "1h 1m 1s"
formatDuration(31536000000) === "1y 0d 0h 0m"

// formatBytes
formatBytes(0) === "0 B"
formatBytes(1024) === "1.00 KB"
formatBytes(2050000000, 8000000000) === "2.05 / 8.00 GB"

// formatPercentage
formatPercentage(0) === "0.0%"
formatPercentage(0.256) === "25.6%"
formatPercentage(1) === "100.0%"

// generateProgressBar
generateProgressBar(0, 10) === "[          ]"
generateProgressBar(50, 10) === "[█████     ]"
generateProgressBar(100, 10) === "[██████████]"
```

### Backward Compatibility

✅ NEW FILE - No breaking changes possible

---

## 📝 File 3: useTerminalData.ts

### Purpose

React hook to aggregate training data from multiple API endpoints

### Location

```
c:\Users\Juan\Desktop\Dev_Ops\web-ui\hooks\useTerminalData.ts
```

### Dependencies

```typescript
import { useState, useEffect, useCallback } from 'react';
import { TerminalMetrics } from '@/lib/training/terminal-monitor.types';
import { TrainingJobStatus } from '@/lib/services/training-providers/local.provider';
```

### Verification Steps

1. ✅ **Before Creating**:
   - Confirm file doesn't exist
   - Verify parent directory exists: `hooks/` ✓
   - Check existing hooks for pattern consistency

2. ✅ **After Creating**:
   - File exists and is readable
   - TypeScript compiles without errors
   - No infinite loops (polling stops on terminal states)
   - Memory doesn't leak (cleanup on unmount)
   - React hooks rules followed

3. ✅ **Validation Command**:

```powershell
# Check file exists
Test-Path 'c:\Users\Juan\Desktop\Dev_Ops\web-ui\hooks\useTerminalData.ts'

# Compile check
npx tsc --noEmit hooks/useTerminalData.ts

# Start Next.js and check for errors
npm run dev
```

### Expected Behavior

```typescript
const { data, loading, error, refetch } = useTerminalData('job-id-123');

// data: TerminalMetrics | null
// loading: boolean
// error: string | null
// refetch: () => Promise<void>
```

### Hook Implementation Details

1. **Polling Logic**:
   - Polls every 2 seconds (configurable)
   - Stops polling when job status is 'completed', 'failed', or 'cancelled'
   - Cleans up interval on unmount

2. **Data Aggregation**:
   - Fetches job status from existing endpoint
   - Transforms to TerminalMetrics format
   - Handles errors gracefully

3. **State Management**:
   - `data`: Current metrics
   - `loading`: Initial load state
   - `error`: Error message if fetch fails

### Edge Cases to Handle

- Job ID doesn't exist (404)
- Network timeout
- Invalid response format
- Component unmounts during fetch
- Rapid job_id changes

### Backward Compatibility

✅ NEW FILE - No breaking changes possible
✅ Uses existing API endpoints (read-only)
✅ Doesn't modify global state

---

## 🧪 Integration Verification

### Step 1: TypeScript Compilation

```powershell
cd c:\Users\Juan\Desktop\Dev_Ops\web-ui
npx tsc --noEmit
```

**Expected**: No errors

### Step 2: ESLint Check

```powershell
npm run lint
```

**Expected**: No new errors

### Step 3: Import Test

Create temporary test file to verify imports:

```typescript
// test-imports.ts
import { TerminalMetrics } from '@/lib/training/terminal-monitor.types';
import { formatDuration } from '@/lib/utils/terminal-format';
import { useTerminalData } from '@/hooks/useTerminalData';

const test: TerminalMetrics = {} as any;
const duration = formatDuration(1000);
// const hook = useTerminalData('test'); // Can't call hooks outside component

console.log('Imports successful');
```

### Step 4: Next.js Build Check

```powershell
npm run build
```

**Expected**: Build succeeds, no errors

### Step 5: Runtime Verification

```typescript
// Create minimal test component
function TerminalDataTest() {
  const { data, loading, error } = useTerminalData('test-job-id');
  
  return (
    <div>
      <p>Loading: {loading ? 'Yes' : 'No'}</p>
      <p>Error: {error || 'None'}</p>
      <p>Data: {data ? 'Loaded' : 'Null'}</p>
    </div>
  );
}
```

---

## ✅ Success Criteria

### Phase 1 is COMPLETE when

- [  ] All 3 files created without errors
- [  ] TypeScript compiles (`npx tsc --noEmit`)
- [  ] ESLint passes
- [  ] Imports work in other files
- [  ] No runtime errors in browser console
- [  ] Hook doesn't cause infinite loops
- [  ] Hook cleans up properly on unmount
- [  ] Formatters produce expected output
- [  ] All unit tests pass (if written)
- [  ] Documentation complete

### Red Flags to Watch

- ❌ TypeScript errors appear
- ❌ Infinite re-renders
- ❌ Memory leaks
- ❌ Import path errors
- ❌ Polling doesn't stop
- ❌ Browser console errors
- ❌ Next.js build fails

---

## 🔄 Rollback Plan

If anything breaks:

### File 1 Issues

```powershell
Remove-Item 'c:\Users\Juan\Desktop\Dev_Ops\web-ui\lib\training\terminal-monitor.types.ts'
```

**Impact**: None (no consumers yet)

### File 2 Issues

```powershell
Remove-Item 'c:\Users\Juan\Desktop\Dev_Ops\web-ui\lib\utils\terminal-format.ts'
```

**Impact**: None (no consumers yet)

### File 3 Issues

```powershell
Remove-Item 'c:\Users\Juan\Desktop\Dev_Ops\web-ui\hooks\useTerminalData.ts'
```

**Impact**: None (no consumers yet)

### Complete Rollback

```powershell
# Delete all Phase 1 files
Remove-Item 'c:\Users\Juan\Desktop\Dev_Ops\web-ui\lib\training\terminal-monitor.types.ts' -ErrorAction SilentlyContinue
Remove-Item 'c:\Users\Juan\Desktop\Dev_Ops\web-ui\lib\utils\terminal-format.ts' -ErrorAction SilentlyContinue
Remove-Item 'c:\Users\Juan\Desktop\Dev_Ops\web-ui\hooks\useTerminalData.ts' -ErrorAction SilentlyContinue

# Verify TypeScript still compiles
npx tsc --noEmit
```

---

## 📊 Progress Tracking

### File 1: terminal-monitor.types.ts

- [  ] Pre-verification checks
- [  ] File created
- [  ] TypeScript compiles
- [  ] Exports accessible
- [  ] Post-verification complete

### File 2: terminal-format.ts

- [  ] Pre-verification checks
- [  ] File created
- [  ] TypeScript compiles
- [  ] Functions tested
- [  ] Post-verification complete

### File 3: useTerminalData.ts

- [  ] Pre-verification checks
- [  ] File created
- [  ] TypeScript compiles
- [  ] Hook tested in component
- [  ] No memory leaks
- [  ] Polling works correctly
- [  ] Post-verification complete

### Integration Testing

- [  ] All imports work
- [  ] No TypeScript errors project-wide
- [  ] ESLint passes
- [  ] Next.js builds successfully
- [  ] No runtime errors
- [  ] Documentation updated

---

## 🎯 Ready to Proceed?

**Verification Plan**: ✅ COMPLETE  
**File Locations**: ✅ CONFIRMED  
**Code Patterns**: ✅ UNDERSTOOD  
**Dependencies**: ✅ AVAILABLE  
**Rollback Plan**: ✅ DOCUMENTED  

**Decision**: Proceed with Phase 1 File 1 creation?

- **A**: Yes, create terminal-monitor.types.ts
- **B**: Review plan first
- **C**: Wait for approval

Awaiting orders, Chief! 🫡
