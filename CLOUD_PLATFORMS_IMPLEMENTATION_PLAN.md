# Cloud GPU Platforms Implementation Plan
**Date:** 2025-11-11
**Platforms:** Google Colab Pro/Pro+, Lambda Labs, vast.ai
**Status:** PENDING APPROVAL

---

## Executive Summary

This document outlines a phased approach to add three new cloud GPU training platforms to the existing deployment system. The implementation follows established patterns from Kaggle, RunPod, and HuggingFace Spaces to ensure consistency and minimize breaking changes.

---

## Architecture Analysis

### Existing Pattern (Verified)

Each cloud platform follows this structure:

1. **Types** (`/lib/training/deployment.types.ts`)
   - Platform-specific Request interface
   - Platform-specific Response interface
   - Platform-specific Status interface
   - GPU/tier type enums

2. **Service Layer** (`/lib/training/*-service.ts`)
   - API client class
   - Authentication helpers
   - CRUD operations (create, get status, stop)
   - Cost estimation logic

3. **API Routes** (`/app/api/training/deploy/[platform]/route.ts`)
   - POST handler (create deployment)
   - GET handler (get status)
   - DELETE handler (stop/cancel)
   - Authentication middleware
   - Secrets vault integration

4. **UI Components** (`/components/training/DeploymentTargetSelector.tsx`)
   - Platform card with icon/description
   - Configuration form fields
   - Budget/cost controls
   - Deployment handler

5. **Secrets Management** (`/app/secrets/page.tsx`)
   - Provider type in ModelProvider enum
   - Provider info (name, description)

---

## Files Requiring Changes

### ✅ FILES TO MODIFY (Non-Breaking)

#### 1. `/lib/models/llm-model.types.ts`
**Lines:** 9-20
**Change:** Add to ModelProvider enum
```typescript
export type ModelProvider =
  | 'openai'
  | ...existing...
  | 'google-colab'  // ✅ Already exists
  | 'lambda-labs'   // ➕ ADD
  | 'vast-ai'       // ➕ ADD
  | 'custom';
```
**Risk:** LOW - Additive only, no breaking changes
**Verification:** TypeScript compilation

---

#### 2. `/lib/training/deployment.types.ts`
**Lines:** 182
**Change:** Add to DeploymentPlatform type
```typescript
export type DeploymentPlatform = 
  | 'kaggle' 
  | 'runpod' 
  | 'huggingface-spaces' 
  | 'local-vllm'
  | 'google-colab'     // ➕ ADD
  | 'lambda-labs'      // ➕ ADD
  | 'vast-ai';         // ➕ ADD
```
**Lines:** END OF FILE
**Change:** Add new platform-specific types (see detailed plan below)
**Risk:** LOW - Additive only
**Verification:** TypeScript compilation

---

#### 3. `/components/training/DeploymentTargetSelector.tsx`
**Lines:** 42-47
**Change:** Add to DeploymentTarget type
```typescript
export type DeploymentTarget = 
  | ...existing...
  | 'google-colab'    // ➕ ADD
  | 'lambda-labs'     // ➕ ADD
  | 'vast-ai';        // ➕ ADD
```
**Lines:** 79-85
**Change:** Add configuration state hooks
**Lines:** 90-130
**Change:** Add platform options to deploymentOptions array
**Lines:** 135-259
**Change:** Add platform handlers in handleDeploy()
**Lines:** 273-385
**Change:** Add configuration forms
**Risk:** LOW - Following existing pattern
**Verification:** UI rendering test

---

#### 4. `/app/secrets/page.tsx`
**Lines:** 138-140
**Change:** Add provider info
```typescript
'lambda-labs': { name: 'Lambda Labs', description: 'Lambda Labs API key for GPU cloud training' },
'vast-ai': { name: 'Vast.ai', description: 'Vast.ai API key for community GPU marketplace' },
```
**Risk:** LOW - Additive only
**Verification:** UI rendering test

---

### ➕ NEW FILES TO CREATE

#### 1. `/lib/training/google-colab-service.ts`
**Purpose:** Google Colab API client
**Pattern:** Based on kaggle-service.ts
**Estimated LOC:** ~300 lines

#### 2. `/lib/training/lambda-labs-service.ts`
**Purpose:** Lambda Labs API client
**Pattern:** Based on runpod-service.ts (similar GraphQL API)
**Estimated LOC:** ~250 lines

#### 3. `/lib/training/vast-ai-service.ts`
**Purpose:** Vast.ai API client
**Pattern:** Based on runpod-service.ts
**Estimated LOC:** ~300 lines

#### 4. `/app/api/training/deploy/google-colab/route.ts`
**Purpose:** Google Colab deployment API
**Pattern:** Based on kaggle/route.ts
**Estimated LOC:** ~200 lines

#### 5. `/app/api/training/deploy/lambda-labs/route.ts`
**Purpose:** Lambda Labs deployment API
**Pattern:** Based on runpod/route.ts
**Estimated LOC:** ~200 lines

#### 6. `/app/api/training/deploy/vast-ai/route.ts`
**Purpose:** Vast.ai deployment API
**Pattern:** Based on runpod/route.ts
**Estimated LOC:** ~200 lines

---

## Breaking Change Analysis

### ⚠️ POTENTIAL RISKS

#### Risk 1: Type Union Expansion
**Issue:** Adding new platforms to `DeploymentPlatform` expands discriminated unions
**Impact:** Code using exhaustive switch statements will need new cases
**Mitigation:** Search codebase for `DeploymentPlatform` usage

```bash
grep -r "DeploymentPlatform" --include="*.ts" --include="*.tsx"
```

**Files Found:** deployment.types.ts, UnifiedDeploymentAPI (if exists)
**Action:** Add default case or explicit handling

---

#### Risk 2: ModelProvider Enum Usage
**Issue:** ModelProvider used in secrets validation
**Impact:** Existing validation may reject new provider names
**Mitigation:** Check secrets-manager.service.ts validation logic

**Action Required:** Verify provider name validation allows new values

---

#### Risk 3: Database Schema
**Issue:** cloud_deployments table may have platform enum constraint
**Impact:** INSERT will fail if database enum doesn't include new platforms
**Mitigation:** Database migration required

**Action Required:** Create Supabase migration to add enum values

---

### ✅ NO BREAKING CHANGES IN:

- Existing API routes (no signature changes)
- Existing service classes (no method changes)
- Existing React components (props unchanged)
- Existing database queries (backward compatible)
- Existing type definitions (additive only)

---

## Phased Implementation Plan

### Phase 1: Google Colab Pro/Pro+ (Week 1)
**Complexity:** MEDIUM
**API:** Google Drive API + Colab Runtime API
**Prerequisites:** OAuth2 setup (more complex than API key)

#### Steps:
1. Add types to deployment.types.ts
2. Create google-colab-service.ts
3. Create /api/training/deploy/google-colab/route.ts
4. Update DeploymentTargetSelector.tsx
5. Update secrets page
6. Add ModelProvider enum value
7. Test with real Colab account

#### Deliverables:
- Working Colab deployment
- OAuth2 flow documented
- Cost tracking (Colab compute units)
- GPU tier selection (None, T4, A100, V100)

---

### Phase 2: Lambda Labs (Week 2)
**Complexity:** LOW-MEDIUM
**API:** REST API with API key
**Prerequisites:** Simple API key authentication

#### Steps:
1. Add types to deployment.types.ts
2. Create lambda-labs-service.ts
3. Create /api/training/deploy/lambda-labs/route.ts
4. Update DeploymentTargetSelector.tsx
5. Update secrets page
6. Add ModelProvider enum value
7. Test with real Lambda account

#### Deliverables:
- Working Lambda Labs deployment
- GPU selection (A100, H100, A6000)
- Cost tracking ($/hour)
- Availability checking (instances often sold out)

---

### Phase 3: vast.ai (Week 3)
**Complexity:** MEDIUM-HIGH
**API:** REST API with API key
**Prerequisites:** Complex marketplace API (bidding system)

#### Steps:
1. Add types to deployment.types.ts
2. Create vast-ai-service.ts
3. Create /api/training/deploy/vast-ai/route.ts
4. Update DeploymentTargetSelector.tsx
5. Update secrets page
6. Add ModelProvider enum value
7. Test with real vast.ai account

#### Deliverables:
- Working vast.ai deployment
- Instance search by GPU type and price
- Spot bidding system
- Reliability rating display
- Cost tracking (very low $/hour)

---

### Phase 4: Integration & Testing (Week 4)

#### Steps:
1. Database migration for new platform enums
2. Integration testing across all platforms
3. Error handling verification
4. Documentation updates
5. User guide for credentials setup

#### Deliverables:
- All 8 platforms working (5 existing + 3 new)
- Updated documentation
- Migration guide
- Video tutorial for credential setup

---

## API Documentation Reference

### Google Colab
- **Auth:** OAuth2 (Google Cloud Platform)
- **API Docs:** https://colab.research.google.com/
- **Runtime API:** Internal Google APIs (limited docs)
- **Challenge:** No official public API, requires workarounds

### Lambda Labs
- **Auth:** API key (Bearer token)
- **API Docs:** https://cloud.lambdalabs.com/api/v1/docs
- **Base URL:** https://cloud.lambdalabs.com/api/v1
- **Endpoint Pattern:** /instance-operations/launch

### vast.ai
- **Auth:** API key (Header)
- **API Docs:** https://vast.ai/docs/api
- **Base URL:** https://console.vast.ai/api/v0
- **Endpoint Pattern:** /bundles/create

---

## Cost Estimation

### Development Time

| Phase | Duration | Developer Hours |
|-------|----------|-----------------|
| Phase 1: Google Colab | 5 days | 40 hours |
| Phase 2: Lambda Labs | 3 days | 24 hours |
| Phase 3: vast.ai | 4 days | 32 hours |
| Phase 4: Integration | 3 days | 24 hours |
| **Total** | **15 days** | **120 hours** |

### Testing Requirements

- Google Colab Pro subscription ($10/month)
- Lambda Labs credits ($20 minimum)
- vast.ai credits ($10 minimum)
- **Total Testing Budget:** ~$50

---

## Validation Checklist

### Before Implementation

- [ ] Verify no breaking changes in type definitions
- [ ] Check database enum constraints
- [ ] Review secrets-manager validation logic
- [ ] Confirm API documentation access
- [ ] Obtain test credentials for each platform

### During Implementation (Per Platform)

- [ ] TypeScript compilation passes
- [ ] All imports resolve correctly
- [ ] No circular dependencies
- [ ] API client tests pass
- [ ] UI renders without errors
- [ ] Secrets vault integration works
- [ ] Cost tracking calculates correctly

### After Implementation

- [ ] Integration test across all platforms
- [ ] Database migrations applied
- [ ] Documentation updated
- [ ] Error handling tested
- [ ] User acceptance testing

---

## Migration Strategy

### Database Migration (Required)

```sql
-- Supabase Migration: Add new deployment platforms
-- File: supabase/migrations/YYYYMMDD_add_cloud_platforms.sql

-- Alter platform enum to include new values
ALTER TYPE deployment_platform ADD VALUE IF NOT EXISTS 'google-colab';
ALTER TYPE deployment_platform ADD VALUE IF NOT EXISTS 'lambda-labs';
ALTER TYPE deployment_platform ADD VALUE IF NOT EXISTS 'vast-ai';

-- Update comments
COMMENT ON TYPE deployment_platform IS 'Supported cloud deployment platforms: kaggle, runpod, huggingface-spaces, google-colab, lambda-labs, vast-ai, local-vllm';

-- Verify
SELECT enum_range(NULL::deployment_platform);
```

### Rollback Plan

If issues arise:
1. Remove new platform options from UI (set `available: false`)
2. Keep API routes (no breaking changes)
3. Revert database migration if needed
4. No impact on existing platforms

---

## Success Criteria

### Phase 1 (Google Colab)
- [ ] User can authenticate with Google OAuth2
- [ ] Notebook is created automatically
- [ ] Training runs on selected GPU tier
- [ ] Costs are tracked in compute units
- [ ] User can download trained model

### Phase 2 (Lambda Labs)
- [ ] User can add API key to secrets vault
- [ ] Instance is launched automatically
- [ ] Training runs on selected GPU
- [ ] Hourly costs are tracked
- [ ] User receives availability warnings

### Phase 3 (vast.ai)
- [ ] User can add API key to secrets vault
- [ ] Instance is found via search
- [ ] Spot bid is placed automatically
- [ ] Training runs when instance allocated
- [ ] Very low costs verified

### Overall
- [ ] All 8 platforms work independently
- [ ] No regressions in existing platforms
- [ ] Documentation is complete
- [ ] User can switch between platforms easily

---

## Open Questions (For User)

1. **Google Colab OAuth:** Should we use OAuth2 flow or simple API key? (OAuth more secure but complex)
2. **Lambda Labs Availability:** How to handle "sold out" instances? Queue or fail immediately?
3. **vast.ai Reliability:** Show reliability ratings in UI? (some hosts are unreliable)
4. **Priority Order:** Confirm Google Colab → Lambda → vast.ai sequence?
5. **Budget Limits:** Should all platforms have auto-stop on budget exceeded?

---

## Dependencies

### NPM Packages (may need to add)

```json
{
  "@google-cloud/storage": "^7.7.0",     // Google Colab file management
  "googleapis": "^128.0.0"                // Google APIs client
}
```

### Environment Variables (to add)

```bash
# Google Colab
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/auth/google/callback

# Lambda Labs (none - uses API key from secrets)

# vast.ai (none - uses API key from secrets)
```

---

## Next Steps

1. **USER APPROVAL REQUIRED** ⏸️
2. After approval → Begin Phase 1 (Google Colab)
3. Weekly progress updates
4. Demo after each phase completion

---

**STATUS:** ⏸️ AWAITING USER APPROVAL

**Last Updated:** 2025-11-11
**Document Version:** 1.0
