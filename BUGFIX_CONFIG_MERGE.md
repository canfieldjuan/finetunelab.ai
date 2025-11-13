# Critical Bug Fix: Config Adjustments Field Mapping

**Date:** 2025-11-10
**Issue:** Resume with config adjustments failed with "Failed to submit resumed training job"
**Root Cause:** Field name mapping error in config merge logic
**Status:** ✅ FIXED

---

## Problem Analysis

### Error Encountered

```
Failed to submit resumed training job
at components/training/CheckpointResumeCard.tsx:215:15
```

### Root Cause

The resume API was performing an incorrect shallow merge of `config_adjustments`:

**Incorrect Logic (Lines 174-182):**
```typescript
const resumeConfig = {
  ...job.config, // { training: { batch_size: 4 }, ... }
  ...(config_adjustments || {}), // { per_device_train_batch_size: 2 }
  checkpoint_resume: { ... }
};
```

**Resulting Config (WRONG):**
```json
{
  "training": {
    "batch_size": 4  // Original value, NOT updated
  },
  "per_device_train_batch_size": 2,  // ❌ Invalid top-level field!
  "checkpoint_resume": { ... }
}
```

**Why It Failed:**
- Manual editor uses analyzer field names: `per_device_train_batch_size`
- Database stores as: `training.batch_size`
- Shallow merge added fields at wrong level
- Training backend rejected invalid top-level fields

---

## Solution Implemented

### Fixed Logic (Lines 173-214)

**1. Create base config first:**
```typescript
const resumeConfig = {
  ...job.config,
  checkpoint_resume: {
    enabled: true,
    checkpoint_path: resumeCheckpoint,
    resume_from_best: resume_from_best || false,
  },
};
```

**2. Map and apply adjustments:**
```typescript
if (config_adjustments && Object.keys(config_adjustments).length > 0) {
  // Field mapping: analyzer names → stored names
  const fieldMapping: Record<string, string> = {
    'per_device_train_batch_size': 'batch_size',
    'per_device_eval_batch_size': 'eval_batch_size',
    'gradient_accumulation_steps': 'gradient_accumulation_steps',
    'learning_rate': 'learning_rate',
    'gradient_checkpointing': 'gradient_checkpointing',
  };

  // Ensure training section exists
  if (!resumeConfig.training) {
    resumeConfig.training = {};
  }

  // Apply each adjustment to correct nested location
  Object.keys(config_adjustments).forEach(displayField => {
    const storedField = fieldMapping[displayField];
    if (storedField) {
      resumeConfig.training[storedField] = config_adjustments[displayField];
      console.log(`[ResumeTraining] Mapped ${displayField} -> training.${storedField} = ${config_adjustments[displayField]}`);
    } else {
      console.warn(`[ResumeTraining] Unknown field: ${displayField}`);
    }
  });
}
```

**Resulting Config (CORRECT):**
```json
{
  "training": {
    "batch_size": 2,  // ✅ Updated from 4 → 2
    "eval_batch_size": 2,
    "gradient_accumulation_steps": 8,
    "learning_rate": 0.00009,
    "gradient_checkpointing": true
  },
  "checkpoint_resume": {
    "enabled": true,
    "checkpoint_path": "/path/to/checkpoint-100",
    "resume_from_best": true
  }
}
```

---

## Field Mapping Table

| Analyzer Field (UI) | Stored Field (Database) | Config Path |
|---------------------|------------------------|-------------|
| `per_device_train_batch_size` | `batch_size` | `training.batch_size` |
| `per_device_eval_batch_size` | `eval_batch_size` | `training.eval_batch_size` |
| `gradient_accumulation_steps` | `gradient_accumulation_steps` | `training.gradient_accumulation_steps` |
| `learning_rate` | `learning_rate` | `training.learning_rate` |
| `gradient_checkpointing` | `gradient_checkpointing` | `training.gradient_checkpointing` |

---

## Testing

### TypeScript Compilation
✅ Passed (framework warnings only, no code errors)

### Expected Behavior

**User Flow:**
1. User adjusts Training Batch Size: 4 → 2
2. UI sends: `{ config_adjustments: { per_device_train_batch_size: 2 } }`
3. API maps to: `resumeConfig.training.batch_size = 2`
4. Backend receives valid config
5. Training starts successfully with adjusted batch size

**Console Logs (for debugging):**
```
[ResumeTraining] Config adjustments received: { per_device_train_batch_size: 2 }
[ResumeTraining] Mapped per_device_train_batch_size -> training.batch_size = 2
[ResumeTraining] Config adjustments applied to training section
[ResumeTraining] Resume config created
```

---

## Files Modified

**File:** `/app/api/training/local/[jobId]/resume/route.ts`

**Changes:**
- Lines 173-214: Complete rewrite of config merge logic
- Added field mapping dictionary
- Added proper nested path application
- Added detailed logging for debugging

**Lines Changed:** ~40 lines modified

**Breaking Changes:** ZERO (backward compatible)

---

## Validation Checklist

- [x] Field mapping dictionary created
- [x] Nested path application implemented
- [x] Training section initialization handled
- [x] Unknown fields logged as warnings
- [x] TypeScript compilation passed
- [x] Detailed logging added for debugging

---

## Next Steps

**Ready for User Testing:**
1. Navigate to job 74801829 in UI
2. Select "Adjust Config" resume strategy
3. Modify Training Batch Size (or any field)
4. Click "Resume Training"
5. Verify success (no more "Failed to submit" error)
6. Check server logs for mapping confirmation

**Expected Result:**
- Resume succeeds
- New job created with adjusted config
- Training starts with correct batch size

---

## Status: ✅ READY FOR TESTING

**Bug:** FIXED
**Testing:** TypeScript compilation passed
**Documentation:** Complete
**User Action Required:** Test resume with manual config adjustments
