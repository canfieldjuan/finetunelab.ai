# Deployment Visibility Issue - Root Cause Analysis

**Date**: November 3, 2025  
**Status**: ✅ Issue Identified - Ready for Fix  
**Severity**: CRITICAL - Blocks all model deployments

---

## 🔍 Root Cause

The deployment API (`/api/training/deploy/route.ts`) attempts to INSERT a `metadata` column into the `llm_models` table, but **this column does not exist** in the database schema.

### Evidence

1. **Code trying to insert metadata** (`app/api/training/deploy/route.ts:278`):
```typescript
const { data: modelEntry, error: modelError } = await supabase
  .from('llm_models')
  .insert({
    user_id: userId,
    provider: server_type,
    name: modelName,
    // ... other columns ...
    metadata: {                    // ❌ COLUMN DOES NOT EXIST
      training_job_id: job_id,
      server_id: serverInfo.serverId,
      deployed_at: new Date().toISOString(),
      model_path: modelPath,
      display_name: modelName,
      checkpoint_path: checkpoint_path,
    },
  })
```

2. **TypeScript type definition** (`lib/models/llm-model.types.ts`):
   - NO `metadata` field in `LLMModel` interface
   - Only has: `training_method`, `base_model`, `training_dataset`, `training_date`, `lora_config`, `evaluation_metrics`

3. **Database schema** (`docs/schema_updates/10_llm_models_registry.sql`):
   - NO `metadata` column defined
   - Has individual columns instead

4. **Migration file exists but not in migrations folder**:
   - File: `add_metadata_column.sql` (in root directory)
   - NOT in `supabase/migrations/` folder
   - Has NOT been applied to database

---

## 🐛 What Happens

1. User completes training
2. User clicks "Deploy to vLLM" or "Deploy to Ollama"
3. Deployment API creates inference server ✅
4. Deployment API tries to INSERT model entry with `metadata` column ❌
5. **PostgreSQL rejects the INSERT** (unknown column error)
6. Model entry is NOT created in `llm_models` table
7. User is redirected to `/models` page
8. **Model does not appear** because it was never inserted

---

## ✅ Required Fixes

### Fix 1: Add metadata column to database

**Create migration file**: `supabase/migrations/20251103000003_add_metadata_to_llm_models.sql`

```sql
-- Add metadata column to llm_models table for deployment tracking
-- Date: 2025-11-03

ALTER TABLE llm_models 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN llm_models.metadata IS 
'Stores deployment metadata including training_job_id, server_id, deployed_at, model_path, checkpoint_path';

-- Create index for metadata queries
CREATE INDEX IF NOT EXISTS idx_llm_models_metadata_training_job
ON llm_models((metadata->>'training_job_id'))
WHERE metadata->>'training_job_id' IS NOT NULL;

-- Verification
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'llm_models' AND column_name = 'metadata';
```

### Fix 2: Update TypeScript types

**File**: `lib/models/llm-model.types.ts`

Add `metadata` field to `LLMModel` interface:

```typescript
export interface LLMModel {
  id: string;
  user_id: string | null;
  
  // ... existing fields ...
  
  // Training Metadata (optional - for custom trained models)
  training_method: string | null;
  base_model: string | null;
  training_dataset: string | null;
  training_date: string | null;
  lora_config: Record<string, any> | null;
  evaluation_metrics: Record<string, any> | null;
  
  // Deployment Metadata (for vLLM/Ollama deployments)
  metadata: Record<string, any> | null;  // ✅ ADD THIS
  
  // Audit
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}
```

### Fix 3: Verify deployment API error handling

**File**: `app/api/training/deploy/route.ts`

The error handling at line 292 already handles this case, but logs should be checked:

```typescript
if (modelError) {
  console.error('[DeployAPI] Failed to create model entry:', modelError);
  // ✅ Already returns partial success
  return NextResponse.json({
    success: true,
    server_id: serverInfo.serverId,
    // ... 
    warning: 'Server started but failed to create model entry',
    error: modelError.message,  // ✅ This will show "column metadata does not exist"
  });
}
```

---

## 🧪 Verification Steps

After applying fixes:

1. **Check migration applied**:
```sql
SELECT * FROM information_schema.columns 
WHERE table_name = 'llm_models' AND column_name = 'metadata';
```

2. **Test deployment**:
   - Complete a training job
   - Click "Deploy to vLLM"
   - Check browser console for: `[DeployAPI] Model entry created: {model_id}`
   - Navigate to `/models` page
   - Verify deployed model appears in list

3. **Check database**:
```sql
SELECT id, name, provider, metadata 
FROM llm_models 
WHERE provider IN ('vllm', 'ollama')
ORDER BY created_at DESC 
LIMIT 5;
```

4. **Verify metadata structure**:
```sql
SELECT 
  id,
  name,
  metadata->>'training_job_id' as job_id,
  metadata->>'server_id' as server_id,
  metadata->>'deployed_at' as deployed_at
FROM llm_models 
WHERE metadata IS NOT NULL;
```

---

## 🎯 Impact

**Before Fix**:
- ❌ Deployed models never appear in UI
- ❌ Deployments appear successful but fail silently
- ❌ No way to track deployment metadata
- ❌ Server starts but no model entry created

**After Fix**:
- ✅ Deployed models appear in `/models` page
- ✅ Deployment metadata tracked properly
- ✅ Can query by training_job_id
- ✅ Full deployment history preserved

---

## 📋 Checklist

- [ ] Create migration file in `supabase/migrations/`
- [ ] Apply migration to Supabase database
- [ ] Update TypeScript types
- [ ] Verify TypeScript compiles without errors
- [ ] Test deployment end-to-end
- [ ] Verify model appears in UI
- [ ] Check database has metadata column
- [ ] Verify metadata is populated correctly

---

## 🔗 Related Files

- `app/api/training/deploy/route.ts` - Deployment API
- `lib/models/llm-model.types.ts` - TypeScript types
- `lib/models/model-manager.service.ts` - Model CRUD operations
- `app/models/page.tsx` - Models list UI
- `components/training/DeployModelButton.tsx` - Deploy button
- `add_metadata_column.sql` - Original migration (not in migrations folder)

---

## 💡 Additional Observations

1. **RLS Policies**: Already correct - SELECT policy includes user models
2. **Authentication**: Working correctly - session token passed
3. **Query Logic**: Correct - includes user_id OR is_global
4. **Redirect Logic**: Correct - redirects to `/models?modelId={id}`

The ONLY issue is the missing `metadata` column causing the INSERT to fail.
