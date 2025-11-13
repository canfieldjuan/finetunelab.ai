# vLLM Feature Detection - Implementation Progress

## Session Context

**Date**: 2025-10-28
**Feature**: Automatic vLLM availability detection for model deployment
**Goal**: Gracefully handle vLLM presence/absence, guide users to installation when needed

## Investigation Summary

### Existing Architecture Analysis

**Deployment Flow:**

```
DeployModelButton (UI)
  ↓
POST /api/training/deploy
  ↓
Query local_training_jobs table (get model path)
  ↓
inferenceServerManager.startVLLM()
  ↓
spawn python -m vllm... (CURRENT FAILURE POINT)
  ↓
Create local_inference_servers record
  ↓
Create llm_models record
```

**Key Files Analyzed:**

1. `components/training/DeployModelButton.tsx`
   - Renders when status='completed'
   - Triggers deployment via API
   - Currently has no availability check

2. `app/api/training/deploy/route.ts`
   - Queries local_training_jobs for model info
   - Calls inferenceServerManager.startVLLM()
   - No pre-flight vLLM check

3. `lib/services/inference-server-manager.ts`
   - Spawns vLLM process via child_process.spawn()
   - Uses VLLM_PYTHON_PATH env var (✅ added)
   - No availability validation before spawn

4. `app/training/monitor/page.tsx`
   - Shows DeployModelButton when training complete
   - Passes jobId, modelName, status props

**Database Tables:**

- `local_training_jobs` - Training job metadata (✅ exists)
- `local_inference_servers` - Spawned server tracking (✅ migration exists)
- `llm_models` - Model registry (⚠️ no migration found, assumed to exist)

### Risk Assessment

**Breaking Changes:** NONE

- All modifications are additive or backward compatible
- Defaults to existing behavior if env vars not set
- Fail-safe design (allow deployment with warning if check fails)

**Identified Risks & Mitigations:**

| Risk | Impact | Mitigation |
|------|--------|-----------|
| vLLM check blocks UI | High | Async with 5s timeout, loading state |
| False positives | Medium | Server-side validation + clear errors |
| Env vars not set | Low | Default to 'python', docs, error messages |
| User confusion | Medium | Clear messaging, installation links |
| Deployment breaking | Critical | Graceful degradation, feature flag ready |

## Implementation Plan

### ✅ PHASE 1: Backend Foundation (COMPLETED)

**Files Created:**

1. `lib/services/vllm-checker.ts` ✅
   - isVLLMAvailable(): Checks if vLLM importable
   - getVLLMVersion(): Returns version string
   - 60-second cache to reduce overhead
   - 5-second timeout per check

2. `app/api/training/vllm/check/route.ts` ✅
   - GET endpoint for frontend
   - Returns: { available, version, message }
   - Error handling with fallback

3. `.env.local` ✅
   - VLLM_PYTHON_PATH configuration
   - Example paths for user setup

**Files Modified:**

1. `lib/services/inference-server-manager.ts` ✅
   - Uses VLLM_PYTHON_PATH from env
   - Defaults to 'python' if not set
   - Backward compatible

### ⏳ PHASE 2: Backend Fixes (NEXT)

**Tasks:**

1. Add runtime export to vllm check API

   ```ts
   export const runtime = 'nodejs';
   ```

   - Required for child_process in Next.js
   - Consistent with other API routes

2. Fix TypeScript lint errors
   - Remove unused `stderr` variable in isVLLMAvailable
   - Remove unused `error` in getVLLMVersion

3. Test vllm-checker independently
   - With vLLM installed
   - Without vLLM
   - With timeout

### ⏳ PHASE 3: Frontend Integration

**Target File:** `components/training/DeployModelButton.tsx`

**Changes Required:**

1. Add vLLM availability state

   ```ts
   const [vllmStatus, setVllmStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
   const [vllmVersion, setVllmVersion] = useState<string | null>(null);
   ```

2. Check availability on mount

   ```ts
   useEffect(() => {
     checkVLLMAvailability();
   }, []);
   
   async function checkVLLMAvailability() {
     try {
       const response = await fetch('/api/training/vllm/check');
       const data = await response.json();
       setVllmStatus(data.available ? 'available' : 'unavailable');
       setVllmVersion(data.version);
     } catch (error) {
       console.error('vLLM check failed:', error);
       setVllmStatus('unavailable'); // Fail safe
     }
   }
   ```

3. Conditional button rendering

   ```tsx
   {vllmStatus === 'checking' && (
     <Button disabled>
       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
       Checking vLLM...
     </Button>
   )}
   
   {vllmStatus === 'unavailable' && (
     <Button disabled variant="outline">
       vLLM Not Available
     </Button>
   )}
   
   {vllmStatus === 'available' && (
     <Button onClick={...}>
       Deploy to vLLM {vllmVersion && `(v${vllmVersion})`}
     </Button>
   )}
   ```

4. Installation instructions dialog
   - Show when user clicks unavailable button
   - Link to vLLM installation docs
   - Show `pip install vllm` command

### ⏳ PHASE 4: Server-Side Validation

**Target File:** `app/api/training/deploy/route.ts`

**Changes Required:**

1. Add vLLM check before deployment

   ```ts
   // Before spawning server
   const vllmAvailable = await isVLLMAvailable();
   if (!vllmAvailable) {
     console.warn('[DeployAPI] vLLM not available, deployment may fail');
     // Optional: Return error or proceed with warning
   }
   ```

2. Improved error messaging

   ```ts
   if (serverError) {
     return NextResponse.json({
       error: 'Failed to start vLLM server',
       details: 'vLLM may not be installed. Run: pip install vllm',
       technicalDetails: serverError.message
     }, { status: 500 });
   }
   ```

### ⏳ PHASE 5: Documentation & Testing

**Documentation Tasks:**

1. Create `.env.local.example`

   ```env
   # vLLM Configuration (Optional)
   # Uncomment and set to your Python environment with vLLM installed
   # VLLM_PYTHON_PATH=python
   # VLLM_PYTHON_PATH=C:\path\to\vllm\venv\Scripts\python.exe
   ```

2. Update README.md
   - Add vLLM setup section
   - Link to installation docs
   - Troubleshooting guide

3. Create VLLM_SETUP.md
   - Installation instructions
   - Environment configuration
   - Common issues & fixes

**Testing Scenarios:**

| Scenario | Expected Behavior | Status |
|----------|------------------|--------|
| vLLM installed | Button enabled, deployment works | ⏳ |
| vLLM missing | Button disabled, clear message | ⏳ |
| Check timeout | Falls back to unavailable after 5s | ⏳ |
| Network error | Graceful degradation, warning shown | ⏳ |
| Custom Python path | Uses VLLM_PYTHON_PATH correctly | ⏳ |
| Deployment without check | Server-side validation catches issue | ⏳ |

## Acceptance Criteria

### Must Have

- ✅ vLLM check completes in <5 seconds
- ⏳ Button shows loading state during check
- ⏳ Clear message when vLLM unavailable
- ⏳ Deployment blocked if vLLM missing (or warned)
- ⏳ No breaking changes to existing functionality

### Should Have

- ⏳ vLLM version displayed when available
- ⏳ Installation instructions easily accessible
- ⏳ Caching to avoid repeated checks
- ⏳ Environment variable configuration documented

### Nice to Have

- Feature flag for vLLM requirement (strict/permissive)
- Support for alternative inference servers (Ollama)
- Health monitoring for running vLLM instances

## Current Status

**Completed:**

- Backend check logic (vllm-checker.ts)
- Check API endpoint (/api/training/vllm/check)
- Python path configuration (inference-server-manager.ts)
- Environment variable template (.env.local)

**Next Steps (Priority Order):**

1. Fix API route runtime export
2. Fix TypeScript lint errors
3. Implement frontend availability check in DeployModelButton
4. Add server-side validation in deploy API
5. Create documentation files
6. Test all scenarios

**Blockers:** None

**Dependencies:**

- Next.js 15.5.4 (App Router) ✅
- Node.js runtime for API routes ✅
- child_process module ✅
- Existing local_training_jobs table ✅
- Existing local_inference_servers table ✅

## Session Continuity Notes

**For Next Developer:**

This feature implements automatic detection of vLLM availability before allowing model deployment. The design is fail-safe and backward compatible.

**Key Design Decisions:**

1. **Fail-safe**: If check fails, default to unavailable (don't break existing flows)
2. **Async**: vLLM check doesn't block UI, shows loading state
3. **Cached**: 60-second cache to avoid repeated Python process spawns
4. **Configurable**: Users can point to custom Python via env var

**Code Locations:**

- Check logic: `lib/services/vllm-checker.ts`
- Check API: `app/api/training/vllm/check/route.ts`
- Deploy button: `components/training/DeployModelButton.tsx` (needs integration)
- Deploy API: `app/api/training/deploy/route.ts` (needs validation)
- Server manager: `lib/services/inference-server-manager.ts` (already updated)

**Environment Setup:**

```env
# Optional: Point to Python with vLLM installed
VLLM_PYTHON_PATH=python  # Default
# Or specific path:
# VLLM_PYTHON_PATH=/path/to/vllm-venv/bin/python
```

**Testing Commands:**

```bash
# Test check API
curl http://localhost:3000/api/training/vllm/check

# Test with vLLM installed
pip install vllm
# Restart Next.js server
npm run dev

# Test without vLLM
pip uninstall vllm
# Restart Next.js server
npm run dev
```

---

**Last Updated:** 2025-10-28
**Status:** Phase 1 Complete, Phase 2 Ready to Start
**Estimated Completion:** 2-3 hours for full implementation + testing
