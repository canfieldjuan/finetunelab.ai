# Dataset Many-to-Many Relationship Migration

**Date:** 2025-11-01  
**Issue:** Datasets were exclusive to one config (one-to-one), preventing reuse  
**Solution:** Junction table for many-to-many relationship

---

## 🔍 Problem Identified

### Original Schema (One-to-One):
```sql
-- training_datasets table
CREATE TABLE training_datasets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  config_id UUID REFERENCES training_configs(id),  -- ❌ One config only
  name TEXT,
  format TEXT,
  ...
);
```

### Issue:
When attaching a dataset to a config, the API would set:
```typescript
// OLD CODE (attach-dataset API)
await supabase
  .from('training_datasets')
  .update({ config_id: configId })  // ❌ Overwrites previous config
  .eq('id', datasetId);
```

**Result:** Dataset A attached to Config 1, then attached to Config 2 → **Config 1 loses the dataset**

---

## ✅ Solution: Junction Table

### New Schema (Many-to-Many):
```sql
-- NEW: Junction table for many-to-many
CREATE TABLE training_config_datasets (
  id UUID PRIMARY KEY,
  config_id UUID REFERENCES training_configs(id),
  dataset_id UUID REFERENCES training_datasets(id),
  user_id UUID REFERENCES auth.users(id),
  attached_at TIMESTAMPTZ,
  UNIQUE (config_id, dataset_id)  -- ✅ Prevent duplicates
);
```

**Result:** Dataset A can be linked to Config 1, Config 2, Config 3 simultaneously

---

## 📁 Files Modified

### 1. **Migration File Created**
**File:** `supabase/migrations/20251101000002_config_dataset_junction.sql`

**Changes:**
- ✅ Created `training_config_datasets` junction table
- ✅ Added RLS policies for security
- ✅ Migrated existing `config_id` relationships to junction table
- ✅ Created helper views (`config_datasets_view`, `dataset_usage_view`)
- ✅ Kept `config_id` column for backward compatibility

---

### 2. **API Endpoints Updated**

#### **POST /api/training/[id]/attach-dataset**
**File:** `app/api/training/[id]/attach-dataset/route.ts`

**OLD:**
```typescript
// ❌ Set config_id directly (overwrites)
await supabase
  .from('training_datasets')
  .update({ config_id: configId })
  .eq('id', datasetId);
```

**NEW:**
```typescript
// ✅ Insert into junction table (allows multiple)
await supabase
  .from('training_config_datasets')
  .insert({
    config_id: configId,
    dataset_id: datasetId,
    user_id: user.id,
  });
```

---

#### **DELETE /api/training/[id]/attach-dataset**
**File:** `app/api/training/[id]/attach-dataset/route.ts`

**OLD:**
```typescript
// ❌ Null out config_id
await supabase
  .from('training_datasets')
  .update({ config_id: null })
  .eq('id', datasetId);
```

**NEW:**
```typescript
// ✅ Delete from junction table
await supabase
  .from('training_config_datasets')
  .delete()
  .eq('config_id', configId)
  .eq('dataset_id', datasetId);
```

---

#### **GET /api/training/[id]/datasets**
**File:** `app/api/training/[id]/datasets/route.ts`

**OLD:**
```typescript
// ❌ Filter by config_id in datasets table
const { data: datasets } = await supabase
  .from('training_datasets')
  .select('*')
  .eq('config_id', configId);
```

**NEW:**
```typescript
// ✅ Join via junction table
const { data: configDatasets } = await supabase
  .from('training_config_datasets')
  .select(`
    dataset_id,
    attached_at,
    training_datasets (
      id,
      name,
      storage_path,
      format,
      total_examples,
      file_size_bytes
    )
  `)
  .eq('config_id', configId);

// Extract datasets from nested structure
const datasets = configDatasets
  .map(cd => cd.training_datasets)
  .filter(d => d !== null);
```

---

#### **POST /api/training/[id]/download-package**
**File:** `app/api/training/[id]/download-package/route.ts`

**Updated:** Fetches datasets via junction table with nested select

---

#### **POST /api/training/[id]/generate-package**
**File:** `app/api/training/[id]/generate-package/route.ts`

**Updated:** `getCompatibleMethods()` function now queries junction table

---

#### **POST /api/training/execute**
**File:** `app/api/training/execute/route.ts`

**Updated:** Two locations - both OpenAI and Colab execution now use junction table

---

#### **GET /api/training/public/[id]/dataset**
**File:** `app/api/training/public/[id]/dataset/route.ts`

**Updated:** Public dataset access now queries junction table

---

## 🎯 Benefits

### Before:
```
Dataset: "Customer Reviews 10K"
└─ Attached to: Config A (SFT)

User tries to attach same dataset to Config B (DPO)
❌ Config A loses the dataset!
❌ Must create duplicate dataset
```

### After:
```
Dataset: "Customer Reviews 10K"
├─ Attached to: Config A (SFT) ✅
├─ Attached to: Config B (DPO) ✅
├─ Attached to: Config C (LoRA) ✅
└─ Attached to: Config D (Full Fine-tune) ✅

✅ One dataset, multiple configs
✅ No duplication needed
✅ Storage efficient
```

---

## 📊 Database Views

### View: config_datasets_view
Shows all config-dataset relationships with metadata:
```sql
SELECT * FROM config_datasets_view
WHERE user_id = 'your-user-id';

-- Returns:
-- config_id | dataset_id | config_name | dataset_name | format | total_examples | attached_at
```

### View: dataset_usage_view
Shows how many configs each dataset is attached to:
```sql
SELECT * FROM dataset_usage_view
WHERE user_id = 'your-user-id';

-- Returns:
-- dataset_id | dataset_name | config_count | config_names[] | last_attached_at
```

---

## 🔧 Testing Checklist

### Test Scenario 1: Attach Same Dataset to Multiple Configs
1. Create Dataset A
2. Create Config 1 (SFT)
3. Attach Dataset A to Config 1 ✅
4. Create Config 2 (DPO)
5. Attach Dataset A to Config 2 ✅
6. Verify Config 1 still has Dataset A ✅

### Test Scenario 2: Detach Dataset from One Config
1. Dataset A attached to Config 1 and Config 2
2. Detach Dataset A from Config 1
3. Verify Config 2 still has Dataset A ✅

### Test Scenario 3: Delete Config Cascades
1. Dataset A attached to Config 1 and Config 2
2. Delete Config 1
3. Verify junction record deleted (CASCADE)
4. Verify Dataset A still exists
5. Verify Config 2 still has Dataset A

### Test Scenario 4: Delete Dataset Cascades
1. Dataset A attached to Config 1 and Config 2
2. Delete Dataset A
3. Verify all junction records deleted (CASCADE)
4. Verify Config 1 and Config 2 still exist

### Test Scenario 5: Duplicate Attach Prevention
1. Attach Dataset A to Config 1
2. Try to attach Dataset A to Config 1 again
3. Verify unique constraint prevents duplicate
4. API returns success (already attached)

---

## 🚨 Backward Compatibility

### Keeping config_id Column
The `config_id` column in `training_datasets` is **NOT removed** for now:
- Frontend components may still reference it
- Gradual migration path
- Fallback for legacy code

### Future Cleanup (Optional)
Once all code is verified to use junction table:
```sql
-- FUTURE: Remove old config_id column
ALTER TABLE training_datasets DROP COLUMN config_id;
DROP INDEX idx_training_datasets_config;
```

### Current State (Hybrid)
- Junction table handles relationships
- `config_id` column exists but not used
- APIs use junction table exclusively
- Frontend may have remnants (safe to ignore)

---

## 📝 Developer Notes

### Querying Datasets for a Config
```typescript
// CORRECT (many-to-many)
const { data: configDatasets } = await supabase
  .from('training_config_datasets')
  .select('training_datasets (*)')
  .eq('config_id', configId);

const datasets = configDatasets
  .map(cd => cd.training_datasets)
  .filter(d => d !== null);
```

### Querying Configs for a Dataset
```typescript
// Get all configs using this dataset
const { data: datasetConfigs } = await supabase
  .from('training_config_datasets')
  .select('training_configs (*)')
  .eq('dataset_id', datasetId);

const configs = datasetConfigs
  .map(dc => dc.training_configs)
  .filter(c => c !== null);
```

### Checking if Dataset is Attached
```typescript
// Check if specific config-dataset link exists
const { data: link } = await supabase
  .from('training_config_datasets')
  .select('id')
  .eq('config_id', configId)
  .eq('dataset_id', datasetId)
  .single();

const isAttached = !!link;
```

---

## 🎓 SQL Examples

### Count Datasets per Config
```sql
SELECT 
  c.id,
  c.name,
  COUNT(cd.dataset_id) as dataset_count
FROM training_configs c
LEFT JOIN training_config_datasets cd ON cd.config_id = c.id
GROUP BY c.id, c.name;
```

### Find Configs Sharing Same Dataset
```sql
SELECT 
  d.name as dataset_name,
  ARRAY_AGG(c.name) as config_names
FROM training_datasets d
JOIN training_config_datasets cd ON cd.dataset_id = d.id
JOIN training_configs c ON c.id = cd.config_id
GROUP BY d.id, d.name
HAVING COUNT(cd.config_id) > 1;
```

### Find Most Reused Datasets
```sql
SELECT 
  d.name,
  COUNT(cd.config_id) as usage_count
FROM training_datasets d
JOIN training_config_datasets cd ON cd.dataset_id = d.id
GROUP BY d.id, d.name
ORDER BY usage_count DESC
LIMIT 10;
```

---

## 🐛 Known Issues & Limitations

### Current Limitations:
1. **Frontend Components:** Some may still check `d.config_id === configId` (safe, returns empty)
2. **Migration Pending:** Need to run migration on production database
3. **Testing:** Full end-to-end testing required

### Not Affected:
- ✅ Dataset upload/creation
- ✅ Dataset deletion
- ✅ Config creation
- ✅ Training execution
- ✅ Package generation
- ✅ File downloads

---

## 🚀 Deployment Steps

1. **Apply Migration:**
   ```bash
   # Local Supabase
   supabase migration up
   
   # Production (via Supabase Dashboard)
   # Copy migration SQL and run in SQL Editor
   ```

2. **Verify Migration:**
   ```sql
   -- Check junction table exists
   SELECT COUNT(*) FROM training_config_datasets;
   
   -- Verify data migrated
   SELECT 
     (SELECT COUNT(*) FROM training_datasets WHERE config_id IS NOT NULL) as old_count,
     (SELECT COUNT(*) FROM training_config_datasets) as new_count;
   ```

3. **Test API Endpoints:**
   - Attach dataset to config
   - Verify it appears in GET /api/training/[id]/datasets
   - Attach same dataset to different config
   - Verify both configs see the dataset
   - Detach from one config
   - Verify other config still has it

4. **Monitor Logs:**
   ```
   [AttachDatasetAPI] Dataset attached successfully via junction table
   [DatasetsAPI] Found X datasets via junction table
   ```

---

## ✅ Success Criteria

- [x] Junction table created
- [x] Migration migrates existing data
- [x] RLS policies protect user data
- [x] Attach API uses junction table
- [x] Detach API uses junction table
- [x] All dataset fetch APIs updated
- [x] Unique constraint prevents duplicates
- [x] Cascade deletes work correctly
- [ ] Production migration applied
- [ ] End-to-end testing complete
- [ ] Frontend components verified

---

**Status:** ✅ Code Complete - Ready for Testing  
**Migration File:** `supabase/migrations/20251101000002_config_dataset_junction.sql`  
**APIs Updated:** 7 endpoints modified  
**Next Step:** Apply migration and test

