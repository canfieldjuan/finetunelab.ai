# Production Error Trace System

**Date:** 2025-12-12
**Status:** IMPLEMENTED
**Goal:** Build production-grade error tracing for training failures

---

## Investigation Findings

### 1. Log Format Analysis

**Actual log format from training server:**
```
[TIMESTAMP] [MODULE] [LEVEL] [PHASE] MESSAGE
```

**Examples:**
```
[2025-12-10 03:58:22] [__main__] [ERROR] [Main] Training failed with error: CUDA out of memory...
[2025-12-10 03:58:22] [__main__] [ERROR] Full traceback:
Traceback (most recent call last):
  File "/home/.../standalone_trainer.py", line 3401, in main
  File "/home/.../standalone_trainer.py", line 1287, in __init__
  ...
ERROR: Training failed: CUDA out of memory...
```

**Components:**
- Timestamp: `[2025-12-10 03:58:22]`
- Module: `[__main__]`
- Level: `[ERROR]`, `[INFO]`, `[WARNING]`, `[DEBUG]`
- Phase: `[Main]`, `[PreTokenize]`, `[SFT]`, `[Model]`, etc.
- Message: Free-form text

### 2. Error Message Field (Database)

**Location:** `training_jobs.error_message` column

**Content:** Simple descriptive string, NOT the full traceback
- "Training process terminated unexpectedly with exit code 1"
- "Training process exited with code 1"
- "Cancelled by user"
- "Training timed out - no progress updates for X minutes"

**Traceback Location:** In log file `logs/job_{job_id}.log`

### 3. Error Types (from error_analyzer.py)

| Type | Pattern | Phase |
|------|---------|-------|
| `oom_eval` | "CUDA out of memory" + "eval" | evaluation |
| `oom_training` | "CUDA out of memory" | training |
| `timeout` | "timeout", "no progress" | monitoring |
| `cuda_error` | "CUDA", "cuda" | various |
| `config_error` | template/tokenizer errors | initialization |
| `unknown` | fallback | unknown |

### 4. Current Implementation Weaknesses

1. **Assumes Python traceback format only** - Misses CUDA kernel errors
2. **Relies on in-memory logs** - Logs might be truncated or unavailable
3. **No structured parsing** - Just string matching
4. **No deduplication** - Same error shown 100x
5. **Fragile traceback detection** - `startsWith('  File "')` breaks easily
6. **Missing multiline handling** - Tracebacks might be single log entry

---

## Production Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ERROR TRACE DATA FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Training Process                                                   │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────────┐     ┌─────────────────┐                       │
│  │ Log File        │     │ Database        │                       │
│  │ job_{id}.log    │     │ error_message   │                       │
│  │ (full traceback)│     │ (summary only)  │                       │
│  └────────┬────────┘     └────────┬────────┘                       │
│           │                       │                                 │
│           └───────────┬───────────┘                                 │
│                       ▼                                             │
│           ┌───────────────────────┐                                │
│           │ NEW: /api/training/   │                                │
│           │ {jobId}/errors        │                                │
│           │ (structured errors)   │                                │
│           └───────────┬───────────┘                                │
│                       │                                             │
│                       ▼                                             │
│           ┌───────────────────────┐                                │
│           │ ErrorTracePanel       │                                │
│           │ (UI Component)        │                                │
│           └───────────────────────┘                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phased Implementation Plan

### Phase 1: Backend - Error Extraction API
**Priority:** HIGH | **Risk:** LOW

Create a dedicated API endpoint that extracts and structures error data from log files.

**New Endpoint:** `GET /api/training/{job_id}/errors`

**Response Schema:**
```typescript
interface ErrorResponse {
  job_id: string;
  status: 'failed' | 'cancelled' | 'completed' | 'running';
  error_summary: string;          // From database error_message
  errors: StructuredError[];      // Parsed from logs
  traceback: TracebackInfo | null;
  analysis: FailureAnalysis | null;
}

interface StructuredError {
  timestamp: string;
  level: 'error' | 'warning';
  phase: string;                  // Main, PreTokenize, SFT, etc.
  message: string;
  dedupe_key: string;             // For deduplication
  count: number;                  // How many times this error occurred
}

interface TracebackInfo {
  raw: string;                    // Full traceback text
  frames: TracebackFrame[];       // Parsed frames
  exception_type: string;         // RuntimeError, ValueError, etc.
  exception_message: string;
}

interface TracebackFrame {
  file: string;
  line: number;
  function: string;
  code: string | null;
}
```

**Files to Create:**
- `lib/training/error_extractor.py` - Python module for log parsing
- Update `lib/training/training_server.py` - Add endpoint

**Files to Modify:**
- `app/api/training/local/[jobId]/errors/route.ts` - Next.js API proxy

### Phase 2: Error Extractor Module
**Priority:** HIGH | **Risk:** LOW

Python module with robust parsing logic.

**Features:**
1. **Structured Log Parsing**
   - Regex: `\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(\w+)\] \[(\w+)\] \[(\w+)\] (.+)`
   - Handle malformed lines gracefully

2. **Traceback Extraction**
   - Detect: `Traceback (most recent call last):`
   - Parse frames: `File "...", line X, in function`
   - Handle multiline tracebacks
   - Support chained exceptions (`During handling of...`)

3. **Error Deduplication**
   - Hash: `phase + first_100_chars_of_message`
   - Count occurrences
   - Return unique errors with counts

4. **Error Classification**
   - OOM patterns
   - CUDA patterns
   - Config/tokenizer patterns
   - Timeout patterns

**File:** `lib/training/error_extractor.py`

### Phase 3: Frontend - Enhanced ErrorTracePanel
**Priority:** HIGH | **Risk:** MEDIUM

Replace current naive implementation with production version.

**Features:**
1. **Fetch from dedicated API** - `/api/training/{jobId}/errors`
2. **Structured display**
   - Error summary section
   - Deduplicated error list with counts
   - Collapsible traceback with syntax highlighting
   - Clickable file:line references
3. **Error timeline** - Show when errors occurred
4. **Copy functionality** - Full error report

**Files to Modify:**
- `components/terminal/ErrorTracePanel.tsx` - Complete rewrite

### Phase 4: Integration & Polish
**Priority:** MEDIUM | **Risk:** LOW

**Tasks:**
1. Add loading states and error handling
2. Add "Refresh Errors" button
3. Cache parsed errors to avoid re-parsing
4. Add error count badge to terminal header
5. Mobile-responsive layout

---

## File Impact Analysis

### Files to Create

| File | Purpose |
|------|---------|
| `lib/training/error_extractor.py` | Python error parsing module |
| `app/api/training/local/[jobId]/errors/route.ts` | Next.js API proxy |

### Files to Modify

| File | Changes | Risk |
|------|---------|------|
| `lib/training/training_server.py` | Add `/api/training/{job_id}/errors` endpoint | LOW - additive |
| `components/terminal/ErrorTracePanel.tsx` | Rewrite with structured data | MEDIUM - isolated |
| `components/terminal/TerminalMonitor.tsx` | Update props passed to ErrorTracePanel | LOW - props change |

### Files NOT Modified

| File | Reason |
|------|--------|
| `useTerminalData.ts` | Error data fetched separately |
| `TerminalMetrics` type | Keep backward compatible |
| `LogStream.tsx` | Separate concern |

---

## API Contract

### Request
```
GET /api/training/{job_id}/errors
Authorization: Bearer {token}
```

### Response (Success)
```json
{
  "job_id": "abc123",
  "status": "failed",
  "error_summary": "Training process exited with code 1",
  "errors": [
    {
      "timestamp": "2025-12-10T03:58:22Z",
      "level": "error",
      "phase": "Main",
      "message": "Training failed with error: CUDA out of memory...",
      "dedupe_key": "main_cuda_oom",
      "count": 1
    },
    {
      "timestamp": "2025-12-10T03:58:20Z",
      "level": "error",
      "phase": "PreTokenize",
      "message": "Cannot use chat template...",
      "dedupe_key": "pretok_template",
      "count": 47
    }
  ],
  "traceback": {
    "raw": "Traceback (most recent call last):\n  File...",
    "frames": [
      {
        "file": "/home/.../standalone_trainer.py",
        "line": 3401,
        "function": "main",
        "code": "trainer.train()"
      }
    ],
    "exception_type": "RuntimeError",
    "exception_message": "CUDA out of memory..."
  },
  "analysis": {
    "error_type": "oom_training",
    "error_phase": "training",
    "description": "GPU memory exhausted during forward pass",
    "confidence": "high",
    "suggestions": [...]
  }
}
```

---

## Verification Checklist

### Phase 1 Verification
- [ ] Endpoint returns 200 for failed jobs
- [ ] Endpoint returns 200 with empty errors for non-failed jobs
- [ ] Handles missing log files gracefully
- [ ] Auth token validated

### Phase 2 Verification
- [ ] Parses standard Python tracebacks
- [ ] Parses CUDA error messages
- [ ] Deduplicates repeated errors correctly
- [ ] Handles multiline log messages
- [ ] Handles malformed log lines

### Phase 3 Verification
- [ ] Fetches from new API endpoint
- [ ] Displays errors with counts
- [ ] Traceback expandable/collapsible
- [ ] Copy button works
- [ ] No breaking changes to TerminalMonitor

### Phase 4 Verification
- [ ] Loading states display correctly
- [ ] Error states handled gracefully
- [ ] Mobile layout works
- [ ] TypeScript compiles without errors

---

## Timeline Estimate

| Phase | Scope | Files |
|-------|-------|-------|
| Phase 1 | Backend endpoint | 2 files |
| Phase 2 | Error extractor | 1 file |
| Phase 3 | Frontend rewrite | 1 file |
| Phase 4 | Polish | Minor updates |

---

## Rollback Plan

If issues arise:
1. ErrorTracePanel checks API response, falls back to current behavior if 404
2. Old props still passed (backward compatible)
3. Feature flag via environment variable (optional)

---

## Implementation Summary

**Completed: 2025-12-12**

### Files Created
1. **`lib/training/error_extractor.py`** - Python module for robust log parsing
   - Structured log line parsing with regex
   - Traceback extraction with frame parsing
   - Error deduplication using hash-based keys
   - Error classification patterns (OOM, CUDA, config, etc.)

2. **`app/api/training/local/[jobId]/errors/route.ts`** - Next.js API proxy
   - Proxies requests to training server
   - Returns structured error data

### Files Modified
1. **`lib/training/training_server.py`**
   - Added import for error_extractor module
   - Added `GET /api/training/{job_id}/errors` endpoint
   - Fetches error_summary from database

2. **`components/terminal/ErrorTracePanel.tsx`** - Complete rewrite
   - Fetches from new `/errors` API endpoint
   - Displays deduplicated errors with counts
   - Collapsible traceback with parsed frames
   - Copy-to-clipboard functionality
   - Loading and error states

3. **`components/terminal/TerminalMonitor.tsx`**
   - Removed `logs` prop (no longer needed)

### Verification
- ESLint: No errors
- Python syntax: Valid
- No breaking changes to existing functionality
