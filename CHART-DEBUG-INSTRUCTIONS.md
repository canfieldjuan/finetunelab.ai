# Chart Debug Instructions

## Changes Made

### 1. app/api/billing/usage-history/route.ts
**Line 70**: Changed `record: unknown` to `record: any`
**Lines 59, 68, 97-100**: Added console.log statements to debug API response

```typescript
// Added logging
console.log('[Usage History API] Found', usageHistory?.length || 0, 'usage records');
console.log('[Usage History API] Commitment tier:', commitment?.tier || 'none');
console.log('[Usage History API] Returning', history.length, 'months of data');
if (history.length > 0) {
  console.log('[Usage History API] Sample:', history[0]);
}
```

### 2. app/account/page.tsx
**Lines 105-106**: Changed state types from `unknown[]` to `any[]`
**Lines 195, 198**: Added console.log statements for frontend debugging
**Line 366**: Changed `currentTier as unknown` to `currentTier as any`

```typescript
// Fixed state types
const [usageHistory, setUsageHistory] = useState<any[]>([]);
const [invoices, setInvoices] = useState<any[]>([]);

// Added logging
console.log('[AccountPage] Usage history received:', data.history?.length || 0, 'months');
```

### 3. components/billing/UsageHistoryChart.tsx
**Lines 31-35**: Added console.log to see what props component receives
**Line 52**: Added console.log when no data

```typescript
console.log('[UsageHistoryChart] Rendering with:', {
  dataLength: data?.length || 0,
  loading,
  hasData: !!data,
});
```

## How to Debug

### Step 1: Open Browser Console
1. Open http://localhost:3000/account in your browser
2. Open DevTools (F12) and go to Console tab
3. Refresh the page

### Step 2: Check Server Logs
Look for these messages in your terminal where `npm run dev` is running:
```
[Usage History API] Found X usage records
[Usage History API] Commitment tier: starter
[Usage History API] Returning X months of data
[Usage History API] Sample: { month: 'January', year: 2026, ... }
```

### Step 3: Check Browser Console
Look for these messages in browser console:
```
[AccountPage] Usage history received: X months
[UsageHistoryChart] Rendering with: { dataLength: X, loading: false, hasData: true }
```

## Expected Outcomes

### If Working Correctly:
- Server logs show: "Found 2 usage records" (December + January)
- Server logs show: "Returning 2 months of data"
- Browser logs show: "Usage history received: 2 months"
- Browser logs show: "Rendering with: { dataLength: 2, ... }"
- Chart displays 2 bars (December and January)

### If Empty Chart:
Check which log statement fails to help diagnose:

**No server logs at all:**
- API endpoint not being called
- Check network tab for failed requests

**Server shows "Found 0 usage records":**
- usage_meters table is empty
- Migration not applied or data not recorded

**Server shows records but "Returning 0 months":**
- Data transformation error in map function
- Check commitment exists

**Browser shows "received: 0 months":**
- API returned empty array
- Check API response in Network tab

**Chart component shows "dataLength: 0":**
- State not updating
- Props not being passed correctly
- Check React DevTools

## Next Steps

After checking the logs, report which messages you see and which are missing.
This will tell us exactly where the data flow breaks.
