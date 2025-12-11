# Analytics Chart Fixes - Readability Improvements

**Date:** 2025-12-02
**Status:** ✅ Completed

## Issues Fixed

### 1. Underscores in Labels
**Problem:** Model names, provider names, and session IDs were displaying with underscores instead of more readable formats.

**Examples of issues:**
- `mistralai_Mistral-7B-Instruct-v0.3` → Hard to read
- `openai_gpt-4` → Unclear separation
- `session_test_baseline` → Looks technical/raw

### 2. Overlapping Chart Elements
**Problem:** Chart labels and text were overlapping, making charts hard to read.

**Specific issues:**
- X-axis date labels overlapping each other
- Legend text touching chart area
- Axis labels cramped without proper spacing

---

## Solutions Implemented

### File 1: Created Label Formatting Utilities
**Path:** `/lib/utils/format-labels.ts`

**New Functions:**

1. **`formatModelName()`**
   - Replaces underscores with slashes for HuggingFace-style names
   - `mistralai_Mistral-7B-Instruct-v0.3` → `mistralai/Mistral-7B-Instruct-v0.3`
   - `openai_gpt-4` → `openai/gpt-4`

2. **`formatProviderName()`**
   - Capitalizes and formats provider names
   - `openai` → `OpenAI`
   - `anthropic` → `Anthropic`
   - `hugging_face` → `Hugging Face`

3. **`formatTrainingMethod()`**
   - Formats training method names
   - `sft` → `SFT`
   - `dpo` → `DPO`
   - `supervised_fine_tuning` → `Supervised Fine Tuning`

4. **`formatSessionName()`**
   - Cleans up session/experiment names
   - `session_test_baseline` → `Test Baseline`
   - `experiment_my_test` → `My Test`

5. **`formatChartLabel()`**
   - Formats any label by replacing underscores and capitalizing
   - `avg_response_time` → `Avg Response Time`

6. **`truncate()`**
   - Truncates long text with ellipsis
   - Prevents overflow in constrained spaces

---

### File 2: Updated ModelPerformanceTable
**Path:** `/components/analytics/ModelPerformanceTable.tsx`

**Changes:**
```typescript
// Added import
import { formatModelName, formatProviderName } from '@/lib/utils/format-labels';

// Updated display (line 162)
<div className="font-medium cursor-help" title={model.modelId}>
  {formatModelName(model.modelName)}  // ✅ Now formatted
</div>

// Updated provider display (line 166)
<div className="text-xs text-gray-500">
  {formatProviderName(model.provider)}  // ✅ Now formatted
  {model.trainingMethod && ` • ${model.trainingMethod.toUpperCase()}`}
</div>
```

**Result:**
- Model names now show as `mistralai/Mistral-7B-Instruct-v0.3`
- Providers show as `OpenAI`, `Anthropic` instead of raw IDs
- Training methods show as `SFT`, `DPO` in uppercase

---

### File 3: Updated TrainingEffectivenessChart
**Path:** `/components/analytics/TrainingEffectivenessChart.tsx`

**Changes:**
```typescript
// Added import
import { formatModelName } from '@/lib/utils/format-labels';

// Updated model name display (line 153)
<td className="py-2 px-2 font-medium">
  {formatModelName(model.modelName)}  // ✅ Now formatted
</td>

// Updated base model display (line 156)
<td className="py-2 px-2 text-gray-600">
  {formatModelName(model.baseModel) || '-'}  // ✅ Now formatted
</td>
```

**Result:**
- Model names in training effectiveness table are now readable
- Base model names also formatted consistently

---

### File 4: Updated SessionComparisonTable
**Path:** `/components/analytics/SessionComparisonTable.tsx`

**Changes:**
```typescript
// Added import
import { formatSessionName } from '@/lib/utils/format-labels';

// Updated session ID display (line 207-208)
<div className="font-medium truncate max-w-[200px]" title={session.sessionId}>
  {formatSessionName(session.sessionId)}  // ✅ Now formatted
</div>
```

**Result:**
- Session IDs like `session_test_baseline` now show as `Test Baseline`
- Original ID still available in tooltip on hover
- Better A/B test readability

---

### File 5: Fixed ResponseTimeChart Spacing
**Path:** `/components/analytics/ResponseTimeChart.tsx`

**Changes:**
```typescript
// Increased chart height for better spacing
<ResponsiveContainer width="100%" height={350}>  // Was 300

// Added margins to prevent cramping
<LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>

// Angled X-axis labels to prevent overlap
<XAxis
  dataKey="date"
  angle={-45}        // ✅ Diagonal labels
  textAnchor="end"   // ✅ Proper alignment
  height={80}        // ✅ More space for labels
  tick={{ fontSize: 12 }}
/>

// Added Y-axis label
<YAxis
  label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }}
  tick={{ fontSize: 12 }}
/>

// Added spacing for legend
<Legend wrapperStyle={{ paddingTop: '10px' }} />
```

**Result:**
- ✅ Date labels no longer overlap
- ✅ Y-axis has clear "Latency (ms)" label
- ✅ Legend has proper spacing from chart
- ✅ Overall chart is more readable

---

## Impact Summary

### Tables Fixed
1. ✅ **Model Performance Table** - Model names formatted, providers capitalized
2. ✅ **Training Effectiveness Chart** - Model and base model names formatted
3. ✅ **Session Comparison Table** - Session names cleaned and formatted

### Charts Fixed
1. ✅ **Response Time Chart** - Fixed overlapping labels, added spacing

### Utilities Created
1. ✅ **format-labels.ts** - Reusable formatting functions for all analytics components

---

## Usage Examples

### For Developers

When adding new analytics components, use these utilities:

```typescript
import {
  formatModelName,
  formatProviderName,
  formatTrainingMethod,
  formatSessionName,
  formatChartLabel,
  truncate
} from '@/lib/utils/format-labels';

// Model display
<div>{formatModelName('mistralai_Mistral-7B-Instruct-v0.3')}</div>
// → "mistralai/Mistral-7B-Instruct-v0.3"

// Provider display
<span>{formatProviderName('openai')}</span>
// → "OpenAI"

// Session display with truncation
<div>{truncate(formatSessionName(sessionId), 40)}</div>
// → Formatted and truncated if too long

// Chart axis labels
<YAxis label={{ value: formatChartLabel('avg_response_time') }} />
// → "Avg Response Time"
```

### For Chart Components

When creating Recharts components, always include:

```typescript
<ResponsiveContainer width="100%" height={350}>
  <LineChart
    data={data}
    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}  // ✅ Add margins
  >
    <XAxis
      dataKey="date"
      angle={-45}           // ✅ Angle labels if text is long
      textAnchor="end"
      height={80}           // ✅ Extra height for angled labels
      tick={{ fontSize: 12 }}
    />
    <YAxis
      label={{ value: 'Label', angle: -90, position: 'insideLeft' }}  // ✅ Add axis label
      tick={{ fontSize: 12 }}
    />
    <Legend wrapperStyle={{ paddingTop: '10px' }} />  // ✅ Space legend
  </LineChart>
</ResponsiveContainer>
```

---

## Additional Charts to Update

The following charts may benefit from the same improvements:

### High Priority
- [ ] **TokenUsageChart** - May have overlapping date labels
- [ ] **CostTrackingChart** - May show raw model names
- [ ] **ToolPerformanceChart** - May have tool_name with underscores
- [ ] **ErrorBreakdownChart** - May have error_type with underscores

### Medium Priority
- [ ] **BenchmarkAnalysisChart** - Check for model name display
- [ ] **ConversationLengthChart** - Check label spacing
- [ ] **SLABreachChart** - Check date label overlap

### Low Priority (Tables/Non-Charts)
- [ ] **JudgmentsBreakdown** - May show raw judgment types
- [ ] **JudgmentsTable** - May have underscores in categories

---

## Testing Checklist

To verify fixes are working:

1. ✅ Navigate to Analytics Dashboard
2. ✅ Check Model Performance Table:
   - Model names show as `provider/model-name` format
   - Providers are capitalized
   - Training methods are uppercase (SFT, DPO)
3. ✅ Check Training Effectiveness Chart:
   - Model names formatted in both main and detailed tables
4. ✅ Check Session Comparison Table:
   - Session names are cleaned (no `session_` prefix)
   - Hover shows original ID in tooltip
5. ✅ Check Response Time Chart:
   - Date labels don't overlap
   - Y-axis has "Latency (ms)" label
   - Legend has proper spacing

---

## Performance Impact

✅ **Minimal** - All formatting functions are simple string replacements
✅ **No API changes** - All changes are presentation layer only
✅ **Backward compatible** - Raw values still accessible via tooltips/titles

---

## Next Steps

1. **Monitor** - Watch for any additional charts with similar issues
2. **Apply pattern** - Use format utilities in new analytics components
3. **Document** - Update component documentation with formatting examples
4. **Extend** - Add more format utilities as needed (e.g., `formatMetricName`)

---

## Notes

- Original raw values (model IDs, session IDs) are preserved in `title` attributes for hover tooltips
- Formatting is applied only at display time, not in data processing
- All changes are CSS/rendering only - no database or API modifications needed
- Functions handle `null`/`undefined` gracefully, returning empty strings
