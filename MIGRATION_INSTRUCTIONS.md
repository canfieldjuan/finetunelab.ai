# 🚀 Apply Database Migration - Step by Step

**Error**: `relation "training_package_versions" does not exist`
**Solution**: Apply the migration to your Supabase database

---

## ✅ Quick Fix (5 minutes)

### Step 1: Open Supabase Dashboard

1. Go to https://app.supabase.com
2. Select your project
3. Click **"SQL Editor"** in the left sidebar

### Step 2: Run the Migration

1. Click **"New Query"** button (top right)
2. Open the file: `APPLY_MIGRATION_NOW.sql`
3. Copy the ENTIRE contents
4. Paste into the SQL Editor
5. Click **"Run"** button (or press `Ctrl+Enter`)

### Step 3: Verify Success

You should see output like this:
```
✅ Table training_package_versions created successfully
✅ RLS enabled on training_package_versions
✅ RLS policies created (4 policies)
✅ Indexes created (9 indexes)
✅ training_configs updated with version tracking columns
================================================================
✅ MIGRATION COMPLETE!
================================================================
```

---

## 📋 What This Migration Does

Creates the `training_package_versions` table with:
- ✅ 24 columns for version tracking
- ✅ 9 indexes for performance
- ✅ 4 RLS policies for security
- ✅ 3 helper functions
- ✅ 2 triggers for automation
- ✅ Updates to `training_configs` table

---

## 🔍 Verify It Worked

After running the migration, test it:

```sql
-- Should return 0 (empty table)
SELECT COUNT(*) FROM training_package_versions;

-- Should show the table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'training_package_versions'
ORDER BY ordinal_position;
```

---

## 🐛 Troubleshooting

### Issue: "permission denied for table training_configs"

**Solution**: Make sure you're the owner of the database or have proper permissions.

Run this in SQL Editor:
```sql
GRANT ALL ON training_configs TO postgres;
```

### Issue: "function gen_random_uuid() does not exist"

**Solution**: Enable the UUID extension.

Run this first:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- OR
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

Then re-run the migration.

### Issue: "relation auth.users does not exist"

**Solution**: This shouldn't happen in Supabase, but if it does:

Remove the foreign key references to `auth.users`:
```sql
-- Edit the APPLY_MIGRATION_NOW.sql file
-- Change these lines:
created_by UUID REFERENCES auth.users(id),
published_by UUID REFERENCES auth.users(id),

-- To:
created_by UUID,
published_by UUID,
```

---

## 🔄 Alternative: Using Supabase CLI

If you prefer using CLI:

```bash
# Make sure you're in the project directory
cd C:\Users\Juan\Desktop\Dev_Ops\web-ui

# Login to Supabase (if not already)
supabase login

# Link to your project (if not already)
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push
```

---

## 📞 Need Help?

If you encounter any issues:

1. Check the Supabase Dashboard → Database → Tables
2. Verify `training_configs` table exists
3. Check if you have permissions
4. Copy the error message
5. Check the verification output

---

## ✅ After Migration Success

Once the migration is applied successfully:

1. ✅ Restart your dev server (`npm run dev`)
2. ✅ The error should be gone
3. ✅ You can now use the TrainingPackageWizard
4. ✅ Version history will work

---

**File to Run**: `APPLY_MIGRATION_NOW.sql`
**Location**: Root of web-ui directory
**Estimated Time**: 2-5 minutes
**Risk Level**: Low (only creates new table, doesn't modify existing data)
