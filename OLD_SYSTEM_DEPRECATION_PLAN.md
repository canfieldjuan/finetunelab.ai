# OLD Usage Tracking System Deprecation Plan

## Overview

Deprecating the subscription-based usage tracking system in favor of the usage-based billing system.

## Systems Comparison

### OLD System (Being Deprecated)
- **Database:** `usage_events` table → `current_usage_summary` materialized view
- **API:** `/api/usage/current`
- **UI:** "Current Usage" section on account page
- **Purpose:** Track subscription plan limits (API calls, chat messages, etc.)
- **Recording:** Manual `recordUsage()` calls throughout codebase

### NEW System (Keeping)
- **Database:** `usage_meters` table
- **API:** `/api/billing/usage`, `/api/billing/usage-history`
- **UI:** "Usage & Billing" card + "Usage Analytics" charts
- **Purpose:** Calculate actual billing costs based on root traces
- **Recording:** Automatic via `increment_root_trace_count()` RPC

## Phase 1: Remove UI Display (Immediate)

### Files to Modify

**app/account/page.tsx:**
- Remove state: `usage`, `limits`, `percentages`, `loadingUsage`
- Remove `fetchUsage()` useEffect (lines 147-175)
- Remove "Current Usage" section JSX (lines 428-490)

**components/usage/UsageCard.tsx:**
- Can be deleted if only used by OLD system
- Or keep if reusable for other purposes

## Phase 2: Stop Recording Events (Immediate)

### Find All Recording Calls

Search for these patterns:
```bash
grep -r "recordUsage" app/ lib/ --include="*.ts" --include="*.tsx"
grep -r "usage_events" app/ lib/ --include="*.ts" --include="*.tsx"
```

### Common Locations

- `/api/chat/*` - Chat message recording
- `/api/batch/*` - Batch test recording
- `/api/training/*` - Training job recording
- `/api/inference/*` - Inference call recording
- `/api/models/*` - Model usage recording

### Strategy

**Option A: Comment Out (Safe)**
- Comment out all `recordUsage()` calls
- Keep code for potential rollback
- Add `// DEPRECATED: OLD usage tracking system` comments

**Option B: Remove Completely (Clean)**
- Delete all `recordUsage()` calls
- Remove imports
- Cleaner codebase

**Recommended:** Option A for first deploy, then Option B after verification

## Phase 3: Deprecate API Endpoint (Later)

### app/api/usage/current/route.ts

**Option A: Return Empty Data**
```typescript
export async function GET(request: NextRequest) {
  return NextResponse.json({
    usage: {},
    limits: {},
    percentages: {},
    deprecated: true,
    message: "This endpoint is deprecated. Use /api/billing/usage instead."
  });
}
```

**Option B: Return 410 Gone**
```typescript
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: "This endpoint has been deprecated. Use /api/billing/usage instead." },
    { status: 410 }
  );
}
```

**Recommended:** Option A for backward compatibility

## Phase 4: Database Cleanup (Future)

**Do NOT drop tables immediately** - keep for historical analysis

### Tables Affected
- `usage_events` - Event log
- `current_usage_summary` - Materialized view

### Recommended Actions

1. **Archive Data** (6-12 months):
   - Export to CSV/JSON for historical records
   - Store in data warehouse if needed

2. **Drop Materialized View**:
   ```sql
   DROP MATERIALIZED VIEW IF EXISTS current_usage_summary;
   ```

3. **Optionally Archive Table**:
   ```sql
   -- Rename instead of drop (safer)
   ALTER TABLE usage_events RENAME TO usage_events_archived;

   -- Or export and drop
   -- (Export data first!)
   DROP TABLE usage_events;
   ```

## Migration Path for Existing Data

### Mapping OLD to NEW Metrics

OLD system tracked granular operations, NEW system tracks root traces.

**Not directly mappable** because:
- OLD: Counts every operation (chat message, API call, batch test, etc.)
- NEW: Counts only root LLM traces

**Recommendation:**
- Accept data gap during transition
- NEW system more accurate for billing
- OLD data remains in database for historical reference

## Testing Plan

### Before Deployment

1. ✅ Verify NEW system charts working (DONE)
2. ✅ Verify NEW system billing calculations correct (DONE)
3. Test account page loads without errors
4. Test no JavaScript errors in console
5. Verify usage-based billing still records correctly

### After Deployment

1. Monitor for any `recordUsage()` errors in logs
2. Verify no UI breaks on account page
3. Check NEW system continues recording
4. Monitor user feedback

## Rollback Plan

If issues arise:

1. **UI Issues:** Restore account page state/UI via git revert
2. **Recording Issues:** Uncomment `recordUsage()` calls
3. **Billing Issues:** NEW system independent, won't be affected

## Timeline

- **Phase 1 (Immediate):** Remove UI display - TODAY
- **Phase 2 (Immediate):** Stop recording events - TODAY
- **Phase 3 (1 week):** Deprecate API endpoint - After monitoring
- **Phase 4 (3-6 months):** Database cleanup - After data archive

## Files to Modify (Phase 1 & 2)

### Remove UI (app/account/page.tsx)
- Lines 86-89: Remove state declarations
- Lines 147-175: Remove fetchUsage useEffect
- Lines 428-490: Remove Current Usage JSX section

### Recording Functions to Find
```bash
# Find all recordUsage calls
grep -rn "recordUsage" app/ lib/ --include="*.ts" --include="*.tsx"

# Find usage_events references
grep -rn "usage_events" app/ lib/ --include="*.ts" --include="*.tsx"

# Find current_usage_summary references
grep -rn "current_usage_summary" app/ lib/ --include="*.ts" --include="*.tsx"
```

## Success Criteria

- ✅ Account page loads without "Current Usage" section
- ✅ No JavaScript errors in console
- ✅ NEW system charts still display correctly
- ✅ No `recordUsage()` calls being made
- ✅ NEW system continues recording traces to usage_meters
- ✅ Billing calculations still accurate

## Notes

- OLD system was subscription-based (Pro plan limits)
- NEW system is usage-based (pay per trace)
- This change simplifies billing and reduces technical debt
- Users now see only one source of truth for usage
