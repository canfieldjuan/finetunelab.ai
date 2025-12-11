# Local Training → Cloud Training Migration Plan

**Date**: November 29, 2025  
**Objective**: Remove all mentions of "local training" and emphasize cloud-deployed training only

---

## Executive Summary

The codebase currently uses "local" terminology extensively for training jobs. This needs to be updated to reflect **cloud-only training** to avoid confusion and align with the product direction.

---

## Impact Analysis

### 🔴 HIGH PRIORITY - User-Facing Content

#### Documentation Pages (`app/docs/`)

**File: `app/docs/features/page.tsx`**
- Line 87: "Deploy trained models to production with one click. Local servers (vLLM, Ollama)..."
- Line 90: "'Local deployment (vLLM, Ollama, FastAPI)'"
- Line 316: "Choose local deployment (vLLM, Ollama) or cloud..."

**File: `app/docs/guides/page.tsx`**
- Line 445: "Deploy your trained model to RunPod Serverless or local inference servers"
- Line 453: "• **Local vLLM** - Fast local inference with GPU acceleration"
- Line 454: "• **Local Ollama** - Lightweight local inference"

**File: `app/docs/troubleshooting/page.tsx`**
- Line 307: "RunPod Serverless and local deployment troubleshooting"
- Line 472-477: Section titled "Local vLLM: Port already in use"

**Action**: Update all documentation to emphasize:
- "Cloud Training" instead of "Local Training"
- "RunPod Cloud Training" as the primary method
- Remove references to local servers except for deployment options

---

### 🟡 MEDIUM PRIORITY - API Routes & Code

#### API Route Comments

**File: `app/api/training/execute/route.ts`**
- Line 7: "Updated: 2025-01-07 - Integrated with local training server at port 8000"
- Line 655: "'Starting local training via training server...'"
- Line 884: "'Training job submitted successfully to local training server'"
- Line 906: "error: 'Failed to start local training'"

**File: `app/api/training/local/route.ts`** (Entire file)
- This entire route is named "local" and handles local training connections
- Consider renaming to `/api/training/cloud/` or `/api/training/runpod/`

**Action**: Update messaging in:
1. Console logs to say "cloud training" instead of "local training"
2. Error messages to reference cloud infrastructure
3. Success messages to emphasize cloud deployment

---

### 🟢 LOW PRIORITY - Database Schema (DO NOT CHANGE)

#### Database Tables

**Tables**: `local_training_jobs`, `local_training_metrics`, `local_inference_servers`

**⚠️ WARNING**: These are **database table names** and should NOT be renamed to avoid:
- Breaking existing data
- Migration complexity
- Downtime during schema changes

**Action**: Keep database table names as-is, but update:
- Comments/documentation about these tables
- Code comments that reference them
- User-facing labels that display this data

---

### 📊 Marketing Copy Changes Needed

#### Current Terminology → New Terminology

| **Current** | **Replace With** |
|------------|------------------|
| "Local training" | "Cloud training" or "RunPod training" |
| "Train locally" | "Train on cloud GPUs" |
| "Local training server" | "Cloud training infrastructure" |
| "Start local training" | "Start cloud training" |
| "Local inference" | Keep as-is (deployment option) |

---

## Implementation Plan

### Phase 1: Documentation (HIGH PRIORITY)
**Timeline**: 1-2 hours

1. Update `app/docs/features/page.tsx`
   - Change "local deployment" mentions to emphasize cloud-first
   - Keep local deployment as an option for inference only

2. Update `app/docs/guides/page.tsx`
   - Update deployment section to say "Cloud or Local Deployment"
   - Emphasize RunPod Serverless as primary method

3. Update `app/docs/troubleshooting/page.tsx`
   - Keep local troubleshooting but frame as deployment options
   - Add cloud training troubleshooting section

### Phase 2: API Messaging (MEDIUM PRIORITY)
**Timeline**: 2-3 hours

1. Update console.log messages in:
   - `app/api/training/execute/route.ts`
   - `app/api/training/local/route.ts`
   - All API routes under `/api/training/`

2. Update error messages to remove "local training" language

3. Update success messages to say "cloud training"

### Phase 3: Code Comments (LOW PRIORITY)
**Timeline**: 1 hour

1. Search all files for comments containing "local training"
2. Update to say "cloud training" or "RunPod training"
3. Add clarifying comments about database table naming

---

## Files Requiring Attention

### Documentation
- `app/docs/features/page.tsx` (3 locations)
- `app/docs/guides/page.tsx` (3 locations)  
- `app/docs/troubleshooting/page.tsx` (2 sections)

### API Routes
- `app/api/training/execute/route.ts` (4 console logs)
- `app/api/training/local/route.ts` (entire file messaging)
- `app/api/training/deploy/route.ts` (comments)
- `app/api/training/jobs/[jobId]/metrics/route.ts` (comments)

### Training Datasets (EVALUATION DATA)
- `output/evaluation/*.jsonl` files contain "local" API endpoints
- **Action**: Update these to reflect cloud training terminology

---

## What NOT to Change

❌ **Database table names**: `local_training_jobs`, `local_training_metrics`  
❌ **API route paths**: Keep `/api/training/local/` for backward compatibility  
❌ **Config keys**: `training_provider_local` (internal identifier)  
❌ **File paths**: Database migration files referencing tables

---

## Success Criteria

✅ All user-facing documentation emphasizes cloud training  
✅ Console logs and error messages say "cloud training"  
✅ Marketing copy reflects cloud-first approach  
✅ Database functionality unchanged (no breaking changes)  
✅ API backward compatibility maintained

---

## Estimated Effort

- **Phase 1 (Docs)**: 1-2 hours
- **Phase 2 (API Messaging)**: 2-3 hours  
- **Phase 3 (Comments)**: 1 hour
- **Total**: ~5 hours

---

## Next Steps

1. **Review this plan** - Confirm the approach
2. **Prioritize phases** - Which phase should we start with?
3. **Create backup** - Before making changes
4. **Execute Phase 1** - Start with high-impact documentation
5. **Test thoroughly** - Ensure no functionality breaks

---

## Questions for Consideration

1. Should we keep `/api/training/local/` route name for backward compatibility?
2. Do we want to add deprecation warnings for "local training" features?
3. Should we update the training provider naming in the database?
4. Do we need a migration guide for users currently using "local training"?

