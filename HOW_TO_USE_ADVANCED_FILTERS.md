# How to Use Advanced Trace Filtering

## Where to Find Advanced Filters

The advanced filtering options are **hidden by default** to keep the UI clean. Here's how to access them:

### Step 1: Navigate to Trace Explorer
Go to: **http://localhost:3000/analytics/traces**

### Step 2: Click "Show Advanced" Button
In the **Filters** card, look for a button in the top-right corner that says:
```
┌─────────────────────────────────────────────────┐
│ 🔍 Filters              [Show Advanced] ← Click │
└─────────────────────────────────────────────────┘
```

### Step 3: Advanced Filters Revealed
After clicking "Show Advanced", you'll see **6 new filter options**:

```
┌──────────────────────────────────────────────────────────────┐
│ Advanced Filters                                             │
│                                                              │
│ ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│ │ Cost Range ($)  │  │ Duration Range   │  │ Throughput   │ │
│ │ Min: [____]     │  │ (ms)             │  │ (tok/s)      │ │
│ │ Max: [____]     │  │ Min: [____]      │  │ Min: [____]  │ │
│ │                 │  │ Max: [____]      │  │ Max: [____]  │ │
│ └─────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                              │
│ ┌──────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│ │ Min Quality      │  │ Error Status    │  │ Has Quality  │ │
│ │ Score (%)        │  │                 │  │ Score        │ │
│ │ [e.g., 80]       │  │ [All ▼]        │  │ [All ▼]     │ │
│ │                  │  │                 │  │              │ │
│ └──────────────────┘  └─────────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## What You'll See in the UI

### Quick Filters (Always Visible)
These colorful buttons are **always visible** at the top:
```
┌────────────────────────────────────────────────────────────┐
│ Quick Filters                                              │
│                                                            │
│ [🔴 Errors Only] [🟠 Slow Traces] [🟢 Expensive]          │
│ [🔵 Fast & Efficient] [🟣 High Quality] [Clear All]       │
└────────────────────────────────────────────────────────────┘
```

### Advanced Filters (Click "Show Advanced" to See)
These detailed controls appear **after clicking "Show Advanced"**:

#### 1. Cost Range ($)
```
Cost Range ($)
┌──────────┐  ┌──────────┐
│ Min: 0.01│  │ Max: 0.10│
└──────────┘  └──────────┘
```
- Filter traces by cost in USD
- Example: `Min: 0.01` shows only traces costing more than $0.01

#### 2. Duration Range (ms)
```
Duration Range (ms)
┌───────────┐  ┌───────────┐
│ Min: 1000 │  │ Max: 5000 │
└───────────┘  └───────────┘
```
- Filter traces by execution time in milliseconds
- Example: `Min: 1000, Max: 5000` shows traces between 1-5 seconds

#### 3. Throughput (tok/s)
```
Throughput (tok/s)
┌──────────┐  ┌──────────┐
│ Min: 50  │  │ Max: 200 │
└──────────┘  └──────────┘
```
- Filter traces by tokens per second
- Example: `Min: 50` shows only fast traces (>50 tok/s)

#### 4. Min Quality Score (%)
```
Min Quality Score (%)
┌────────────┐
│ e.g., 80   │
└────────────┘
```
- Filter traces by quality evaluation score
- Example: `80` shows only traces with quality score ≥ 80%

#### 5. Error Status
```
Error Status
┌───────────────▼┐
│ All            │
│ Errors Only    │  ← Select this to see only failed traces
│ No Errors      │  ← Select this to see only successful traces
└────────────────┘
```

#### 6. Has Quality Score
```
Has Quality Score
┌───────────────▼┐
│ All            │
│ With Score     │  ← Select this to see only evaluated traces
│ Without Score  │  ← Select this to see only un-evaluated traces
└────────────────┘
```

---

## How to Use

### Example 1: Find Expensive Traces
1. Click **"Show Advanced"**
2. Set **Cost Range Min**: `0.01`
3. Traces costing more than $0.01 will be shown

### Example 2: Find Slow Traces
1. Click **"Show Advanced"**
2. Set **Duration Range Min**: `5000` (5 seconds)
3. Only slow traces will be shown

### Example 3: Find High-Quality Fast Traces
1. Click **"Show Advanced"**
2. Set **Duration Max**: `1000` (1 second)
3. Set **Min Quality Score**: `80` (80%)
4. Set **Has Quality Score**: "With Score"
5. Only fast, high-quality traces will be shown

### Example 4: Find Errors Between 1-5 Seconds
1. Click **"Show Advanced"**
2. Set **Duration Min**: `1000`, **Max**: `5000`
3. Set **Error Status**: "Errors Only"
4. Only failed traces between 1-5 seconds will be shown

---

## Quick Filters vs Advanced Filters

### Quick Filters (Buttons)
These are **preset combinations** for common use cases:

| Button | What It Does |
|--------|-------------|
| **Errors Only** | Sets: `Error Status = Errors Only`, `Status = Failed` |
| **Slow Traces** | Sets: `Duration Min = 5000ms` (> 5 seconds) |
| **Expensive** | Sets: `Cost Min = $0.01` |
| **Fast & Efficient** | Sets: `Duration Max = 1000ms`, `Throughput Min = 50 tok/s` |
| **High Quality** | Sets: `Has Quality Score = With Score`, `Min Quality Score = 80%` |

### Advanced Filters (Manual Input)
These give you **precise control** over exact values:
- Set custom cost ranges (e.g., $0.005 to $0.015)
- Set custom duration ranges (e.g., 2000ms to 3500ms)
- Combine multiple filters for complex queries

---

## Visual Location Guide

```
┌───────────────────────────────────────────────────────────┐
│ Trace Explorer                                            │
│ Browse and debug LLM operation traces                     │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ 🔍 Filters              [Show Advanced] ← CLICK HERE│   │
│ ├─────────────────────────────────────────────────────┤   │
│ │                                                     │   │
│ │ Quick Filters (Always Visible)                      │   │
│ │ [🔴 Errors] [🟠 Slow] [🟢 Expensive] [Clear All]   │   │
│ │                                                     │   │
│ │ [Search Box] [Time: 30d ▼] [Operation ▼] [Status ▼]│   │
│ │                                                     │   │
│ │ ─────────────────────────────────────────────────   │   │
│ │ ⬇️ ADVANCED FILTERS APPEAR HERE AFTER CLICKING ⬇️    │   │
│ │                                                     │   │
│ │ Advanced Filters                                    │   │
│ │ [Cost] [Duration] [Throughput]                     │   │
│ │ [Quality] [Error Status] [Has Quality Score]       │   │
│ │                                                     │   │
│ └─────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

---

## Verifying Filters Are Working

### Check the Browser Network Tab
1. Open DevTools (F12)
2. Go to **Network** tab
3. Apply a filter (e.g., set Cost Min = 0.01)
4. Look for the request to `/api/analytics/traces/list`
5. Check the **Query String Parameters**:
   ```
   ?limit=100
   &offset=0
   &min_cost=0.01       ← Your filter is here!
   &start_date=2025-...
   ```

### Check the Results
- The trace list will **update automatically**
- The total count will show **filtered results**
- Pagination will be **accurate** (e.g., "Showing 5 of 237" where 237 is the filtered count)

---

## Button States

### "Show Advanced" Button
- **Default**: Says "Show Advanced" (filters hidden)
- **After Click**: Says "Hide Advanced" (filters visible)
- **Location**: Top-right corner of Filters card, next to "🔍 Filters" title

### Quick Filter Buttons
- **Inactive**: Gray outline
- **Active**: Colored background (red for errors, orange for slow, etc.)
- **Click to toggle**: Click again to deactivate

---

## Troubleshooting

### "I don't see the advanced filters"
✅ **Solution**: Click the **"Show Advanced"** button in the top-right of the Filters card

### "The button says 'Hide Advanced' but I don't see filters"
✅ **Solution**: Scroll down - the filters appear below the basic filters

### "Filters aren't working"
✅ **Solution**:
1. Open browser DevTools (F12)
2. Check Network tab for `/api/analytics/traces/list` request
3. Verify query parameters include your filters
4. Check console for errors

### "No results shown"
✅ **Possible Reasons**:
- Your filters are too restrictive (no traces match)
- Try clicking "Clear All" and start over
- Check if you have any traces in the selected time range

---

## Summary

**To see advanced filters**:
1. Go to `/analytics/traces`
2. Click **"Show Advanced"** button (top-right of Filters card)
3. 6 advanced filter options will appear below the basic filters

**All Advanced Filters**:
1. ✅ Cost Range ($) - Min/Max inputs
2. ✅ Duration Range (ms) - Min/Max inputs
3. ✅ Throughput (tok/s) - Min/Max inputs
4. ✅ Min Quality Score (%) - Single input
5. ✅ Error Status - Dropdown (All / Errors Only / No Errors)
6. ✅ Has Quality Score - Dropdown (All / With Score / Without Score)

**They ARE in the UI** - you just need to click "Show Advanced" to reveal them! 🎉
