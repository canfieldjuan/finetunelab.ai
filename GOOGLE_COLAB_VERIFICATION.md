# Google Colab Implementation - File Verification & Insertion Points
**Date:** 2025-11-12
**Status:** VERIFICATION PHASE
**Purpose:** Document exact files, code insertion points, and validation steps

---

## Files Verification Checklist

### ✅ COMPLETED FILES

#### 1. `/lib/training/deployment.types.ts` - VERIFIED & COMPLETED
**Status:** ✅ Types already added (Lines 182, 259-302)
**Changes Made:**
- Line 182: Added 'google-colab' to DeploymentPlatform union
- Lines 263-267: Added ColabGPUTier type
- Lines 269-277: Added ColabDeploymentRequest interface
- Lines 279-287: Added ColabDeploymentResponse interface
- Lines 289-302: Added ColabDeploymentStatus interface
**Testing:** TypeScript compilation required

#### 2. `/supabase/migrations/20251112000001_add_google_colab.sql` - VERIFIED & CREATED
**Status:** ✅ Migration file created
**Purpose:** Update database CHECK constraint
**Testing:** Migration must be run and verified in database

#### 3. `/app/secrets/page.tsx` - VERIFIED (NO CHANGES NEEDED)
**Line 140:** Already has google-colab entry
**Current Description:** 'Google Cloud API credentials for Colab notebooks'
**Recommended Update:** 'OAuth (automatic) or Google Cloud service account JSON for Colab notebooks'
**Decision:** Will update description to clarify dual auth support

---

## FILES TO CREATE

### 1. `/lib/training/google-colab-service.ts`
**Status:** ⏳ PENDING CREATION
**Estimated LOC:** ~300 lines
**Pattern:** Based on `/lib/training/kaggle-service.ts`

**Required Imports:**
```typescript
import type {
  ColabDeploymentRequest,
  ColabDeploymentResponse,
  ColabDeploymentStatus,
  DeploymentStatus,
} from './deployment.types';
```

**Required Interfaces:**
- `ColabCredentials` - OAuth token or service account
- `ColabNotebookResponse` - Google Drive API response
- `ColabRuntimeResponse` - Runtime status from Colab API

**Key Methods:**
1. `getAuthHeaders()` - Create OAuth or service account headers
2. `createNotebook()` - Create Colab notebook via Drive API
3. `getNotebookStatus()` - Check runtime status
4. `getNotebookLogs()` - Fetch execution logs
5. `stopNotebook()` - Stop runtime
6. `generateNotebook()` - Generate training notebook content
7. `mapColabStatus()` - Map Colab status to DeploymentStatus

**Dependencies:**
- Google Drive API v3 (REST)
- Google OAuth2 (for token validation)
- May require: `googleapis` npm package

**Testing Requirements:**
- Unit tests for each method
- Mock Google API responses
- Test OAuth and service account flows
- Verify notebook generation

---

### 2. `/app/api/training/deploy/google-colab/route.ts`
**Status:** ⏳ PENDING CREATION
**Estimated LOC:** ~250 lines
**Pattern:** Based on `/app/api/training/deploy/kaggle/route.ts`

**Required Structure:**
```typescript
// Imports
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { googleColabService } from '@/lib/training/google-colab-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import { decrypt } from '@/lib/models/encryption';
import type { ColabDeploymentRequest } from '@/lib/training/deployment.types';

export const runtime = 'nodejs';

// Handlers
export async function POST(req: NextRequest) {}
export async function GET(req: NextRequest) {}
export async function DELETE(req: NextRequest) {}
```

**POST Handler Flow:**
1. Authenticate user (Lines 24-52 pattern from kaggle/route.ts)
2. Parse and validate request body
3. Get credentials - DUAL AUTH LOGIC:
   ```typescript
   // Priority 1: OAuth token from session
   const { data: { session } } = await supabase.auth.getSession();
   if (session?.provider === 'google' && session?.provider_token) {
     credentials = { type: 'oauth', token: session.provider_token };
   }

   // Priority 2: API key from secrets vault
   if (!credentials) {
     const secret = await secretsManager.getSecret(user.id, 'google-colab', supabase);
     if (secret) {
       credentials = { type: 'service_account', key: decrypt(secret.api_key_encrypted) };
     }
   }

   // Error: No credentials
   if (!credentials) {
     return NextResponse.json({
       error: 'No Google credentials found',
       details: 'Please login with Google or add a service account key in Secrets Vault'
     }, { status: 401 });
   }
   ```
4. Get training config from database
5. Call googleColabService.createNotebook()
6. Save deployment record to cloud_deployments table
7. Return response

**GET Handler (Status Check):**
- Query param: `deployment_id`
- Fetch from cloud_deployments table
- Call googleColabService.getNotebookStatus()
- Return status

**DELETE Handler (Stop):**
- Query param: `deployment_id`
- Call googleColabService.stopNotebook()
- Update cloud_deployments status to 'stopped'

**Testing Requirements:**
- Test POST with OAuth credentials
- Test POST with service account credentials
- Test POST with no credentials (should fail)
- Test GET status endpoint
- Test DELETE stop endpoint

---

## FILES TO MODIFY

### 1. `/components/training/DeploymentTargetSelector.tsx`
**Status:** ⏳ PENDING MODIFICATION
**Lines to Modify:** 42-47, 79-86, 90-130, 156-245, 281-385

#### Change 1: Add to DeploymentTarget type (Line 42-47)
**Current Code:**
```typescript
export type DeploymentTarget =
  | 'local-vllm'
  | 'local-gpu'
  | 'huggingface-spaces'
  | 'runpod'
  | 'kaggle';
```

**New Code:**
```typescript
export type DeploymentTarget =
  | 'local-vllm'
  | 'local-gpu'
  | 'huggingface-spaces'
  | 'runpod'
  | 'kaggle'
  | 'google-colab';  // ➕ ADD
```

**Exact Insertion Point:** After line 47, before semicolon
**Validation:** TypeScript compilation must pass

---

#### Change 2: Add configuration state (After Line 85)
**Insert After Line 85:**
```typescript
  const [colabNotebookName, setColabNotebookName] = useState('');
  const [colabGpuTier, setColabGpuTier] = useState<string>('t4');
  const [colabBudget, setColabBudget] = useState<string>('100');
```

**Exact Insertion Point:** After `const [hfBudget, setHfBudget] = useState<string>('3.00');`
**Validation:** Component renders without errors

---

#### Change 3: Add deployment option to array (After Line 129, before Line 130 closing bracket)
**Insert Before Line 130:**
```typescript
    {
      id: 'google-colab',
      label: 'Google Colab',
      description: 'Run training on Google Colab with free or Pro GPUs',
      icon: <Cloud className="w-5 h-5" />,
      badge: 'Popular',
      available: true,
    },
```

**Exact Insertion Point:** After the Kaggle option object, before the closing `];`
**Validation:** UI renders 6 deployment cards

---

#### Change 4: Add handler in handleDeploy() (After Line 243, before Line 244)
**Insert Before the "Unknown deployment target" error:**
```typescript
      } else if (target === 'google-colab') {
        // Deploy to Google Colab
        response = await fetch('/api/training/deploy/google-colab', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            training_config_id: trainingConfigId,
            notebook_name: colabNotebookName || `training-${Date.now()}`,
            gpu_tier: colabGpuTier,
            budget_limit: parseFloat(colabBudget),
            auto_stop_on_budget: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Google Colab deployment failed');
        }

        data = await response.json();
        setDeploymentUrl(data.notebook_url);
        setDeploymentId(data.deployment_id);

```

**Exact Insertion Point:** After the local-gpu handler, before the `throw new Error(\`Unknown deployment target: ${target}\`)` line
**Validation:** TypeScript compilation + runtime test

---

#### Change 5: Add configuration form (After Line 385, before Line 386 closing div)
**Insert Before the `</div>` that closes the configuration section:**
```typescript
          {/* Google Colab Configuration */}
          <div className="space-y-2">
            <Label htmlFor="colab-notebook-name" className="text-sm font-medium">
              Colab Notebook Name
            </Label>
            <Input
              id="colab-notebook-name"
              type="text"
              placeholder="My Training Notebook"
              value={colabNotebookName}
              onChange={(e) => setColabNotebookName(e.target.value)}
              className="w-full"
            />
            <Label htmlFor="colab-gpu-tier" className="text-sm font-medium mt-2">
              GPU Tier
            </Label>
            <Select value={colabGpuTier} onValueChange={setColabGpuTier}>
              <SelectTrigger id="colab-gpu-tier">
                <SelectValue placeholder="Select GPU Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">CPU Only (Free)</SelectItem>
                <SelectItem value="t4">T4 GPU (Colab Pro - $10/mo)</SelectItem>
                <SelectItem value="a100">A100 GPU (Colab Pro+ - $50/mo)</SelectItem>
                <SelectItem value="v100">V100 GPU (Legacy)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 mt-2">
              <Label htmlFor="colab-budget" className="text-sm font-medium">
                Compute Units Limit
              </Label>
            </div>
            <Input
              id="colab-budget"
              type="number"
              step="10"
              min="0"
              placeholder="100"
              value={colabBudget}
              onChange={(e) => setColabBudget(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Notebook will auto-stop when compute units exhausted
            </p>
          </div>
```

**Exact Insertion Point:** After the HuggingFace Spaces configuration, before the closing `</div>` of the configuration section
**Validation:** UI renders configuration form correctly

---

### 2. `/app/secrets/page.tsx` (OPTIONAL UPDATE)
**Status:** ⏳ PENDING MODIFICATION (OPTIONAL)
**Line to Modify:** 140

**Current Code:**
```typescript
'google-colab': { name: 'Google Colab', description: 'Google Cloud API credentials for Colab notebooks' },
```

**Recommended Update:**
```typescript
'google-colab': { name: 'Google Colab', description: 'OAuth (automatic via Google login) or Google Cloud service account JSON for Colab notebooks' },
```

**Exact Insertion Point:** Replace line 140
**Validation:** UI renders updated description
**Priority:** LOW (existing description acceptable)

---

## VALIDATION & TESTING CHECKLIST

### Phase 1: File Creation & Compilation
- [ ] Create google-colab-service.ts
- [ ] Run TypeScript compilation: `npx tsc --noEmit`
- [ ] Verify no TypeScript errors
- [ ] Create API route file
- [ ] Run TypeScript compilation again
- [ ] Verify no errors

### Phase 2: UI Modifications
- [ ] Update DeploymentTargetSelector.tsx (5 changes)
- [ ] Run TypeScript compilation
- [ ] Verify no errors
- [ ] Start dev server: `npm run dev`
- [ ] Verify UI renders without console errors
- [ ] Check all 6 deployment cards render
- [ ] Check configuration forms render

### Phase 3: Database Migration
- [ ] Review migration file
- [ ] Run migration: `npx supabase migration up`
- [ ] Verify CHECK constraint updated
- [ ] Test INSERT with 'google-colab' platform

### Phase 4: Integration Testing
- [ ] Test OAuth flow: Login with Google → Deploy
- [ ] Test API key flow: Add service account → Deploy
- [ ] Test error handling: No credentials → Proper error
- [ ] Test deployment creation
- [ ] Test status monitoring
- [ ] Test stop/cancel
- [ ] Verify database records created
- [ ] Check logs for errors

### Phase 5: Regression Testing
- [ ] Verify Kaggle deployment still works
- [ ] Verify RunPod deployment still works
- [ ] Verify HuggingFace deployment still works
- [ ] Verify no TypeScript errors anywhere
- [ ] Verify no console errors in browser

---

## DEPENDENCIES TO INSTALL

### NPM Packages (Verify First)
```bash
# Check if already installed
npm ls googleapis
npm ls @google-cloud/storage

# If not installed, add:
npm install googleapis
npm install @google-cloud/storage
```

**Note:** Only install if needed after testing Google Drive API access with fetch()

---

## ROLLBACK PLAN

If issues occur:

1. **TypeScript Errors:**
   - Revert changes to DeploymentTargetSelector.tsx
   - Run `npx tsc --noEmit` to verify

2. **API Errors:**
   - Set `available: false` in deploymentOptions for google-colab
   - Keeps code but disables feature

3. **Database Errors:**
   - Rollback migration:
     ```sql
     ALTER TABLE cloud_deployments DROP CONSTRAINT IF EXISTS cloud_deployments_platform_check;
     ALTER TABLE cloud_deployments ADD CONSTRAINT cloud_deployments_platform_check
     CHECK (platform IN ('kaggle', 'runpod', 'huggingface-spaces', 'local-vllm'));
     ```

4. **Full Rollback:**
   - Delete google-colab-service.ts
   - Delete google-colab API route
   - Revert DeploymentTargetSelector.tsx
   - Rollback database migration
   - Run TypeScript compilation

---

## CURRENT STATUS

**Phase:** File verification complete
**Next Step:** Create google-colab-service.ts
**Blockers:** None
**Ready to Proceed:** YES

---

**Last Updated:** 2025-11-12
**Document Status:** READY FOR IMPLEMENTATION
