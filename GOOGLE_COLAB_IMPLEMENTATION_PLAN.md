# Google Colab Implementation Plan
**Date:** 2025-11-11 (REVISED)
**Platform:** Google Colab Pro/Pro+ ONLY
**Status:** PENDING APPROVAL
**Authentication:** OAuth (primary) + API Key (secondary)

---

## Executive Summary

Focused implementation to add Google Colab as a cloud GPU training platform. Leverages existing Google OAuth infrastructure while also supporting API keys via secrets vault for maximum customization.

---

## Authentication Strategy (Dual Support)

### Primary: OAuth Flow (Recommended)
- **Reuse existing Google OAuth** from login system
- **Add scopes:**
  - `https://www.googleapis.com/auth/drive.file` (create/manage notebooks)
  - `https://www.googleapis.com/auth/colab` (Colab runtime control)
- **User Experience:** Seamless, no extra credentials
- **Implementation:** Extend existing OAuth provider

### Secondary: API Key (Advanced Users)
- **Via Secrets Vault:** Users can add Google Cloud API key
- **Use Case:** Users who want separate Colab credentials
- **Implementation:** Standard secrets manager pattern
- **Format:** JSON service account key

### Implementation Logic
```typescript
async function getColabCredentials(userId: string) {
  // 1. Try OAuth token first (from user's session)
  const session = await getSession();
  if (session?.provider_token) {
    return { type: 'oauth', token: session.provider_token };
  }
  
  // 2. Fall back to API key from secrets vault
  const secret = await secretsManager.getSecret(userId, 'google-colab');
  if (secret) {
    return { type: 'api_key', key: decrypt(secret.api_key_encrypted) };
  }
  
  // 3. Error: No credentials
  throw new Error('No Google credentials found. Please login with Google or add API key.');
}
```

---

## Files Requiring Changes

### ✅ MODIFY (4 files, all non-breaking)

#### 1. `/lib/models/llm-model.types.ts`
**Lines:** 9-20
**Change:** Verify 'google-colab' exists in ModelProvider enum
```typescript
export type ModelProvider =
  | 'openai'
  | ...
  | 'google-colab'  // ✅ Already exists
  | 'custom';
```
**Status:** Already exists, no change needed

---

#### 2. `/lib/training/deployment.types.ts`
**Lines:** 182
**Change:** Add to DeploymentPlatform union
```typescript
export type DeploymentPlatform = 
  | 'kaggle' 
  | 'runpod' 
  | 'huggingface-spaces' 
  | 'local-vllm'
  | 'google-colab';     // ➕ ADD
```

**Lines:** END OF FILE
**Change:** Add Google Colab types
```typescript
// ============================================================================
// GOOGLE COLAB DEPLOYMENT
// ============================================================================

export type ColabGPUTier = 
  | 'none'        // Free tier
  | 't4'          // Colab Pro - T4 GPU
  | 'a100'        // Colab Pro+ - A100 GPU
  | 'v100';       // Legacy - V100 GPU

export interface ColabDeploymentRequest {
  training_config_id: string;
  notebook_name: string;
  gpu_tier?: ColabGPUTier;  // Default: 't4'
  runtime_type?: 'standard' | 'high_ram';
  enable_tpu?: boolean;
  budget_limit?: number; // Compute units
  auto_stop_on_budget?: boolean;
}

export interface ColabDeploymentResponse {
  deployment_id: string;
  notebook_id: string;
  notebook_url: string;
  status: DeploymentStatus;
  gpu_tier: ColabGPUTier;
  runtime_type: string;
  created_at: string;
}

export interface ColabDeploymentStatus {
  deployment_id: string;
  notebook_id: string;
  status: DeploymentStatus;
  notebook_url: string;
  logs?: string;
  metrics?: DeploymentMetrics;
  compute_units_used?: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  checkpoint_urls?: string[];
}
```

---

#### 3. `/components/training/DeploymentTargetSelector.tsx`
**Lines:** 42-47
**Change:** Add to DeploymentTarget union
```typescript
export type DeploymentTarget = 
  | 'local-vllm'
  | 'local-gpu'
  | 'huggingface-spaces'
  | 'runpod'
  | 'kaggle'
  | 'google-colab';    // ➕ ADD
```

**Lines:** 79-85
**Change:** Add configuration state
```typescript
const [colabNotebookName, setColabNotebookName] = useState('');
const [colabGpuTier, setColabGpuTier] = useState<string>('t4');
const [colabBudget, setColabBudget] = useState<string>('100');
```

**Lines:** 90-130
**Change:** Add deployment option
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

**Lines:** 135-259
**Change:** Add handler in handleDeploy()
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
}
```

**Lines:** 273-385
**Change:** Add configuration form
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

---

#### 4. `/app/secrets/page.tsx`
**Lines:** 140
**Status:** Already has 'google-colab' entry
**Verify:** Ensure description mentions both OAuth and API key
```typescript
'google-colab': { 
  name: 'Google Colab', 
  description: 'OAuth (automatic) or Google Cloud service account JSON for Colab notebooks' 
},
```

---

### ➕ NEW FILES (3 files)

#### 1. `/lib/training/google-colab-service.ts`
**Purpose:** Google Colab API client
**Estimated LOC:** ~300 lines
**Pattern:** Based on kaggle-service.ts + Google Drive API

**Key Methods:**
- `createNotebook()` - Create Colab notebook via Drive API
- `getNotebookStatus()` - Check runtime status
- `stopNotebook()` - Stop runtime
- `getNotebookLogs()` - Fetch execution logs
- `uploadTrainingCode()` - Upload training script to notebook

---

#### 2. `/app/api/training/deploy/google-colab/route.ts`
**Purpose:** Google Colab deployment API
**Estimated LOC:** ~250 lines
**Pattern:** Based on kaggle/route.ts

**Endpoints:**
- `POST /api/training/deploy/google-colab` - Create notebook
- `GET /api/training/deploy/google-colab?deployment_id=<id>` - Get status
- `DELETE /api/training/deploy/google-colab?deployment_id=<id>` - Stop notebook

**Authentication Logic:**
```typescript
// Priority 1: OAuth token from session
const session = await getSession();
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

---

#### 3. `/lib/auth/google-oauth-scopes.ts` (NEW)
**Purpose:** Centralized OAuth scope management
**Estimated LOC:** ~50 lines

```typescript
/**
 * Google OAuth Scopes for different features
 * Centralized to ensure consistency across login and Colab
 */

export const GOOGLE_OAUTH_SCOPES = {
  // Base scopes (already in use for login)
  profile: 'https://www.googleapis.com/auth/userinfo.profile',
  email: 'https://www.googleapis.com/auth/userinfo.email',
  
  // Colab-specific scopes (ADD THESE)
  drive_file: 'https://www.googleapis.com/auth/drive.file',  // Create/manage notebooks
  colab: 'https://www.googleapis.com/auth/colab',            // Colab runtime control
};

// Complete scope array for login
export const LOGIN_SCOPES = [
  GOOGLE_OAUTH_SCOPES.profile,
  GOOGLE_OAUTH_SCOPES.email,
  GOOGLE_OAUTH_SCOPES.drive_file,  // ➕ ADD
  GOOGLE_OAUTH_SCOPES.colab,        // ➕ ADD
];
```

**Where to use:** Update your existing Google OAuth provider config

---

## Database Migration

```sql
-- File: supabase/migrations/20251112000001_add_google_colab.sql

-- Step 1: Drop existing CHECK constraint
ALTER TABLE cloud_deployments DROP CONSTRAINT IF EXISTS cloud_deployments_platform_check;

-- Step 2: Add new CHECK constraint with Google Colab
ALTER TABLE cloud_deployments
ADD CONSTRAINT cloud_deployments_platform_check
CHECK (platform IN (
  'kaggle',
  'runpod',
  'huggingface-spaces',
  'local-vllm',
  'google-colab'
));

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ Google Colab platform added';
  RAISE NOTICE 'Supported platforms: kaggle, runpod, huggingface-spaces, google-colab, local-vllm';
END $$;
```

---

## OAuth Scope Update (Existing Files)

### Find Your Google OAuth Config

Search for your existing Google OAuth setup:
```bash
grep -r "GoogleProvider\|google.*oauth\|GOOGLE_CLIENT" --include="*.ts" --include="*.tsx"
```

### Add Scopes

**Before:**
```typescript
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  authorization: {
    params: {
      scope: 'openid email profile'
    }
  }
})
```

**After:**
```typescript
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  authorization: {
    params: {
      scope: 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/colab'
    }
  }
})
```

---

## Implementation Timeline

### Week 1: Foundation (Days 1-2)
- [ ] Add Google Colab types to deployment.types.ts
- [ ] Create google-colab-service.ts skeleton
- [ ] Update OAuth scopes (if not already done)
- [ ] Test OAuth token retrieval

### Week 2: API & Service (Days 3-4)
- [ ] Implement google-colab-service.ts
  - [ ] createNotebook()
  - [ ] getNotebookStatus()
  - [ ] stopNotebook()
- [ ] Create API route (/api/training/deploy/google-colab/route.ts)
  - [ ] POST handler (create)
  - [ ] GET handler (status)
  - [ ] DELETE handler (stop)
- [ ] Test with OAuth credentials

### Week 3: UI & Testing (Day 5)
- [ ] Update DeploymentTargetSelector.tsx
  - [ ] Add Google Colab card
  - [ ] Add configuration form
  - [ ] Add deployment handler
- [ ] Run database migration
- [ ] End-to-end testing
  - [ ] OAuth flow
  - [ ] API key flow
  - [ ] Deployment creation
  - [ ] Status monitoring

---

## Testing Checklist

### OAuth Flow
- [ ] User logged in with Google can deploy (no extra credentials)
- [ ] OAuth token properly retrieved from session
- [ ] Scopes include drive.file and colab
- [ ] Token refresh works (if token expires)

### API Key Flow
- [ ] User can add Google service account JSON to secrets vault
- [ ] Service account properly decrypted
- [ ] Credentials validated before use
- [ ] Clear error if neither OAuth nor API key available

### Deployment
- [ ] Notebook created in user's Google Drive
- [ ] Training code uploaded successfully
- [ ] GPU tier correctly applied
- [ ] Runtime starts automatically
- [ ] Logs stream to UI
- [ ] Compute units tracked
- [ ] Auto-stop on budget works

### Error Handling
- [ ] Clear error if no credentials
- [ ] Helpful message if OAuth scopes missing
- [ ] Retry mechanism for transient failures
- [ ] Graceful handling of Colab API limits

---

## Breaking Change Analysis

### ⚠️ RISKS

**Risk 1: OAuth Scope Addition**
- **Issue:** Existing users will need to re-authenticate
- **Impact:** Login flow shows new permission request
- **Mitigation:** 
  - Add scopes to new users immediately
  - Existing users: Show banner "Reconnect Google for Colab support"
  - Graceful fallback to API key if OAuth lacks scopes

**Risk 2: Database CHECK Constraint**
- **Issue:** Must run migration before deployment
- **Impact:** INSERT will fail without migration
- **Mitigation:** Migration is simple and fast (<1s)

### ✅ NO BREAKING CHANGES
- Existing API routes unchanged
- Existing services unchanged
- Existing React components unchanged
- Existing database queries backward compatible

---

## Success Criteria

- [ ] User can deploy to Colab via OAuth (no extra setup)
- [ ] User can optionally add service account for separate credentials
- [ ] Notebook created and visible in Google Drive
- [ ] Training runs on selected GPU tier
- [ ] Compute units tracked and displayed
- [ ] Auto-stop works when budget exceeded
- [ ] User can download trained model from Colab
- [ ] Clear errors with actionable messages
- [ ] Zero regressions in existing platforms

---

## Cost Estimation

### Development
- **Time:** 5 days
- **Hours:** 40 hours
- **Complexity:** MEDIUM (OAuth reuse simplifies)

### Testing
- **Colab Pro subscription:** $10/month
- **Test compute units:** ~$5
- **Total:** ~$15

---

## Next Steps

1. **USER APPROVAL** ⏸️
2. Review OAuth config location (I'll help find it)
3. Begin implementation
4. Daily progress updates

---

**STATUS:** ⏸️ AWAITING APPROVAL - GOOGLE COLAB ONLY
**Authentication:** OAuth (primary) + API Key (secondary)
**Timeline:** 5 days after approval
**Last Updated:** 2025-11-11
