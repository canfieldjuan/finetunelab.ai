# Production Inference Deployment - Phased Implementation Plan
**Date:** 2025-11-12
**Approach:** MVP - LoRA Adapters + RunPod Serverless + Manual Deployment
**Strategy:** Never Assume, Always Verify
**Priority:** NO BREAKING CHANGES

---

## 🎯 IMPLEMENTATION OVERVIEW

**Goal:** Close training-to-production loop by enabling deployment of fine-tuned models to RunPod Serverless inference endpoints

**Phases:** 6 phases, each with explicit verification
**Estimated Time:** 10-12 days
**Testing Budget:** $2-5 of $50 RunPod credits

---

## ⚠️ CRITICAL RULES

1. **NEVER ASSUME, ALWAYS VERIFY** - Every file read before modification
2. **NO BREAKING CHANGES** - Verify all dependent files before each change
3. **VALIDATE BEFORE IMPLEMENT** - Test changes work as intended
4. **INCREMENTAL PROGRESS** - Small changes, verify, commit, repeat
5. **ROLLBACK READY** - Every phase has rollback plan
6. **TYPESCRIPT COMPILATION** - Must pass after every phase

---

## 📊 PHASE BREAKDOWN

### PHASE 0: VERIFICATION & SETUP (Day 1) - CURRENT PHASE
**Status:** ✅ INVESTIGATION COMPLETE
**Goal:** Verify all dependencies, no code changes

**Tasks:**
1. ✅ Investigate existing checkpoint storage
2. ✅ Verify RunPod API key in vault
3. ✅ Research RunPod Serverless API
4. ✅ Create investigation report
5. ⏳ Create phased implementation plan (IN PROGRESS)
6. ⏳ Update progress logs
7. ⏳ Create validation checklist
8. ⏳ Test RunPod API (read-only)

**Deliverables:**
- ✅ Investigation report
- ⏳ Phased implementation plan
- ⏳ Progress logs updated
- ⏳ Pre-implementation verification report

**Verification Criteria:**
- All existing code understood
- No unknowns remaining
- User approves approach

---

### PHASE 1: DATABASE FOUNDATION (Days 2-3)
**Status:** ⏳ PENDING APPROVAL
**Goal:** Create database schema for inference deployments

#### Tasks:

**1.1 Create Migration File**
- **File:** `/supabase/migrations/20251112000003_create_inference_deployments.sql`
- **Action:** CREATE NEW FILE
- **Lines:** ~200 lines
- **Dependencies:** None (new table)
- **Breaking Changes:** NONE (new table, doesn't affect existing)

**1.2 Verify Migration Syntax**
- **Action:** Read migration file, check SQL syntax
- **Tool:** `psql --dry-run` or manual SQL validation
- **Verification:** No syntax errors

**1.3 Apply Migration**
- **Command:** `npx supabase db push`
- **Verification:** Table `inference_deployments` created
- **Rollback:** SQL script to DROP table included in migration

**1.4 Verify Schema**
- **Query:** `\d inference_deployments` (describe table)
- **Verification:** All columns present, indexes created, RLS enabled
- **Check:** Policies created (4 policies expected)

#### Verification Steps:
```bash
# 1. Check TypeScript compilation (should still pass)
npx tsc --noEmit

# 2. Check migration files list
ls -la supabase/migrations/ | grep inference

# 3. Verify migration applied
npx supabase db psql -c "\d inference_deployments"

# 4. Verify RLS enabled
npx supabase db psql -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'inference_deployments';"

# 5. Count policies
npx supabase db psql -c "SELECT COUNT(*) FROM pg_policies WHERE tablename = 'inference_deployments';"
```

#### Success Criteria:
- [x] Migration file created
- [x] Migration applies without errors
- [x] Table has 20+ columns
- [x] 5 indexes created
- [x] RLS enabled
- [x] 4 policies created
- [x] TypeScript compilation still passes
- [x] No errors in logs

#### Rollback Plan:
```sql
DROP TABLE IF EXISTS inference_deployments CASCADE;
```

#### Files to Verify Won't Break:
- ✅ None (new table, no dependencies)

---

### PHASE 2: TYPE DEFINITIONS (Day 3)
**Status:** ⏳ PENDING PHASE 1 COMPLETION
**Goal:** Create TypeScript types for inference deployments

#### Tasks:

**2.1 Create Types File**
- **File:** `/lib/inference/deployment.types.ts`
- **Action:** CREATE NEW FILE
- **Lines:** ~250 lines
- **Dependencies:** None (new file)
- **Breaking Changes:** NONE (new exports, nothing imported by existing code)

**2.2 Verify Types Structure**
- **Action:** Read file, verify exports
- **Check:** All interfaces defined
- **Check:** Union types complete

**2.3 Test Type Imports**
- **Create Test File:** `/lib/inference/__test_types.ts` (temporary)
- **Content:**
```typescript
import type {
  InferenceProvider,
  ModelType,
  InferenceStatus,
  InferenceDeploymentRequest,
  InferenceDeploymentResponse,
  InferenceDeploymentStatus,
} from './deployment.types';

// Type check only - no runtime code
const testProvider: InferenceProvider = 'runpod-serverless';
const testModelType: ModelType = 'lora-adapter';
const testStatus: InferenceStatus = 'deploying';

console.log('Types imported successfully');
```

**2.4 Compile Test**
- **Command:** `npx tsc --noEmit lib/inference/__test_types.ts`
- **Verification:** No TypeScript errors

**2.5 Cleanup Test File**
- **Action:** Delete `/lib/inference/__test_types.ts`

#### Verification Steps:
```bash
# 1. Create directory
mkdir -p lib/inference

# 2. Check file created
ls -la lib/inference/deployment.types.ts

# 3. Count exports
grep "export" lib/inference/deployment.types.ts | wc -l
# Expected: 10+ exports

# 4. TypeScript compilation
npx tsc --noEmit

# 5. Check no imports of this file exist yet (should be empty)
grep -r "from '@/lib/inference/deployment.types'" . --include="*.ts" --include="*.tsx" | grep -v "deployment.types.ts"
# Expected: No results (no one imports it yet)
```

#### Success Criteria:
- [x] File created in `/lib/inference/`
- [x] All types exported
- [x] TypeScript compilation passes
- [x] No circular dependencies
- [x] No breaking changes to existing code

#### Rollback Plan:
```bash
rm -f lib/inference/deployment.types.ts
rmdir lib/inference  # Only if empty
```

#### Files to Verify Won't Break:
- ✅ None (new file, not imported anywhere yet)

---

### PHASE 3: RUNPOD SERVERLESS SERVICE (Days 4-5)
**Status:** ⏳ PENDING PHASE 2 COMPLETION
**Goal:** Create RunPod Serverless API client

#### Pre-Phase Verification:
**CRITICAL:** Verify existing RunPod service before creating new one

**3.0.1 Read Existing RunPod Service**
- **File:** `/lib/training/runpod-service.ts`
- **Action:** READ ENTIRE FILE
- **Purpose:** Understand existing patterns, avoid conflicts
- **Check:** GraphQL endpoint URL (line 48)
- **Check:** Authentication method (Bearer token)
- **Check:** Error handling patterns

**3.0.2 Verify No Name Conflicts**
- **Search:** `grep -r "runpod-serverless" . --include="*.ts"`
- **Expected:** No results
- **Purpose:** Ensure name doesn't conflict

#### Tasks:

**3.1 Create Service File**
- **File:** `/lib/inference/runpod-serverless-service.ts`
- **Action:** CREATE NEW FILE
- **Lines:** ~400 lines
- **Pattern:** Based on `/lib/training/runpod-service.ts` but REST API
- **Dependencies:**
  - `/lib/inference/deployment.types.ts` (Phase 2)
  - `fetch` (built-in)

**3.2 Implement Core Methods**
- `createEndpoint()` - Create serverless endpoint
- `getEndpointStatus()` - Get endpoint status
- `stopEndpoint()` - Stop endpoint
- `estimateCost()` - Cost calculation

**3.3 Test Service in Isolation**
- **Create Test File:** `/lib/inference/__test_service.ts`
- **Test:** Import service, check methods exist
- **NO API CALLS YET** - Just type checking

**3.4 Verify Export**
- **Check:** Singleton pattern like other services
- **Export:** `export const runpodServerlessService = new RunPodServerlessService();`

#### Verification Steps:
```bash
# 1. Check file created
ls -la lib/inference/runpod-serverless-service.ts

# 2. Verify imports don't conflict
grep "import.*runpod" lib/inference/runpod-serverless-service.ts

# 3. Count methods
grep "async.*(" lib/inference/runpod-serverless-service.ts | wc -l
# Expected: 4+ methods

# 4. TypeScript compilation
npx tsc --noEmit

# 5. Verify no breaking changes to existing runpod-service
npx tsc --noEmit lib/training/runpod-service.ts
```

#### Success Criteria:
- [x] File created
- [x] All methods implemented
- [x] Types imported correctly
- [x] Singleton exported
- [x] TypeScript compilation passes
- [x] No conflicts with existing runpod-service.ts
- [x] No breaking changes

#### Rollback Plan:
```bash
rm -f lib/inference/runpod-serverless-service.ts
```

#### Files to Verify Won't Break:
- `/lib/training/runpod-service.ts` - Must still compile and work
- `/lib/training/deployment.types.ts` - Must not be affected

**Verification Commands:**
```bash
# Verify existing RunPod service still works
npx tsc --noEmit lib/training/runpod-service.ts

# Verify no imports of new service exist yet
grep -r "runpod-serverless-service" app/ --include="*.ts" --include="*.tsx"
# Expected: No results
```

---

### PHASE 4: API ROUTES (Days 6-7)
**Status:** ⏳ PENDING PHASE 3 COMPLETION
**Goal:** Create API endpoints for deployment management

#### Pre-Phase Verification:

**4.0.1 Verify API Directory Structure**
```bash
# Check existing deploy routes
ls -la app/api/training/deploy/
# Expected: google-colab/, hf-spaces/, kaggle/, runpod/, route.ts

# Verify naming convention
ls -la app/api/training/deploy/*/route.ts
# Pattern: Each provider has own directory with route.ts
```

**4.0.2 Read Existing API Route Pattern**
- **File:** `/app/api/training/deploy/google-colab/route.ts`
- **Action:** READ ENTIRE FILE
- **Purpose:** Match authentication pattern, error handling
- **Check:** Supabase auth pattern (lines 24-52)
- **Check:** Secrets vault integration (lines 90-104)
- **Check:** Response format

#### Tasks:

**4.1 Create Deploy API Directory**
- **Directory:** `/app/api/inference/deploy/`
- **Action:** CREATE NEW DIRECTORY
- **Verification:** `mkdir -p app/api/inference/deploy`

**4.2 Create Deploy Route**
- **File:** `/app/api/inference/deploy/route.ts`
- **Action:** CREATE NEW FILE
- **Lines:** ~350 lines
- **Pattern:** Match `/app/api/training/deploy/google-colab/route.ts`
- **Endpoints:** POST (create deployment)

**Key Sections:**
```typescript
// 1. Authentication (lines ~24-54)
//    Pattern: Exactly like google-colab/route.ts
//    Verify: Supabase auth flow

// 2. Request validation (lines ~56-85)
//    Check: artifact_id exists
//    Check: provider supported

// 3. Secrets retrieval (lines ~87-120)
//    Pattern: Like google-colab - check OAuth first, then vault
//    Verify: RunPod key from vault

// 4. Service call (lines ~122-180)
//    Call: runpodServerlessService.createEndpoint()
//    Verify: Response format matches types

// 5. Database insert (lines ~182-230)
//    Table: inference_deployments
//    Verify: All required fields

// 6. Response (lines ~232-245)
//    Format: Match deployment.types.ts response type
```

**4.3 Create Status Route Directory**
- **Directory:** `/app/api/inference/deployments/[id]/status/`
- **Action:** CREATE NEW DIRECTORY

**4.4 Create Status Route**
- **File:** `/app/api/inference/deployments/[id]/status/route.ts`
- **Action:** CREATE NEW FILE
- **Lines:** ~180 lines
- **Endpoint:** GET (get deployment status)

**4.5 Create Stop Route Directory**
- **Directory:** `/app/api/inference/deployments/[id]/stop/`
- **Action:** CREATE NEW DIRECTORY

**4.6 Create Stop Route**
- **File:** `/app/api/inference/deployments/[id]/stop/route.ts`
- **Action:** CREATE NEW FILE
- **Lines:** ~180 lines
- **Endpoint:** DELETE (stop deployment)

#### Verification Steps:
```bash
# 1. Verify directory structure
tree app/api/inference/
# Expected:
# app/api/inference/
# ├── deploy/
# │   └── route.ts
# └── deployments/
#     └── [id]/
#         ├── status/
#         │   └── route.ts
#         └── stop/
#             └── route.ts

# 2. Check route exports
grep "export async function" app/api/inference/deploy/route.ts
# Expected: POST

grep "export async function" app/api/inference/deployments/[id]/status/route.ts
# Expected: GET

grep "export async function" app/api/inference/deployments/[id]/stop/route.ts
# Expected: DELETE

# 3. TypeScript compilation
npx tsc --noEmit

# 4. Verify imports don't break existing code
grep -r "from '@/lib/inference/" app/api/training/ --include="*.ts"
# Expected: No results (training routes don't use inference code)

# 5. Check Next.js recognizes routes
npm run build
# Check: No routing errors
```

#### Success Criteria:
- [x] All 3 route files created
- [x] POST, GET, DELETE handlers implemented
- [x] Authentication matches existing pattern
- [x] Secrets vault integration works
- [x] Database operations use correct table
- [x] TypeScript compilation passes
- [x] Next.js build succeeds
- [x] No breaking changes to training routes

#### Rollback Plan:
```bash
rm -rf app/api/inference/
```

#### Files to Verify Won't Break:
- `/app/api/training/deploy/*/route.ts` - Must still work
- `/app/api/training/checkpoints/*/route.ts` - Must still work
- All other API routes must still function

**Verification Commands:**
```bash
# Verify existing training routes still compile
npx tsc --noEmit app/api/training/deploy/google-colab/route.ts
npx tsc --noEmit app/api/training/deploy/kaggle/route.ts
npx tsc --noEmit app/api/training/deploy/runpod/route.ts

# Verify no imports from inference in training code
grep -r "inference" app/api/training/ --include="*.ts"
# Expected: No results
```

---

### PHASE 5: UI COMPONENTS (Days 8-9)
**Status:** ⏳ PENDING PHASE 4 COMPLETION
**Goal:** Create user interface for deployments

#### Pre-Phase Verification:

**5.0.1 Find Training Dashboard Component**
```bash
# Locate training dashboard
find . -name "TrainingDashboard.tsx" -type f
# Expected: components/training/TrainingDashboard.tsx
```

**5.0.2 Read Training Dashboard**
- **File:** `/components/training/TrainingDashboard.tsx`
- **Action:** READ ENTIRE FILE
- **Purpose:** Find where to insert deploy button
- **Search:** "job.status === 'completed'" or similar
- **Find:** Exact line where action buttons are rendered

**5.0.3 Verify Component Patterns**
```bash
# Check existing button components
ls -la components/training/*Button.tsx
# Look for: DeployModelButton.tsx (if exists)

# Check card components
ls -la components/training/*Card.tsx
# Pattern: BestModelCard.tsx, CheckpointResumeCard.tsx
```

#### Tasks:

**5.1 Create Inference Components Directory**
- **Directory:** `/components/inference/`
- **Action:** CREATE NEW DIRECTORY
- **Verification:** `mkdir -p components/inference`

**5.2 Create Deploy Button Component**
- **File:** `/components/inference/InferenceDeployButton.tsx`
- **Action:** CREATE NEW FILE
- **Lines:** ~300 lines
- **Pattern:** Based on existing button components in `components/training/`
- **Dependencies:**
  - UI components (Button, Dialog, etc.)
  - `/lib/inference/deployment.types.ts`

**Component Structure:**
```typescript
// 1. Props interface
interface InferenceDeployButtonProps {
  trainingConfigId: string;
  trainingJobId: string;
  modelName: string;
  artifactId?: string;
}

// 2. State management
//    - Modal open/close
//    - Form inputs (GPU type, budget, etc.)
//    - Loading state
//    - Error state

// 3. API call to /api/inference/deploy

// 4. Success/error handling

// 5. Render:
//    - Button "Deploy to Production"
//    - Modal with configuration form
//    - Cost estimation
//    - Deploy button in modal
```

**5.3 Create Deployment Card Component**
- **File:** `/components/inference/InferenceDeploymentCard.tsx`
- **Action:** CREATE NEW FILE
- **Lines:** ~250 lines
- **Pattern:** Based on `components/training/BestModelCard.tsx`

**5.4 Modify Training Dashboard**
- **File:** `/components/training/TrainingDashboard.tsx`
- **Action:** MODIFY EXISTING FILE
- **Changes:** Add deploy button for completed jobs

**CRITICAL STEPS:**
1. **Read entire file first**
2. **Find exact insertion point** (search for completed job actions)
3. **Verify no breaking changes** (don't remove existing buttons)
4. **Add import at top:**
   ```typescript
   import { InferenceDeployButton } from '@/components/inference/InferenceDeployButton';
   ```
5. **Insert button after existing actions:**
   ```typescript
   {job.status === 'completed' && job.checkpoint_urls && (
     <InferenceDeployButton
       trainingConfigId={job.config_id}
       trainingJobId={job.id}
       modelName={job.model_name}
     />
   )}
   ```

#### Verification Steps:
```bash
# 1. Check components created
ls -la components/inference/
# Expected: InferenceDeployButton.tsx, InferenceDeploymentCard.tsx

# 2. TypeScript compilation
npx tsc --noEmit

# 3. Verify Training Dashboard still compiles
npx tsc --noEmit components/training/TrainingDashboard.tsx

# 4. Check for duplicate imports
grep "InferenceDeployButton" components/training/TrainingDashboard.tsx
# Expected: 2 lines (import + usage)

# 5. Start dev server and check UI
npm run dev
# Navigate to training dashboard
# Verify: No console errors
# Verify: Deploy button appears on completed jobs
# Verify: Existing buttons still work

# 6. Verify no breaking changes
# Test: Click existing action buttons (View Logs, etc.)
# All should still work
```

#### Success Criteria:
- [x] Both components created
- [x] TypeScript compilation passes
- [x] Training Dashboard modified correctly
- [x] Dev server starts without errors
- [x] UI renders without console errors
- [x] Deploy button appears on completed jobs
- [x] Existing functionality not broken
- [x] No duplicate buttons
- [x] No layout issues

#### Rollback Plan:
```bash
# Remove new components
rm -rf components/inference/

# Revert Training Dashboard changes
git checkout components/training/TrainingDashboard.tsx
# OR manually remove added lines
```

#### Files to Verify Won't Break:
- `/components/training/TrainingDashboard.tsx` - Must still render correctly
- `/components/training/BestModelCard.tsx` - Must not be affected
- `/components/training/CheckpointResumeCard.tsx` - Must not be affected
- All other training components must still work

**Critical Verification:**
```bash
# Test existing training dashboard functionality
# 1. View training jobs list
# 2. Click "View Logs" button
# 3. Click checkpoint selection
# 4. Verify no errors

# ONLY AFTER all existing functionality works:
# Test new deploy button
```

---

### PHASE 6: BUDGET CONTROLS & TESTING (Days 10-12)
**Status:** ⏳ PENDING PHASE 5 COMPLETION
**Goal:** Add cost controls and comprehensive testing

#### Pre-Phase Verification:

**6.0.1 Verify All Previous Phases**
```bash
# Check database table exists
npx supabase db psql -c "\d inference_deployments"

# Check all files exist
ls -la lib/inference/deployment.types.ts
ls -la lib/inference/runpod-serverless-service.ts
ls -la app/api/inference/deploy/route.ts
ls -la components/inference/InferenceDeployButton.tsx

# TypeScript compilation
npx tsc --noEmit

# Dev server starts
npm run dev
```

#### Tasks:

**6.1 Add Cost Estimation**
- **File:** `/lib/inference/runpod-serverless-service.ts`
- **Action:** MODIFY EXISTING (add method)
- **Method:** `estimateCost(gpuType, expectedRequests, duration)`
- **Returns:** Estimated cost breakdown

**6.2 Add Budget Tracking**
- **File:** `/app/api/inference/deploy/route.ts`
- **Action:** MODIFY EXISTING (add budget validation)
- **Check:** User has permission to deploy
- **Check:** Budget limit set
- **Check:** Cost estimate within budget

**6.3 Add Budget Monitoring**
- **File:** Create `/lib/inference/budget-monitor.ts`
- **Action:** CREATE NEW FILE
- **Purpose:** Background job to check spending
- **Features:**
  - Check spend vs budget
  - Send alerts at 50%, 80%, 100%
  - Auto-stop at limit

**6.4 Testing Phase**
- **Test 1:** Create deployment with $1 budget
- **Test 2:** Monitor cost tracking
- **Test 3:** Verify auto-stop triggers
- **Test 4:** Test all error scenarios
- **Test 5:** Load test UI

#### Verification Steps:
```bash
# 1. Full TypeScript compilation
npx tsc --noEmit

# 2. Run tests (if exist)
npm test

# 3. Build for production
npm run build

# 4. Manual UI testing checklist:
#    [ ] Training dashboard loads
#    [ ] Deploy button appears
#    [ ] Modal opens
#    [ ] Cost estimate shows
#    [ ] Deployment creates
#    [ ] Status updates
#    [ ] Budget tracking works
#    [ ] Auto-stop triggers
#    [ ] Error handling works

# 5. API testing
#    [ ] POST /api/inference/deploy
#    [ ] GET /api/inference/deployments/[id]/status
#    [ ] DELETE /api/inference/deployments/[id]/stop

# 6. Database verification
npx supabase db psql -c "SELECT * FROM inference_deployments LIMIT 5;"

# 7. Cost tracking verification
#    Deploy with $1 budget
#    Make 10 requests
#    Check spend recorded correctly
```

#### Success Criteria:
- [x] Cost estimation accurate
- [x] Budget limits enforced
- [x] Alerts trigger correctly
- [x] Auto-stop works
- [x] All UI flows work
- [x] All API endpoints work
- [x] Database records correct
- [x] No breaking changes
- [x] TypeScript compilation passes
- [x] Production build succeeds

#### Rollback Plan:
```bash
# Revert all changes from this phase
git diff HEAD~1 > phase6.patch
git checkout HEAD~1
# Review and selectively apply if needed
```

---

## 🔍 VERIFICATION CHECKLIST (Before Each Phase)

### Pre-Implementation Checks:
- [ ] Read all files mentioned in phase
- [ ] Understand existing code patterns
- [ ] Identify all dependencies
- [ ] Check for name conflicts
- [ ] Verify TypeScript compiles
- [ ] List all files that could break

### During Implementation:
- [ ] Create/modify one file at a time
- [ ] Run TypeScript compilation after each file
- [ ] Test import/export chains
- [ ] Verify no console errors
- [ ] Check dev server starts

### Post-Implementation:
- [ ] Full TypeScript compilation passes
- [ ] No TypeScript errors anywhere
- [ ] Dev server starts successfully
- [ ] No console errors in browser
- [ ] All existing features still work
- [ ] New feature works as expected

---

## 🚨 BREAKING CHANGE ANALYSIS

### Potential Breaking Changes by Phase:

#### Phase 1 (Database)
**Risk:** NONE
- New table, no dependencies
- No existing code references this table
- RLS prevents unauthorized access

#### Phase 2 (Types)
**Risk:** NONE
- New file, not imported anywhere yet
- No exports from existing code modified

#### Phase 3 (Service)
**Risk:** LOW
- New file in new directory
- Name doesn't conflict with existing `runpod-service.ts`
- Different API (REST vs GraphQL)

**Mitigation:**
- Use different directory (`/lib/inference/` vs `/lib/training/`)
- Use different name (`runpod-serverless` vs `runpod`)
- Verify no imports before creating

#### Phase 4 (API Routes)
**Risk:** LOW
- New directory (`/app/api/inference/` vs `/app/api/training/`)
- No route conflicts
- Doesn't modify existing routes

**Mitigation:**
- Keep training and inference completely separate
- Don't share code between training and inference routes
- Different table names

#### Phase 5 (UI Components)
**Risk:** MEDIUM ⚠️
- Modifies existing `TrainingDashboard.tsx`
- Could break existing layout/functionality

**Mitigation:**
- Read entire file before modification
- Find exact insertion point
- Don't remove existing code
- Add import at top (verify no conflicts)
- Test all existing buttons still work
- Verify layout doesn't break

**Specific Checks:**
```bash
# Before modifying TrainingDashboard.tsx:
# 1. Take backup
cp components/training/TrainingDashboard.tsx components/training/TrainingDashboard.tsx.backup

# 2. Find insertion point
grep -n "job.status === 'completed'" components/training/TrainingDashboard.tsx

# 3. Verify existing buttons
grep -n "Button\|button" components/training/TrainingDashboard.tsx | head -20

# 4. After modification, compare
diff components/training/TrainingDashboard.tsx.backup components/training/TrainingDashboard.tsx
# Should only show:
# - New import line
# - New button component (3-5 lines)
```

#### Phase 6 (Budget Controls)
**Risk:** LOW
- Modifies existing files but only adds new methods
- No changes to existing method signatures

**Mitigation:**
- Only add new methods, don't modify existing
- Keep budget logic separate from core deployment logic

---

## 📋 ROLLBACK PROCEDURES

### Quick Rollback (Any Phase):
```bash
# If using git:
git status  # See what changed
git diff    # Review changes
git checkout <file>  # Revert specific file
git reset --hard HEAD  # Revert all changes (CAUTION)

# If not using git:
# Use backup files (make backups before each phase)
```

### Phase-Specific Rollback:

**Phase 1:**
```sql
-- Rollback migration
DROP TABLE IF EXISTS inference_deployments CASCADE;
```

**Phase 2:**
```bash
rm -f lib/inference/deployment.types.ts
```

**Phase 3:**
```bash
rm -f lib/inference/runpod-serverless-service.ts
```

**Phase 4:**
```bash
rm -rf app/api/inference/
```

**Phase 5:**
```bash
# Revert Training Dashboard
git checkout components/training/TrainingDashboard.tsx
# OR use backup
cp components/training/TrainingDashboard.tsx.backup components/training/TrainingDashboard.tsx

# Remove new components
rm -rf components/inference/
```

**Phase 6:**
```bash
# Revert modified files
git checkout lib/inference/runpod-serverless-service.ts
git checkout app/api/inference/deploy/route.ts

# Remove new file
rm -f lib/inference/budget-monitor.ts
```

---

## 🎯 SUCCESS METRICS

### Phase Completion Criteria:
Each phase is only complete when ALL of these are true:
- [ ] All files created/modified as planned
- [ ] TypeScript compilation passes (0 errors)
- [ ] Dev server starts without errors
- [ ] No console errors in browser
- [ ] All existing features still work
- [ ] New feature works as expected
- [ ] Rollback plan tested and ready

### MVP Launch Criteria:
- [ ] User can deploy LoRA adapter to RunPod Serverless
- [ ] Endpoint URL is provided and accessible
- [ ] Budget limits are enforced
- [ ] Cost tracking accurate to within 10%
- [ ] User can stop deployment manually
- [ ] Status updates in UI
- [ ] No breaking changes to existing features
- [ ] All tests pass
- [ ] Production build succeeds

---

## 📅 TIMELINE

### Conservative Estimate (12 days):
- **Day 1:** Phase 0 - Verification & Setup ✅
- **Day 2-3:** Phase 1 - Database Foundation
- **Day 3:** Phase 2 - Type Definitions
- **Day 4-5:** Phase 3 - RunPod Service
- **Day 6-7:** Phase 4 - API Routes
- **Day 8-9:** Phase 5 - UI Components
- **Day 10-12:** Phase 6 - Budget Controls & Testing

### Aggressive Estimate (8 days):
- **Day 1:** Phase 0-1 ✅
- **Day 2:** Phase 2
- **Day 3-4:** Phase 3
- **Day 5:** Phase 4
- **Day 6:** Phase 5
- **Day 7-8:** Phase 6

### Reality Check:
- Expect delays for debugging
- Budget extra time for testing
- Plan for iteration based on user feedback
- Account for RunPod API quirks

---

## 🔧 TOOLS & COMMANDS

### TypeScript Verification:
```bash
# Full project check
npx tsc --noEmit

# Specific file
npx tsc --noEmit path/to/file.ts

# Watch mode (during development)
npx tsc --noEmit --watch
```

### Database Verification:
```bash
# List tables
npx supabase db psql -c "\dt"

# Describe table
npx supabase db psql -c "\d inference_deployments"

# Check RLS
npx supabase db psql -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'inference_deployments';"

# Count policies
npx supabase db psql -c "SELECT COUNT(*) FROM pg_policies WHERE tablename = 'inference_deployments';"
```

### File Search:
```bash
# Find files
find . -name "*inference*" -type f

# Search content
grep -r "InferenceDeployButton" . --include="*.tsx"

# Check imports
grep -r "from '@/lib/inference/" app/ --include="*.ts" --include="*.tsx"
```

### Dev Server:
```bash
# Start
npm run dev

# Build (production test)
npm run build

# Type check
npm run type-check  # If script exists
```

---

## 🚦 DECISION GATES

Before proceeding to next phase, answer:

### Phase 0 → Phase 1:
- [ ] Investigation complete?
- [ ] User approved approach?
- [ ] All unknowns resolved?

### Phase 1 → Phase 2:
- [ ] Database table created?
- [ ] Migration successful?
- [ ] RLS policies working?

### Phase 2 → Phase 3:
- [ ] Types defined?
- [ ] No import errors?
- [ ] TypeScript happy?

### Phase 3 → Phase 4:
- [ ] Service created?
- [ ] Methods implemented?
- [ ] No conflicts with existing services?

### Phase 4 → Phase 5:
- [ ] API routes created?
- [ ] Endpoints responding?
- [ ] Database operations working?

### Phase 5 → Phase 6:
- [ ] UI components created?
- [ ] No breaking changes in Training Dashboard?
- [ ] User can see deploy button?

### Phase 6 → Launch:
- [ ] Budget controls working?
- [ ] All tests passing?
- [ ] User tested and approved?

---

## 📝 PROGRESS TRACKING

**Current Phase:** Phase 0 (Verification & Setup)
**Status:** In Progress
**Next Phase:** Phase 1 (Database Foundation) - Pending Approval

**Completed:**
- ✅ Investigation
- ✅ Report created
- ⏳ Phased plan (this document)
- ⏳ Progress logs update
- ⏳ Pre-implementation verification

**Blockers:** None currently
**Risks:** None identified yet
**Questions:** Awaiting user approval to proceed

---

**Document Status:** COMPLETE
**Ready for:** User Review & Approval
**Next Action:** Update progress logs
