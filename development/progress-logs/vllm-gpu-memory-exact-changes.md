# Exact Code Changes for GPU Memory Control

**File:** `components/training/DeployModelButton.tsx`
**Total Changes:** 4 locations
**Lines Modified:** 4 additions, 2 modifications

---

## Change 1: Add State Variable

**Location:** After line 75 (in state declarations section)

**BEFORE:**
```typescript
  // vLLM configuration
  const [maxModelLen, setMaxModelLen] = useState<number>(8192);

  // vLLM availability state
```

**AFTER:**
```typescript
  // vLLM configuration
  const [maxModelLen, setMaxModelLen] = useState<number>(8192);
  const [gpuMemoryUtil, setGpuMemoryUtil] = useState<number>(0.7); // Default 70% - safe for dev environments

  // vLLM availability state
```

**Verification:**
- Line 75 contains `const [maxModelLen, setMaxModelLen]`
- Insert new line after it
- Line 77 should start with `// vLLM availability state`

---

## Change 2: Update API Payload

**Location:** Line 147 (in handleDeploy function)

**BEFORE:**
```typescript
          config: {
            gpu_memory_utilization: 0.8,
            max_model_len: maxModelLen,
```

**AFTER:**
```typescript
          config: {
            gpu_memory_utilization: gpuMemoryUtil,
            max_model_len: maxModelLen,
```

**Verification:**
- Line 146-148 contains the config object
- Only change: `0.8` → `gpuMemoryUtil`
- Rest of config remains unchanged

---

## Change 3: Add GPU Memory Slider UI

**Location:** After line 482 (after Max Context Length slider, before Static configuration)

**Context Before:**
```typescript
                  <p className="text-xs text-muted-foreground">
                    Higher values require more GPU memory. 8k recommended for most models.
                  </p>
                </div>

                {/* Static configuration info */}
                <div className="pt-2 border-t">
```

**INSERT THIS BLOCK:**
```typescript
                  <p className="text-xs text-muted-foreground">
                    Higher values require more GPU memory. 8k recommended for most models.
                  </p>
                </div>

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
                      Lower if other processes use GPU memory. Recommended: 0.6-0.7 for development, 0.8-0.9 for production.
                    </p>
                  </div>
                )}

                {/* Static configuration info */}
                <div className="pt-2 border-t">
```

**Verification:**
- Insert between line 482 and 485
- Wrapped in `{serverType === STATUS.VLLM && (...)}` conditional
- Uses same UI pattern as Max Context Length slider above

---

## Change 4: Update Static Display

**Location:** Line 487 (in static configuration info)

**BEFORE:**
```typescript
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• GPU Memory: 80% utilization</li>
                    <li>• Port: Auto-allocated (8002-8020)</li>
```

**AFTER:**
```typescript
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• GPU Memory: {(gpuMemoryUtil * 100).toFixed(0)}% utilization</li>
                    <li>• Port: Auto-allocated (8002-8020)</li>
```

**Verification:**
- Line 487 contains `<li>• GPU Memory: 80% utilization</li>`
- Replace hardcoded "80" with dynamic calculation
- Format matches: rounds to integer percentage

---

## Visual Mockup of UI Changes

### Current UI (BEFORE)
```
┌─────────────────────────────────────┐
│ Configuration                        │
│                                      │
│ Max Context Length        8,192      │
│ ═════════════○════════                │
│ Higher values require more memory.   │
│                                      │
│ ────────────────────────────────────│
│ • GPU Memory: 80% utilization        │ ← HARDCODED
│ • Port: Auto-allocated (8002-8020)   │
│ • Security: Bound to localhost only  │
└─────────────────────────────────────┘
```

### New UI (AFTER)
```
┌─────────────────────────────────────┐
│ Configuration                        │
│                                      │
│ Max Context Length        8,192      │
│ ═════════════○════════                │
│ Higher values require more memory.   │
│                                      │
│ GPU Memory Utilization       70%     │ ← NEW SLIDER
│ ══════════○══════════════            │
│ Lower if other processes use GPU.    │
│ Recommended: 0.6-0.7 for dev         │
│                                      │
│ ────────────────────────────────────│
│ • GPU Memory: 70% utilization        │ ← DYNAMIC
│ • Port: Auto-allocated (8002-8020)   │
│ • Security: Bound to localhost only  │
└─────────────────────────────────────┘
```

---

## Type Safety Verification

### Existing Imports (No changes needed)
```typescript
import { Slider } from '@/components/ui/slider'; // Line 38 - Already imported ✅
import { Label } from '@/components/ui/label';   // Line 29 - Already imported ✅
```

### State Type
```typescript
const [gpuMemoryUtil, setGpuMemoryUtil] = useState<number>(0.7);
// Type: number ✅
// Range: 0.5 - 0.95 (enforced by slider min/max)
```

### API Payload Type
```typescript
config: {
  gpu_memory_utilization: gpuMemoryUtil, // Type: number ✅
  max_model_len: maxModelLen,            // Type: number ✅
}
// Backend expects: number (0.0 - 1.0) ✅
```

---

## Testing Scenarios

### Scenario 1: Default Deployment
1. Open Deploy dialog
2. Select vLLM
3. **Expected**: GPU Memory slider shows 70%
4. Click Deploy
5. **Expected**: vLLM starts with `--gpu-memory-utilization 0.7`

### Scenario 2: Adjust to Low Memory
1. Open Deploy dialog
2. Drag GPU Memory slider to 50%
3. **Expected**: Display shows "50%", static info updates
4. Deploy
5. **Expected**: Works even with other GPU processes

### Scenario 3: Adjust to High Memory
1. Open Deploy dialog
2. Drag GPU Memory slider to 90%
3. Deploy
4. **Expected**: Uses more GPU memory (if available)

### Scenario 4: Ollama Deployment
1. Click "Deploy to Ollama"
2. **Expected**: GPU Memory slider does NOT appear
3. Only Max Context slider visible

### Scenario 5: Switch Between Types
1. Open Deploy dialog (vLLM selected)
2. See GPU Memory slider
3. Change dropdown to Ollama
4. **Expected**: Slider disappears
5. Change back to vLLM
6. **Expected**: Slider reappears with preserved value

---

## Rollback Plan

If issues occur, revert these exact changes:

1. **Remove** state variable (line ~76)
2. **Restore** hardcoded `0.8` (line 147)
3. **Delete** GPU Memory slider block (lines ~483-507)
4. **Restore** hardcoded "80%" (line ~487)

**Verification after rollback:**
- `git diff` should show clean state
- UI renders as before
- Deployments use 0.8 again

---

## Dependencies

### Components Used
- `Slider` from `@/components/ui/slider` ✅ Already imported
- `Label` from `@/components/ui/label` ✅ Already imported
- `STATUS` from `@/lib/constants` ✅ Already imported

### No New Dependencies Required ✅

---

## Pre-Implementation Checklist

- [ ] Current file has no uncommitted changes
- [ ] Line numbers match current file state
- [ ] All imports are present
- [ ] TypeScript version compatible (should be)
- [ ] UI components (Slider, Label) are available

---

## Post-Implementation Verification

### Code Checks
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] No ESLint errors: `npm run lint`
- [ ] File saves without errors
- [ ] Dev server hot-reloads successfully

### UI Checks
- [ ] Slider appears for vLLM deployments
- [ ] Slider does NOT appear for Ollama
- [ ] Default value is 70%
- [ ] Slider range is 50% - 95%
- [ ] Value updates in real-time
- [ ] Static info shows dynamic percentage

### Functional Checks
- [ ] Deploy with 70% succeeds
- [ ] Deploy with 50% succeeds
- [ ] Deploy with 90% succeeds (if GPU memory available)
- [ ] Database stores correct value in `config_json`
- [ ] Server restart uses saved config

---

## Known Limitations

1. **No Real-time GPU Memory Check**: Slider doesn't query actual available memory
   - Future enhancement: Add nvidia-smi integration

2. **No Validation**: User can set 95% even if insufficient memory
   - vLLM will fail at startup with clear error message
   - User can retry with lower value

3. **Desktop Users**: May need trial-and-error to find optimal value
   - Could add "Auto-detect" button in future

---

## Success Metrics

- ✅ User can deploy without editing code
- ✅ Default value works for development environments
- ✅ Power users can maximize GPU usage in production
- ✅ No breaking changes to existing functionality
- ✅ Code change is minimal and isolated
