# vLLM GPU Memory Control Implementation Plan

**Date:** 2025-12-02
**Priority:** High
**Status:** Planning - Awaiting Approval
**Context:** User deployment to vLLM/Ollama failed due to hardcoded 80% GPU memory utilization causing OOM errors when other processes hold GPU memory.

---

## Problem Statement

### Current Issue
- vLLM deployment fails with error: `Free memory (17.88 GB) < desired (18.85 GB at 0.8 utilization)`
- GPU memory utilization is **hardcoded to 0.8 (80%)** in `DeployModelButton.tsx` line 147
- No UI controls to adjust this critical parameter
- Users cannot deploy when other processes use GPU memory (e.g., leftover Python sessions, desktop environment)

### Root Cause
1. **UI Component**: `DeployModelButton.tsx:147` - hardcoded `gpu_memory_utilization: 0.8`
2. **Backend Default**: `inference-server-manager.ts:202` - fallback `|| 0.9` if not provided
3. **No User Control**: Only "Max Context Length" slider exposed in UI (lines 460-482)

### Why This Matters
- **GPU Memory is Shared**: Desktop (Xorg, GNOME), code editors, lingering Python sessions all use VRAM
- **Different Use Cases**: Training (needs high %), inference during development (needs lower %)
- **Model Size Variance**: Small models can run at 0.5-0.6, large models need 0.85-0.9
- **User Cannot Self-Service**: Must edit code or kill processes manually

---

## Impact Analysis

### Files That Will Be Modified
1. ✅ **`components/training/DeployModelButton.tsx`** (PRIMARY)
   - Add state variable for GPU memory utilization
   - Add slider UI component
   - Update API request payload

2. ⚠️ **No Backend Changes Required** (config already flows through)
   - `app/api/training/deploy/route.ts:285` - already reads `config.gpu_memory_utilization`
   - `lib/services/inference-server-manager.ts:202` - already uses `config.gpuMemoryUtilization`
   - Database schema supports `config_json` storage

### Files That Will NOT Be Modified
- ❌ `app/api/servers/start/route.ts` - reads from saved config_json, works as-is
- ❌ `lib/services/inference-server-manager.ts` - interface already supports the parameter
- ❌ Database migrations - existing `config_json` column stores this

### Backward Compatibility
- ✅ **Existing Deployments**: Saved servers retain their `config_json.gpu_memory_utilization`
- ✅ **API Contract**: No breaking changes, config is optional with sensible defaults
- ✅ **Server Restart**: Uses saved config_json, not affected by UI changes

---

## Proposed Solution

### Phase 1: Add GPU Memory Slider to UI ⭐ RECOMMENDED

**File:** `components/training/DeployModelButton.tsx`

#### Changes Required:

**1. Add State Variable** (after line 75)
```typescript
// vLLM configuration
const [maxModelLen, setMaxModelLen] = useState<number>(8192);
const [gpuMemoryUtil, setGpuMemoryUtil] = useState<number>(0.7); // NEW - Default to 0.7 for safety
```

**2. Update API Payload** (line 146-148)
```typescript
config: {
  gpu_memory_utilization: gpuMemoryUtil, // CHANGED from hardcoded 0.8
  max_model_len: maxModelLen,
  // ...rest
}
```

**3. Add Slider UI** (insert after line 482, before "Static configuration info")
```typescript
{/* GPU Memory Utilization Slider - vLLM only */}
{serverType === STATUS.VLLM && (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Label htmlFor="gpu-memory" className="text-sm font-medium">
        GPU Memory Utilization
      </Label>
      <span className="text-sm text-muted-foreground">
        {(gpuMemoryUtil * 100).toFixed(0)}%
      </span>
    </div>
    <Slider
      id="gpu-memory"
      min={0.5}
      max={0.95}
      step={0.05}
      value={[gpuMemoryUtil]}
      onValueChange={(value) => setGpuMemoryUtil(value[0])}
      className="w-full"
    />
    <p className="text-xs text-muted-foreground">
      Lower if other processes are using GPU memory. Recommended: 0.6-0.7 for development, 0.8-0.9 for production.
    </p>
  </div>
)}
```

**4. Update Static Info Display** (line 487)
```typescript
<li>• GPU Memory: {(gpuMemoryUtil * 100).toFixed(0)}% utilization</li> {/* CHANGED from hardcoded "80%" */}
```

#### Exact Line Numbers for Changes:
- **Line 75-76**: Add state variable
- **Line 147**: Change hardcoded 0.8 to `gpuMemoryUtil`
- **After Line 482**: Insert GPU memory slider
- **Line 487**: Update static display from "80%" to dynamic value

---

## Testing Plan

### Pre-Implementation Verification
1. ✅ Verify current code structure (lines 70-160, 455-495)
2. ✅ Verify API contract supports `gpu_memory_utilization` parameter
3. ✅ Verify inference-server-manager uses the config value
4. ✅ Check for TypeScript interface requirements

### Post-Implementation Testing
1. **UI Rendering**
   - Slider appears only for vLLM deployments
   - Slider does NOT appear for Ollama/RunPod
   - Default value shows as 70%
   - Value updates in real-time as slider moves

2. **Functional Testing**
   - Deploy with 0.5 (50%) → vLLM starts successfully
   - Deploy with 0.7 (70%) → vLLM starts successfully (default)
   - Deploy with 0.9 (90%) → vLLM starts successfully (if memory available)
   - Verify server record in database contains correct `config_json.gpu_memory_utilization`

3. **Edge Cases**
   - With leftover GPU processes: Can deploy at 0.6 when 0.8 would fail
   - Server restart: Uses saved config value from database
   - Switch between vLLM/Ollama: Slider appears/disappears correctly

4. **Backward Compatibility**
   - Existing servers restart with their saved config
   - API accepts both old deploys (missing param) and new (with param)

---

## Risk Assessment

### Low Risk ✅
- **Non-Breaking Change**: Adding optional parameter with sensible default
- **Isolated Scope**: Only affects DeployModelButton.tsx
- **Type Safe**: TypeScript will catch interface mismatches
- **Tested Pattern**: Slider UI already exists for maxModelLen

### Potential Issues
1. **Default Too Low?**
   - Mitigation: 0.7 is safe default, user can increase

2. **Slider Range Too Restrictive?**
   - Current: 0.5 - 0.95
   - Can extend if needed, but covers 99% of use cases

3. **Confusion with "Max Context Length"?**
   - Mitigation: Clear help text explaining each parameter

---

## Alternative Approaches Considered

### ❌ Option A: Environment Variable
**Rejected** - Requires server restart, not user-friendly

### ❌ Option B: Lower Default to 0.7 Globally
**Rejected** - Suboptimal for production, wastes GPU capacity

### ✅ Option C: User-Configurable Slider (SELECTED)
**Benefits:**
- Self-service adjustment
- Optimal for each scenario
- Educational (shows impact of memory settings)
- No backend changes needed

---

## Implementation Checklist

### Before Starting
- [ ] User approves implementation plan
- [ ] Verify no conflicting changes in DeployModelButton.tsx
- [ ] Backup current file state
- [ ] Create git branch for changes

### Implementation Steps
1. [ ] Add `gpuMemoryUtil` state variable (line ~76)
2. [ ] Update `config` object in API call (line 147)
3. [ ] Add GPU Memory slider UI (after line 482)
4. [ ] Update static display to show dynamic value (line 487)
5. [ ] Verify TypeScript compiles with no errors
6. [ ] Test UI renders correctly (both vLLM and Ollama modes)
7. [ ] Test deployment with various GPU memory values
8. [ ] Verify database stores config correctly
9. [ ] Test server restart uses saved config

### Post-Implementation
- [ ] Update this log with results
- [ ] Document recommended GPU memory values for different scenarios
- [ ] Consider adding GPU memory estimation helper (future enhancement)

---

## Recommended Default Values

### Development Environment
- **0.5-0.6** (50-60%): Multiple processes, code editors, desktop
- **0.7** (70%): Default, safe for most scenarios ⭐ RECOMMENDED DEFAULT

### Production Environment
- **0.8-0.85** (80-85%): Dedicated inference, minimal other processes
- **0.9-0.95** (90-95%): Maximum performance, server-only environment

### Model Size Guidance
- **Small models (<3B)**: 0.5-0.6 is sufficient
- **Medium models (3B-7B)**: 0.6-0.7 recommended
- **Large models (7B-13B)**: 0.7-0.8 needed
- **Very large (>13B)**: 0.8-0.9 required

---

## Future Enhancements (Out of Scope)

### Phase 2 Considerations
1. **Memory Estimator**: Calculate recommended % based on model size and available GPU memory
2. **Real-time GPU Check**: Query `nvidia-smi` and suggest safe value
3. **Preset Buttons**: "Conservative (60%)", "Balanced (70%)", "Aggressive (85%)"
4. **Advanced Options Accordion**: dtype, tensor_parallel_size, quantization
5. **Memory Warning**: Show alert if selected % exceeds available memory

---

## Success Criteria

### Must Have
- ✅ User can adjust GPU memory utilization via slider
- ✅ Default value (0.7) allows deployment with typical GPU memory usage
- ✅ No breaking changes to existing deployments
- ✅ TypeScript compiles without errors

### Nice to Have
- ✅ Clear help text explaining when to adjust
- ✅ Visual feedback of selected percentage
- ✅ Slider only shows for vLLM (not Ollama/RunPod)

---

## Related Issues

- **Original Error**: `ValueError: Free memory (17.88 GB) < desired (18.85 GB)`
- **Zombie Process**: PID 353996 using 4.7 GB (resolved by killing process)
- **Documentation**: See `docs/VLLM_14B_OOM_FIX.md` for memory sizing guidance

---

## Notes

- This is a **permanent fix**, not a workaround
- Changes are **minimal and isolated** to one UI component
- Backend **already supports** this parameter end-to-end
- Solution is **user-friendly** and educational
