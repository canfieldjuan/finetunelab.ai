# HuggingFace Hub Upload Implementation

**Date:** 2025-11-25
**Status:** Completed (Updated)

## Summary

Implemented automatic model upload to HuggingFace Hub after cloud training completes on RunPod. This allows users to easily access and deploy their fine-tuned models.

**Key Feature:** HF repo names are now **auto-generated** from the user's HF username + training config name. No manual input needed per deployment!

## Changes Made

### Phase 1: Fixed Training Config Path (Completed Previously)
- Fixed nested config access: `trainingConfig.training?.num_epochs` instead of `trainingConfig.num_epochs`
- Applied to all three trainers: SFT, DPO, ORPO

### Phase 2: Added HF Hub Upload Code to Training Script (Completed Previously)
- Added HuggingFace Hub upload logic to training script
- Uses `HfApi.upload_folder()` to upload the fine-tuned model
- Expects `HF_TOKEN` and `HF_REPO_NAME` environment variables

### Phase 3: Add HF Credentials to Deployment Flow
**File:** `app/api/training/deploy/runpod/route.ts`

**Changes:**
1. Added retrieval of HuggingFace API token from secrets vault (lines 352-365):
   ```typescript
   let hfApiToken: string | undefined;
   try {
     const hfSecret = await secretsManager.getSecret(user.id, 'huggingface', supabase);
     if (hfSecret?.api_key_encrypted) {
       hfApiToken = decrypt(hfSecret.api_key_encrypted);
     }
   } catch (error) {
     console.warn('[RunPod API] Failed to retrieve HuggingFace token:', error);
   }
   ```

2. Added `HF_TOKEN` to environment variables passed to pod (lines 505-507):
   ```typescript
   environment_variables: {
     ...environment_variables,
     // ... other vars ...
     ...(hfApiToken && { HF_TOKEN: hfApiToken }),
   }
   ```

### Phase 4: Update UI to Collect HF Repo Name
**File:** `components/training/CloudDeploymentWizard.tsx`

**Changes:**
1. Added state for HF repo name (line 86):
   ```typescript
   const [hfRepoName, setHfRepoName] = useState<string>('');
   ```

2. Added input field in configuration step (lines 311-326):
   - New text input for HuggingFace Hub Repository
   - Placeholder: "username/my-fine-tuned-model"
   - Help text explaining requirements

3. Updated API call to pass HF_REPO_NAME (lines 162-167):
   ```typescript
   ...(hfRepoName && {
     environment_variables: {
       HF_REPO_NAME: hfRepoName,
     },
   }),
   ```

4. Added HF repo to review step display (lines 398-403):
   - Shows HF Hub Upload target if configured

### Phase 5: Store Model URL in Job Record
**File:** `lib/training/runpod-service.ts`

**Changes:**
1. Added `model_url` tracking variable (line 739):
   ```python
   model_url = None  # Track uploaded model URL
   ```

2. Added repo creation before upload (lines 747-751):
   ```python
   api.create_repo(repo_id=HF_REPO_NAME, token=HF_TOKEN, repo_type="model", exist_ok=True)
   ```

3. Capture model URL after successful upload (line 759):
   ```python
   model_url = f"https://huggingface.co/{HF_REPO_NAME}"
   ```

4. Store model_url in completion update (lines 768-778):
   ```python
   update_data = {
     'status': 'completed',
     'progress': 100.0,
     'completed_at': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime()),
   }
   if model_url:
     update_data['model_url'] = model_url
   ```

**SQL Migration Required:** `ADD_MODEL_URL_COLUMN.sql`
- Adds `model_url TEXT` column to `local_training_jobs` table
- Grants UPDATE permission on new column to anon/authenticated roles

## How to Use

1. **Configure HuggingFace Credentials (One Time):**
   - Go to Settings → Secrets
   - Add/Edit the "HuggingFace" provider
   - Enter your HuggingFace API token
   - Enter your HuggingFace username (e.g., `juan-canfield`)

2. **Deploy Training:**
   - Go to Training Configs → Select Config → Deploy to Cloud
   - Complete deployment wizard (no HF input needed!)
   - Model repo name is auto-generated: `{hf_username}/{config-name}`

3. **After Training Completes:**
   - Model is automatically uploaded to HuggingFace Hub
   - Model URL is stored in job record (e.g., `https://huggingface.co/juan-canfield/my-config-name`)
   - Can be viewed in training monitor

## SQL Migrations

**Run these in Supabase SQL Editor:**

### 1. Add metadata column to provider_secrets (for HF username):
```sql
-- File: ADD_SECRETS_METADATA_COLUMN.sql
ALTER TABLE provider_secrets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
```

### 2. Add model_url column to local_training_jobs:
```sql
-- File: ADD_MODEL_URL_COLUMN.sql
ALTER TABLE local_training_jobs ADD COLUMN IF NOT EXISTS model_url TEXT;
GRANT UPDATE (model_url) ON local_training_jobs TO anon, authenticated;
```

## Files Modified

1. `/app/api/training/deploy/runpod/route.ts` - HF token/username retrieval and auto-generated repo name
2. `/components/training/CloudDeploymentWizard.tsx` - Removed manual HF repo input (now automatic)
3. `/lib/training/runpod-service.ts` - Model upload logic and URL storage
4. `/lib/secrets/secrets.types.ts` - Added metadata types for provider secrets
5. `/lib/secrets/secrets-manager.service.ts` - Handle metadata in create/update
6. `/app/api/secrets/route.ts` - Accept metadata in POST
7. `/app/api/secrets/[provider]/route.ts` - Accept metadata in PUT
8. `/app/secrets/page.tsx` - Added HF username input field in dialog
9. `/ADD_MODEL_URL_COLUMN.sql` - Database migration for model_url
10. `/ADD_SECRETS_METADATA_COLUMN.sql` - Database migration for secrets metadata

## Testing Checklist

- [ ] HuggingFace token properly retrieved from secrets vault
- [ ] HF_TOKEN and HF_REPO_NAME passed to RunPod pod
- [ ] Model uploads to HuggingFace after training completes
- [ ] model_url stored in local_training_jobs table
- [ ] UI displays HF repo name in review step

## Notes

- HF upload is optional - if no token/repo configured, upload is skipped
- Creates repo automatically if it doesn't exist
- Model URL format: `https://huggingface.co/{username}/{repo-name}`
