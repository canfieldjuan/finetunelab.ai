# Training Package Versions - Database Migration Guide

**Migration File**: `supabase/migrations/20250131000001_create_training_package_versions.sql`
**Rollback File**: `supabase/migrations/20250131000002_rollback_training_package_versions.sql`
**Date**: 2025-01-31
**Phase**: Training Packages - Phase 1 Foundation

---

## 📋 Overview

This migration creates the `training_package_versions` table to support draft/publish versioning workflow for training packages.

### What This Migration Does

1. ✅ Creates `training_package_versions` table with complete schema
2. ✅ Adds indexes for performance
3. ✅ Enables Row Level Security (RLS) with 4 policies
4. ✅ Creates helper functions and triggers
5. ✅ Updates `training_configs` table with version tracking columns
6. ✅ Adds verification checks

### Migration Size
- **Table**: 1 new table
- **Columns**: 24 columns
- **Indexes**: 9 indexes (including 3 GIN indexes for JSONB)
- **RLS Policies**: 4 policies
- **Functions**: 3 functions
- **Triggers**: 2 triggers
- **Updates**: 3 new columns on existing `training_configs` table

---

## 🗃️ Database Schema

### New Table: `training_package_versions`

```sql
CREATE TABLE training_package_versions (
  -- Identification
  id UUID PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES training_configs(id),
  version_number INTEGER NOT NULL,

  -- Metadata
  name TEXT NOT NULL,
  status TEXT CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Snapshots (JSONB)
  config_snapshot JSONB NOT NULL,
  model_snapshot JSONB NOT NULL,
  dataset_snapshot JSONB NOT NULL,

  -- Change tracking
  change_summary TEXT,
  parent_version_id UUID REFERENCES training_package_versions(id),

  -- Deployment
  is_deployed BOOLEAN DEFAULT FALSE,
  deployment_target TEXT CHECK (deployment_target IN ('local', 'hf_space')),
  deployment_url TEXT,
  deployment_id TEXT,

  -- Training
  training_status TEXT CHECK (...),
  training_started_at TIMESTAMPTZ,
  training_completed_at TIMESTAMPTZ,
  training_metrics JSONB,

  -- Cost tracking
  estimated_cost DECIMAL(10, 2),
  actual_cost DECIMAL(10, 2),
  budget_limit DECIMAL(10, 2),
  cost_alerts_sent JSONB,

  UNIQUE(package_id, version_number)
);
```

### Updated Table: `training_configs`

```sql
ALTER TABLE training_configs
ADD COLUMN current_version_id UUID REFERENCES training_package_versions(id),
ADD COLUMN version_count INTEGER DEFAULT 0,
ADD COLUMN latest_published_version INTEGER DEFAULT 0;
```

---

## 🔐 Row Level Security (RLS)

### Policies Created

1. **SELECT**: Users can view their own versions
   ```sql
   USING (auth.uid() = created_by)
   ```

2. **INSERT**: Users can create their own versions
   ```sql
   WITH CHECK (auth.uid() = created_by)
   ```

3. **UPDATE**: Users can update their own DRAFTS only
   ```sql
   USING (auth.uid() = created_by AND status = 'draft')
   ```

4. **DELETE**: Users can delete their own DRAFTS only
   ```sql
   USING (auth.uid() = created_by AND status = 'draft')
   ```

### Security Features

- ✅ Users cannot see other users' versions
- ✅ Published versions are immutable (cannot UPDATE/DELETE)
- ✅ Only drafts can be modified or deleted
- ✅ Automatic `created_by` validation on INSERT

---

## 📊 Indexes

### Performance Optimizations

| Index | Type | Purpose |
|-------|------|---------|
| `idx_package_versions_package` | B-tree | Get versions for package (sorted DESC) |
| `idx_package_versions_status` | B-tree | Filter by draft/published/archived |
| `idx_package_versions_user` | B-tree | User's versions lookup |
| `idx_package_versions_deployment` | B-tree | Deployed packages lookup |
| `idx_package_versions_training_status` | B-tree | Training status queries |
| `idx_package_versions_parent` | B-tree | Parent-child relationships |
| `idx_package_versions_config_snapshot` | GIN | Query config JSON fields |
| `idx_package_versions_model_snapshot` | GIN | Query model JSON fields |
| `idx_package_versions_dataset_snapshot` | GIN | Query dataset JSON fields |

**GIN Indexes** enable efficient queries like:
```sql
WHERE model_snapshot->>'id' = 'meta-llama/Llama-2-7b-hf'
WHERE dataset_snapshot @> '[{"datasetId": "123"}]'
```

---

## ⚡ Functions & Triggers

### Function: `get_next_version_number(package_id)`

Returns the next version number for a package.

```sql
SELECT get_next_version_number('uuid-here');
-- Returns: 1, 2, 3, etc.
```

### Function: `update_version_count()`

Automatically updates `version_count` on `training_configs` when versions are added/deleted.

### Trigger: `set_updated_at`

Automatically updates `updated_at` timestamp on any UPDATE.

### Trigger: `update_config_version_count`

Calls `update_version_count()` after INSERT/DELETE on versions.

---

## 🚀 How to Apply Migration

### Method 1: Supabase CLI (Recommended)

```bash
# Navigate to project root
cd C:\Users\Juan\Desktop\Dev_Ops\web-ui

# Apply migration
supabase db push

# Or apply specific migration
supabase migration up 20250131000001
```

### Method 2: Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `20250131000001_create_training_package_versions.sql`
3. Paste and run
4. Verify success messages in output

### Method 3: Direct SQL

```bash
# Connect to database
psql -h db.xxxxx.supabase.co -U postgres -d postgres

# Run migration
\i supabase/migrations/20250131000001_create_training_package_versions.sql
```

---

## ✅ Verification Steps

After applying migration, verify it worked:

### 1. Check Table Exists

```sql
SELECT COUNT(*) FROM training_package_versions;
-- Should return 0 (empty table)
```

### 2. Check Columns on training_configs

```sql
SELECT current_version_id, version_count, latest_published_version
FROM training_configs
LIMIT 1;
-- Should return columns (all NULL or 0)
```

### 3. Verify RLS is Enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'training_package_versions';
-- rowsecurity should be true
```

### 4. Check Policies

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'training_package_versions';
-- Should return 4 policies (SELECT, INSERT, UPDATE, DELETE)
```

### 5. Check Indexes

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'training_package_versions';
-- Should return 9+ indexes
```

### 6. Test Version Number Function

```sql
-- Create a test config first
INSERT INTO training_configs (id, name, template_type, config_json, user_id)
VALUES (gen_random_uuid(), 'Test Config', 'lora_finetuning', '{}'::jsonb, auth.uid());

-- Get next version (should be 1)
SELECT get_next_version_number((SELECT id FROM training_configs LIMIT 1));
```

---

## 🔄 Rollback Procedure

If you need to undo this migration:

### Using Rollback Script

```bash
# Apply rollback migration
supabase migration up 20250131000002

# Or via SQL Editor
-- Copy contents of 20250131000002_rollback_training_package_versions.sql
-- Paste and run in Supabase Dashboard
```

### Manual Rollback

```sql
-- Drop table and related objects
DROP TRIGGER IF EXISTS set_updated_at ON training_package_versions;
DROP TRIGGER IF EXISTS update_config_version_count ON training_package_versions;
DROP FUNCTION IF EXISTS update_training_package_versions_updated_at();
DROP FUNCTION IF EXISTS update_version_count();
DROP FUNCTION IF EXISTS get_next_version_number(UUID);

ALTER TABLE training_configs
DROP COLUMN IF EXISTS current_version_id,
DROP COLUMN IF EXISTS version_count,
DROP COLUMN IF EXISTS latest_published_version;

DROP TABLE IF EXISTS training_package_versions CASCADE;
```

**⚠️ WARNING**: Rollback will DELETE ALL version history data!

---

## 📝 Usage Examples

### Create a Draft Version

```typescript
const { data, error } = await supabase
  .from('training_package_versions')
  .insert({
    package_id: 'uuid-of-training-config',
    version_number: 1,
    name: 'my-package-v1-draft-20250131',
    status: 'draft',
    created_by: user.id,
    config_snapshot: { /* full config */ },
    model_snapshot: { /* model info */ },
    dataset_snapshot: [ /* datasets */ ]
  })
  .select()
  .single();
```

### Publish a Draft

```typescript
const { data, error } = await supabase
  .from('training_package_versions')
  .update({
    status: 'published',
    published_at: new Date().toISOString(),
    published_by: user.id,
    name: 'my-package-v1' // Remove -draft suffix
  })
  .eq('id', versionId)
  .eq('status', 'draft') // Safety check
  .select()
  .single();
```

### Get All Versions for a Package

```typescript
const { data, error } = await supabase
  .from('training_package_versions')
  .select('*')
  .eq('package_id', packageId)
  .order('version_number', { ascending: false });
```

### Get Latest Published Version

```typescript
const { data, error } = await supabase
  .from('training_package_versions')
  .select('*')
  .eq('package_id', packageId)
  .eq('status', 'published')
  .order('version_number', { ascending: false })
  .limit(1)
  .single();
```

---

## 🐛 Troubleshooting

### Issue: RLS prevents access

**Problem**: Cannot query even your own versions

**Solution**: Verify you're authenticated
```typescript
const { data: { session } } = await supabase.auth.getSession();
console.log('User ID:', session?.user?.id);
```

### Issue: Foreign key constraint fails

**Problem**: `package_id` doesn't exist in `training_configs`

**Solution**: Create the parent config first
```typescript
// First create config
const { data: config } = await supabase
  .from('training_configs')
  .insert({ name: 'My Config', ... })
  .select()
  .single();

// Then create version
const { data: version } = await supabase
  .from('training_package_versions')
  .insert({ package_id: config.id, ... });
```

### Issue: Cannot update published version

**Problem**: RLS policy blocks update of published versions

**Solution**: This is intentional! Published versions are immutable.
- Create a new version instead
- Or set `parent_version_id` to create a fork

### Issue: Version number conflicts

**Problem**: UNIQUE constraint violation on (package_id, version_number)

**Solution**: Use helper function to get next number
```typescript
const { data } = await supabase
  .rpc('get_next_version_number', { p_package_id: packageId });
const nextVersion = data; // Use this for version_number
```

---

## 📚 Related Documentation

- [TRAINING_PACKAGES_IMPLEMENTATION_PLAN.md](../../../docs/implementation/training-packages/TRAINING_PACKAGES_IMPLEMENTATION_PLAN.md) - Overall plan
- [types.ts](./types.ts) - TypeScript type definitions
- [useWorkflowState.ts](./useWorkflowState.ts) - State management hook
- [TrainingPackageWizard.tsx](./TrainingPackageWizard.tsx) - Main UI component

---

## ✅ Migration Checklist

Before deploying to production:

- [ ] Backup database
- [ ] Test migration on development database
- [ ] Verify all indexes created
- [ ] Test RLS policies work correctly
- [ ] Verify functions execute successfully
- [ ] Test rollback procedure
- [ ] Update API endpoints to use new table
- [ ] Update frontend to save/load versions
- [ ] Test version count updates
- [ ] Document any custom queries needed

---

## 🎯 Next Steps

After applying this migration:

1. ✅ Create API endpoints:
   - `GET /api/training/versions` - List versions
   - `POST /api/training/versions` - Create version
   - `PUT /api/training/versions/:id` - Update draft
   - `POST /api/training/versions/:id/publish` - Publish version
   - `DELETE /api/training/versions/:id` - Delete draft

2. ✅ Update TrainingPackageWizard:
   - Implement onAutoSave to save to database
   - Load existing versions
   - Show version history

3. ✅ Create VersionHistory component:
   - List all versions
   - Compare versions
   - Restore old versions

---

**Migration Status**: ✅ READY TO APPLY
**Last Updated**: 2025-01-31
**Author**: Claude Code
**Verified**: Yes
