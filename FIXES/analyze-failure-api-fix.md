# Fix: Analyze Failure API Internal Server Error

**Date:** 2025-11-16
**Error:** `Failed to fetch analysis: Internal Server Error`
**Component:** `components/training/CheckpointResumeCard.tsx:153`
**API Endpoint:** `/api/training/local/[jobId]/analyze-failure`

## Root Causes Identified

### 1. Python Import Path Issue
**Problem:** The Python CLI script used a relative import that failed when executed from Node.js:
```python
from error_analyzer import analyze_training_failure
```

**Fix:** Added script directory to Python's `sys.path`:
```python
import os
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)
```

**File:** `lib/training/analyze_error_cli.py`

### 2. Shell Escaping Issue
**Problem:** Using `exec()` with string command construction caused issues with special characters in error messages and JSON configs:
```typescript
// Old problematic code
const errorEscaped = job.error_message.replace(/"/g, '\\"');
const configEscaped = configJson.replace(/"/g, '\\"');
const cmd = `python "${script}" --error "${errorEscaped}" --config "${configEscaped}"`;
await execAsync(cmd);
```

**Fix:** Changed to `execFile()` which passes arguments directly without shell interpretation:
```typescript
// New safe code
import { execFile } from 'child_process';
const execFileAsync = promisify(execFile);

const args = [
  scriptPath,
  '--job-id', jobId,
  '--error', job.error_message,  // No escaping needed!
  '--config', configJson
];

await execFileAsync(pythonPath, args, options);
```

**File:** `app/api/training/local/[jobId]/analyze-failure/route.ts`

### 3. Poor Error Visibility
**Problem:** Generic error messages made debugging difficult.

**Fix:** Added comprehensive error logging and detailed error responses:

**Backend:**
```typescript
catch (execError: any) {
  console.error('[AnalyzeFailure] CLI execution error:', execError);
  console.error('[AnalyzeFailure] Error details:', {
    message: execError?.message,
    code: execError?.code,
    stdout: execError?.stdout,
    stderr: execError?.stderr,
  });

  // Include stderr in API response
  if (execError?.stderr) {
    return NextResponse.json({
      error: 'Python analysis script failed',
      details: execError.message,
      stderr: execError.stderr,
      stdout: execError.stdout || ''
    }, { status: 500 });
  }
}
```

**Frontend:**
```typescript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  const errorMessage = errorData.error || response.statusText;
  const errorDetails = errorData.details || '';
  const stderr = errorData.stderr || '';

  throw new Error(
    `Failed to fetch analysis: ${errorMessage}` +
    `${errorDetails ? ` - ${errorDetails}` : ''}` +
    `${stderr ? `\n\nPython error:\n${stderr}` : ''}`
  );
}
```

**File:** `components/training/CheckpointResumeCard.tsx`

## Testing

### Manual Test (Python CLI):
```bash
cd /home/juan-canfield/Desktop/web-ui
python3 lib/training/analyze_error_cli.py \
  --job-id test \
  --error "CUDA out of memory" \
  --config '{"per_device_train_batch_size": 8}'
```

Expected output:
```json
{
  "job_id": "test",
  "error_type": "oom_training",
  "error_phase": "training",
  "description": "CUDA Out of Memory during training...",
  "confidence": "high",
  "suggestions": [...]
}
```

### Test from Different Directory:
```bash
cd /tmp
python3 /home/juan-canfield/Desktop/web-ui/lib/training/analyze_error_cli.py \
  --job-id test \
  --error "test" \
  --config '{}'
```
Should work regardless of current directory.

## Benefits

1. **Robust Argument Passing:** No more shell escaping vulnerabilities
2. **Better Error Messages:** Developers see actual Python errors in console
3. **Portable Imports:** Python script works from any directory
4. **Debugging Support:** Comprehensive logging at every level

## Files Changed

1. `lib/training/analyze_error_cli.py` - Fixed import path
2. `app/api/training/local/[jobId]/analyze-failure/route.ts` - Changed exec to execFile, enhanced error handling
3. `components/training/CheckpointResumeCard.tsx` - Enhanced error display

## Next Steps

If the error persists after these fixes:

1. Check server console for `[AnalyzeFailure]` logs
2. Check browser console for detailed error including stderr
3. Verify Python path: `which python3`
4. Test CLI manually with actual job data
5. Check file permissions on `lib/training/*.py`

## Prevention

- Always use `execFile` instead of `exec` when calling external programs
- Never construct shell commands with user input via string concatenation
- Add script directory to `sys.path` for relative imports
- Include detailed error context in API responses
