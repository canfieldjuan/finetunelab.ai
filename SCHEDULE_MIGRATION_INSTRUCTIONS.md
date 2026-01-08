# Database Migration Required: Add 'every_5_minutes' Schedule Type

## Problem

The database has a CHECK constraint that only allows:
- `hourly`
- `daily`
- `weekly`
- `custom`

We added `every_5_minutes` to the TypeScript types and API validation, but the database constraint still rejects it.

**Error:**
```
new row for relation "scheduled_evaluations" violates check constraint "scheduled_evaluations_schedule_type_check"
```

---

## Solution

A new migration file has been created that will:
1. Drop the existing CHECK constraint
2. Add a new CHECK constraint with `every_5_minutes` included
3. Verify the constraint was created successfully

---

## Files Created

### 1. Migration File
**Path:** `supabase/migrations/20260104000000_add_every_5_minutes_schedule_type.sql`

**What it does:**
```sql
-- Drop old constraint
ALTER TABLE public.scheduled_evaluations
DROP CONSTRAINT IF EXISTS scheduled_evaluations_schedule_type_check;

-- Add new constraint with 'every_5_minutes'
ALTER TABLE public.scheduled_evaluations
ADD CONSTRAINT scheduled_evaluations_schedule_type_check
CHECK (schedule_type IN ('every_5_minutes', 'hourly', 'daily', 'weekly', 'custom'));
```

### 2. Application Script
**Path:** `apply-schedule-migration.sh`

**Usage:**
```bash
# Load environment variables
source .env.local

# Apply migration
./apply-schedule-migration.sh
```

**What it does:**
- Checks environment variables are set
- Asks for confirmation before applying
- Applies the migration to Supabase database
- Verifies the constraint was updated successfully

### 3. Verification Script
**Path:** `check-schedule-constraint.sh`

**Usage:**
```bash
# Load environment variables
source .env.local

# Check current constraint
./check-schedule-constraint.sh
```

**What it does:**
- Shows the current CHECK constraint definition
- Indicates whether 'every_5_minutes' is included

---

## Step-by-Step Instructions

### Step 1: Verify Current State

```bash
source .env.local
./check-schedule-constraint.sh
```

**Expected Output:**
```
⚠️  Constraint does NOT include 'every_5_minutes'
   Run: ./apply-schedule-migration.sh to add it
```

### Step 2: Apply Migration

```bash
./apply-schedule-migration.sh
```

**Prompt:**
```
Apply this migration? (yes/no): yes
```

**Expected Output:**
```
✅ Migration applied successfully!
```

### Step 3: Verify Success

```bash
./check-schedule-constraint.sh
```

**Expected Output:**
```
✅ Constraint includes 'every_5_minutes'
   You can create schedules with this type!
```

### Step 4: Test Creating Schedule

Go to `/testing` or `/account` page and create a new scheduled evaluation:
- Schedule Type: **Every 5 Minutes (Testing)**
- Should save successfully without errors

---

## Rollback Instructions

If you need to rollback this migration:

```sql
ALTER TABLE public.scheduled_evaluations
DROP CONSTRAINT scheduled_evaluations_schedule_type_check;

ALTER TABLE public.scheduled_evaluations
ADD CONSTRAINT scheduled_evaluations_schedule_type_check
CHECK (schedule_type IN ('hourly', 'daily', 'weekly', 'custom'));
```

---

## Safety Notes

1. **Migration is backward compatible** - Existing schedules are not affected
2. **Only adds new value** - Does not remove or modify existing values
3. **Uses IF EXISTS** - Safe to run multiple times
4. **Includes verification** - Confirms constraint was created
5. **No data loss** - Only modifies constraint, not data

---

## Technical Details

**Constraint Name:** `scheduled_evaluations_schedule_type_check`

**Table:** `public.scheduled_evaluations`

**Column:** `schedule_type`

**Before:**
```sql
CHECK (schedule_type IN ('hourly', 'daily', 'weekly', 'custom'))
```

**After:**
```sql
CHECK (schedule_type IN ('every_5_minutes', 'hourly', 'daily', 'weekly', 'custom'))
```

---

## Related Files Modified

1. **Type Definition:** `lib/batch-testing/types.ts`
   - Added 'every_5_minutes' to ScheduleType union

2. **Schedule Calculator:** `lib/evaluation/schedule-calculator.ts`
   - Added case for calculating next run (+5 minutes)

3. **Frontend Form:** `components/evaluation/ScheduledEvaluationForm.tsx`
   - Added UI option in dropdown

4. **API Validation (Create):** `app/api/scheduled-evaluations/route.ts`
   - Added 'every_5_minutes' to validScheduleTypes

5. **API Validation (Update):** `app/api/scheduled-evaluations/[id]/route.ts`
   - Added 'every_5_minutes' to validScheduleTypes

6. **Database Constraint:** `supabase/migrations/20260104000000_add_every_5_minutes_schedule_type.sql` ⬅️ **NEW**
   - Migration to update CHECK constraint

---

## Status

- ✅ TypeScript types updated
- ✅ Schedule calculator updated
- ✅ Frontend UI updated
- ✅ API validation updated
- ⏳ **Database migration pending** ← **YOU ARE HERE**

---

**Next Action:** Run `./apply-schedule-migration.sh` to complete the implementation
