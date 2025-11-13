# Deployment Visibility Fix - Implementation Guide

**Date**: November 3, 2025  
**Issue**: Deployed models not appearing in UI after training completes  
**Root Cause**: Missing `metadata` column in `llm_models` table  
**Status**: ✅ Files Created - Ready to Apply

---

## 📋 Summary of Changes

### 1. Database Migration
**File**: `supabase/migrations/20251103000003_add_metadata_to_llm_models.sql`
- ✅ Created
- Adds `metadata` JSONB column to `llm_models` table
- Includes indexes for efficient querying
- Has verification checks

### 2. TypeScript Types
**File**: `lib/models/llm-model.types.ts`
- ✅ Updated
- Added `metadata: Record<string, any> | null` field to `LLMModel` interface
- Aligns TypeScript with database schema

### 3. Documentation
**Files**: 
- `DEPLOYMENT_VISIBILITY_FIX.md` - Root cause analysis
- `DEPLOYMENT_FIX_IMPLEMENTATION.md` - This file

---

## 🚀 Implementation Steps

### Step 1: Apply Database Migration

1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Copy contents of `supabase/migrations/20251103000003_add_metadata_to_llm_models.sql`
4. Execute the SQL
5. Verify success message: `✓ Column metadata successfully added to llm_models table`

**Alternative (if using Supabase CLI)**:
```bash
cd c:\Users\Juan\Desktop\Dev_Ops\web-ui
supabase db push
```

### Step 2: Verify Migration

Run this query in Supabase SQL Editor:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'llm_models' 
AND column_name = 'metadata';
```

**Expected Result**:
```
column_name | data_type | is_nullable | column_default
------------|-----------|-------------|----------------
metadata    | jsonb     | YES         | '{}'::jsonb
```

### Step 3: Verify TypeScript Compilation

```powershell
cd c:\Users\Juan\Desktop\Dev_Ops\web-ui
npm run type-check
```

**Expected**: No new TypeScript errors related to `metadata` field

### Step 4: Test Deployment End-to-End

1. **Start a training job**:
   - Navigate to `/training`
   - Select a model (e.g., Qwen/Qwen3-0.6B)
   - Upload or select a dataset
   - Configure training settings
   - Click "Start Training"

2. **Monitor training**:
   - Wait for training to complete
   - Check status shows `completed`

3. **Deploy the model**:
   - Click "Deploy to vLLM" button
   - Fill in deployment dialog
   - Click "Deploy Model"

4. **Verify deployment**:
   - Check browser console for: `[DeployAPI] Model entry created: {model_id}`
   - Should redirect to `/models?modelId={model_id}`
   - Deployed model should appear highlighted in models list

### Step 5: Verify Database Entry

Run this query to confirm metadata is populated:

```sql
SELECT 
  id,
  name,
  provider,
  user_id,
  enabled,
  is_global,
  metadata->>'training_job_id' as training_job_id,
  metadata->>'server_id' as server_id,
  metadata->>'deployed_at' as deployed_at,
  metadata->>'model_path' as model_path,
  metadata->>'checkpoint_path' as checkpoint_path,
  created_at
FROM llm_models 
WHERE provider IN ('vllm', 'ollama')
ORDER BY created_at DESC 
LIMIT 5;
```

**Expected**: See your deployed model with populated metadata fields

---

## ✅ Verification Checklist

Before marking as complete, verify:

- [ ] Migration file created in correct location
- [ ] Migration applied to Supabase database
- [ ] `metadata` column exists in `llm_models` table
- [ ] Indexes created on metadata fields
- [ ] TypeScript type updated with `metadata` field
- [ ] No TypeScript compilation errors
- [ ] End-to-end deployment test completed successfully
- [ ] Deployed model visible in `/models` page
- [ ] Model entry exists in database with metadata
- [ ] Metadata fields populated correctly
- [ ] Model can be selected in chat interface
- [ ] Inference works with deployed model

---

## 🧪 Test Cases

### Test Case 1: vLLM Deployment
1. Complete training job
2. Deploy to vLLM
3. Verify model appears in UI
4. Check metadata contains:
   - `training_job_id`
   - `server_id`
   - `deployed_at`
   - `model_path`
   - `checkpoint_path`

### Test Case 2: Ollama Deployment
1. Complete training job
2. Deploy to Ollama
3. Verify model appears in UI
4. Check metadata populated

### Test Case 3: Model Visibility
1. Navigate to `/models` page
2. Filter by provider: "vllm"
3. Verify deployed vLLM models appear
4. Filter by ownership: "My Models Only"
5. Verify only user's models appear

### Test Case 4: Model Usage
1. Select deployed model in chat
2. Send test message
3. Verify response received
4. Check model works correctly

---

## 🐛 Troubleshooting

### Issue: Migration fails with "column already exists"
**Cause**: Migration already partially applied  
**Solution**: Migration uses `ADD COLUMN IF NOT EXISTS` - safe to re-run

### Issue: TypeScript errors after update
**Cause**: Cached build files  
**Solution**: 
```powershell
npm run clean
npm run build
```

### Issue: Model still doesn't appear after deployment
**Possible Causes**:
1. Check browser console for errors
2. Verify user is authenticated
3. Check database entry exists
4. Verify `enabled = true` and `is_global = false`
5. Check RLS policies allow user to see their models

**Debug Query**:
```sql
-- Check if model was created
SELECT * FROM llm_models 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC 
LIMIT 5;

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'llm_models';
```

### Issue: Deployment succeeds but no model in DB
**Cause**: INSERT failing silently  
**Solution**: Check server logs for detailed error:
```powershell
# Check Next.js logs
npm run dev
# Look for: [DeployAPI] Failed to create model entry:
```

---

## 📊 Monitoring

After fix is deployed, monitor:

1. **Deployment Success Rate**:
```sql
SELECT 
  COUNT(*) as total_deployments,
  COUNT(*) FILTER (WHERE metadata IS NOT NULL) as successful,
  COUNT(*) FILTER (WHERE metadata IS NULL) as failed
FROM llm_models
WHERE provider IN ('vllm', 'ollama')
AND created_at > NOW() - INTERVAL '7 days';
```

2. **Recent Deployments**:
```sql
SELECT 
  name,
  provider,
  metadata->>'deployed_at' as deployed_at,
  created_at
FROM llm_models
WHERE metadata IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📝 Notes

1. **Backward Compatibility**: Existing models will have `metadata = {}` (empty object)
2. **Optional Field**: `metadata` is nullable - old code won't break
3. **Index Performance**: Indexes on JSONB fields use `->>'key'` syntax for efficiency
4. **RLS Policies**: No changes needed - existing policies cover new column
5. **Migration Safety**: Uses `IF NOT EXISTS` - safe to run multiple times

---

## 🔄 Rollback Plan

If issues occur, rollback with:

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_llm_models_metadata_training_job;
DROP INDEX IF EXISTS idx_llm_models_metadata_server;

-- Remove column
ALTER TABLE llm_models DROP COLUMN IF EXISTS metadata;

-- Verify
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'llm_models' AND column_name = 'metadata';
-- Should return 0 rows
```

Then revert TypeScript changes:
```typescript
// Remove this line from LLMModel interface:
// metadata: Record<string, any> | null;
```

---

## ✨ Future Enhancements

1. **Metadata Validation**: Add CHECK constraint for required fields
2. **Migration Automation**: Add to CI/CD pipeline
3. **Deployment Dashboard**: Show deployment history from metadata
4. **Cost Tracking**: Add cost fields to metadata
5. **Performance Metrics**: Track inference metrics in metadata

---

## 📞 Support

If issues persist after applying fixes:

1. Check all verification steps completed
2. Review troubleshooting section
3. Check server logs for detailed errors
4. Verify database connection working
5. Test with fresh training job
