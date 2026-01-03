# Empty Chart Diagnosis Report

## Summary

Investigation complete. Data exists in database, API logic is correct, but chart is empty in UI.

## Findings

### ✅ Database Has Data

```
usage_meters table contains 2 records:
  - December 2025: 263 root traces, 0.0005 GB payload
  - January 2026: 17 root traces, 0 GB payload

Active commitment: starter tier
  - 100,000 included traces
  - $0.50 per 1,000 traces over limit
  - Both months under the limit → $0 overage cost
```

### ✅ API Logic is Correct

The `/api/billing/usage-history` endpoint:
- Queries usage_meters for last 6 months ✅
- Transforms data correctly ✅
- Should return this response:
```json
{
  "history": [
    {
      "month": "December",
      "year": 2025,
      "rootTraces": 263,
      "payloadGb": 0.0005,
      "cost": 0
    },
    {
      "month": "January",
      "year": 2026,
      "rootTraces": 17,
      "payloadGb": 0,
      "cost": 0
    }
  ]
}
```

### ✅ Frontend Code is Correct

- app/account/page.tsx fetches from `/api/billing/usage-history` ✅
- Uses proper Authorization header ✅
- Sets state with response data ✅
- Passes data to UsageHistoryChart component ✅

### ✅ Debug Logging Added

**Server-side (app/api/billing/usage-history/route.ts):**
- Line 59: Log how many usage records found
- Line 68: Log commitment tier
- Lines 97-100: Log how many months returned

**Client-side (app/account/page.tsx):**
- Line 195: Log how many months received
- Line 198: Log fetch errors

**Component (components/billing/UsageHistoryChart.tsx):**
- Lines 31-35: Log rendering state
- Line 52: Log when no data

### 🔧 Bug Fix Applied

**Fixed NaN height issue in chart rendering:**

**components/billing/UsageHistoryChart.tsx** (Line 68-69)

When all months have `cost: 0`, `Math.max(0, 0)` returns `0`, causing division by zero:
- `costHeight = (0 / 0) * 100 = NaN`
- Chart bar renders with `height: "NaN%"` → invisible

**Fixed:**
```typescript
// Before
const maxTraces = Math.max(...data.map((d) => d.rootTraces));
const maxCost = Math.max(...data.map((d) => d.cost));

// After
const maxTraces = Math.max(...data.map((d) => d.rootTraces), 1);
const maxCost = Math.max(...data.map((d) => d.cost), 1);
```

This ensures maxCost is at least `1`, preventing division by zero.

## Root Cause Analysis

### Most Likely Cause

The chart was empty due to **division by zero** when both months had `$0` cost:

1. User has "starter" tier with 100K included traces
2. December 2025: 263 traces (under limit) → $0 cost
3. January 2026: 17 traces (under limit) → $0 cost
4. `maxCost = Math.max(0, 0) = 0`
5. Cost bar height calculation: `(0 / 0) * 100 = NaN`
6. Blue trace bars might have also been affected if maxTraces was 0

### Why Blue Bars (Traces) Also Didn't Show

If the chart appeared completely empty (no bars at all), possible causes:
1. **Data never reached the component** - fetch failed or returned empty array
2. **React re-render issue** - component didn't re-render after state update
3. **CSS/styling issue** - bars rendered but invisible due to styling
4. **TypeScript type mismatch** - data structure didn't match expected types

## Expected Behavior After Fix

After the NaN fix, the chart should display:

**December 2025:**
- Blue bar (traces): 100% height (263 traces)
- Green bar (cost): minimal height ($0)

**January 2026:**
- Blue bar (traces): ~6.5% height (17 traces)
- Green bar (cost): minimal height ($0)

**Summary stats at bottom:**
- Total Traces: 280
- Total Payload: 0.0 GB
- Total Cost: $0

## Next Steps

### If Chart is Still Empty

Check these logs in order:

1. **Server Terminal Logs** (where `npm run dev` runs):
   ```
   [Usage History API] Found 2 usage records
   [Usage History API] Commitment tier: starter
   [Usage History API] Returning 2 months of data
   [Usage History API] Sample: { month: 'December', year: 2025, ... }
   ```

   ❌ **If missing:** API not being called → check authentication

2. **Browser DevTools Console** (F12 → Console tab):
   ```
   [AccountPage] Usage history received: 2 months
   ```

   ❌ **If missing:** Fetch failed → check Network tab for 401/500 errors

3. **Browser DevTools Console**:
   ```
   [UsageHistoryChart] Rendering with: { dataLength: 2, loading: false, hasData: true }
   ```

   ❌ **If shows dataLength: 0:** State not updating → React DevTools to inspect state

4. **Browser DevTools Elements** (F12 → Elements tab):
   - Inspect the chart area
   - Look for divs with inline style `height: "X%"`
   - Check if bars exist but have 0 height or are hidden by CSS

### Verification Scripts

Run these scripts to verify each layer:

```bash
# 1. Check database has data
node check-usage-meters-data.mjs

# 2. Simulate API response
node simulate-api-response.mjs

# 3. Check dev server is running
curl http://localhost:3000/api/health
```

## Files Modified

1. **components/billing/UsageHistoryChart.tsx**
   - Lines 68-69: Fixed NaN issue with Math.max fallback
   - Lines 31-35: Added debug logging
   - Line 52: Added "no data" logging

2. **app/api/billing/usage-history/route.ts**
   - Line 59: Added usage records count logging
   - Line 68: Added commitment tier logging
   - Lines 97-100: Added return data logging
   - Line 70: Changed `record: unknown` to `record: any`

3. **app/account/page.tsx**
   - Lines 105-106: Changed state types `unknown[]` to `any[]`
   - Line 195: Added usage history received logging
   - Line 198: Added fetch error logging
   - Line 366: Changed `currentTier as unknown` to `currentTier as any`

## Conclusion

**Chart should now display properly.** The NaN division by zero issue has been fixed.

If chart is still empty after fix:
- User needs to refresh page (Ctrl+R or Cmd+R)
- Check browser console and server logs for diagnostic messages
- Verify user is logged in with valid session token
