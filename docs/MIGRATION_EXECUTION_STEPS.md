# Migration Execution Steps: Session Tracking

**Date:** 2025-10-15
**Migration:** 11_session_tracking.sql
**Status:** Ready to Execute

---

## Pre-Migration Verification ✅

### Code Impact Analysis
- **Grep search for session_id/experiment_name:** ✅ NO existing usage found
- **Grep search for conversations queries:** ✅ 18 files checked
- **Query patterns analyzed:**
  - SELECT with specific columns: ✅ SAFE (unaffected)
  - SELECT *: ✅ SAFE (new columns are nullable)
  - INSERT: ✅ SAFE (new columns are nullable)
  - UPDATE: ✅ SAFE (new columns optional)

### Risk Assessment
- **Breaking changes:** ✅ NONE - All new columns are nullable
- **Backward compatibility:** ✅ MAINTAINED - Existing queries work unchanged
- **Data loss risk:** ✅ NONE - Only adding columns, not modifying data
- **RLS impact:** ✅ NONE - No policy changes needed

---

## Step 1: Run SQL Migration in Supabase

### Instructions:
1. Open Supabase Dashboard
2. Navigate to: **SQL Editor**
3. Create new query
4. Copy the entire contents of: `/docs/schema_updates/11_session_tracking.sql`
5. Paste into SQL Editor
6. Click **Run** button

### SQL to Execute:
```sql
-- Session Tracking for A/B Testing & Model Comparison
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS experiment_name TEXT;

COMMENT ON COLUMN conversations.session_id IS 'User-defined session identifier...';
COMMENT ON COLUMN conversations.experiment_name IS 'Human-readable experiment name...';

CREATE INDEX IF NOT EXISTS idx_conversations_session_id
  ON conversations(session_id) WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_experiment_name
  ON conversations(experiment_name) WHERE experiment_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_user_session
  ON conversations(user_id, session_id) WHERE session_id IS NOT NULL;
```

### Expected Output:
```
ALTER TABLE
COMMENT
COMMENT
CREATE INDEX
CREATE INDEX
CREATE INDEX
```

---

## Step 2: Verify Migration Success

### Run Verification Script:
```bash
npx tsx scripts/verify-session-migration.ts
```

### Expected Output:
```
[Verify] ========================================
[Verify] Session Tracking Migration Verification
[Verify] ========================================

[Verify] Test 1: Checking if new columns exist...
[Verify] ✓ session_id column: EXISTS
[Verify] ✓ experiment_name column: EXISTS
[Verify] ✓ llm_model_id column: EXISTS

[Verify] Test 2: Testing backward compatibility...
[Verify] ✓ Old SELECT statements still work
[Verify] ✓ SELECT * still works
[Verify]   Total columns: [X] columns

[Verify] Test 3: Testing INSERT compatibility...
[Verify] ✓ New columns are nullable (INSERT compatible)

[Verify] Test 4: Testing filter queries...
[Verify] ✓ Can filter by session_id
[Verify] ✓ Can filter by experiment_name

[Verify] Test 5: Checking existing data...
[Verify] Total conversations: [X]
[Verify] ✓ Existing data intact
[Verify] Conversations with session_id: 0

[Verify] ========================================
[Verify] Verification Results
[Verify] ========================================
[Verify] ✓ ALL TESTS PASSED
[Verify] Migration successful!
[Verify] ========================================
```

### If Tests Fail:
1. Check Supabase SQL Editor for errors
2. Verify SQL was executed completely
3. Check RLS policies aren't blocking queries
4. Review error messages in verification output

---

## Step 3: Hot Reload Check

### No restart needed ✅
- Schema changes are immediately available
- Supabase client auto-detects new columns
- No code changes yet, so no hot reload required

### Verify in Dev Environment:
```bash
# Dev server should already be running
# No restart needed - schema changes are live immediately
```

---

## Step 4: Functional Testing

### Test A: Verify Existing Functionality
```bash
# Open http://localhost:3002
# Test these features:
1. ✅ Create new conversation
2. ✅ Send message
3. ✅ Load conversation history
4. ✅ View analytics (if any data exists)
5. ✅ Archive conversation
```

**Expected Result:** Everything works exactly as before

### Test B: Verify New Columns Accessible
```bash
# Open browser console
# Navigate to http://localhost:3002
# Run this in console:
```

```javascript
// Test new columns are accessible (will be null for now)
fetch('/api/test-new-columns').then(r => r.json()).then(console.log)
```

**Expected Result:** No errors, columns accessible but null

---

## Rollback Plan (If Needed)

### If Something Goes Wrong:

**Option 1: Remove Columns (Data Loss)**
```sql
DROP INDEX IF EXISTS idx_conversations_user_session;
DROP INDEX IF EXISTS idx_conversations_experiment_name;
DROP INDEX IF EXISTS idx_conversations_session_id;
ALTER TABLE conversations DROP COLUMN IF EXISTS experiment_name;
ALTER TABLE conversations DROP COLUMN IF EXISTS session_id;
```

**Option 2: Disable Without Removing**
- New columns are nullable and optional
- Simply don't implement UI features yet
- Columns will remain unused but harmless

---

## Post-Migration Checklist

- [ ] SQL executed successfully in Supabase
- [ ] Verification script ran with all tests passing
- [ ] Existing chat functionality still works
- [ ] No errors in browser console
- [ ] No errors in server logs
- [ ] Dev server still hot reloading properly

---

## Next Steps (After Migration Success)

### Phase 2: Session Tagging UI
1. Create SessionManager component
2. Add session input to Chat interface
3. Wire up session_id saving

### Phase 3: Analytics Filters
1. Create ModelSelector component
2. Create SessionSelector component
3. Add filters to Analytics Dashboard

---

## Logging Points to Monitor

### During Migration:
- Supabase SQL Editor output
- Verification script output

### After Migration:
- Browser console (no new errors)
- Server logs: `[API]`, `[Chat]`, `[Analytics]` prefixes
- Any RLS policy violations
- Any query performance issues

---

## Troubleshooting

### Issue: "Column already exists"
**Solution:** Safe to ignore - `IF NOT EXISTS` clause handles this

### Issue: "Permission denied"
**Solution:** Check you're using SERVICE_ROLE_KEY, not ANON_KEY

### Issue: "Index already exists"
**Solution:** Safe to ignore - `IF NOT EXISTS` clause handles this

### Issue: Verification script fails Test 1
**Solution:**
1. Re-run SQL in Supabase
2. Check for typos in column names
3. Verify RLS policies allow column access

### Issue: Existing queries broken
**Solution:**
1. Check specific error message
2. Verify column names don't conflict
3. Check if explicit SELECT lists need updating (unlikely)

---

**Status:** Ready to execute
**Confidence:** HIGH - No breaking changes identified
**Estimated Time:** 2-5 minutes

**Last Updated:** 2025-10-15
