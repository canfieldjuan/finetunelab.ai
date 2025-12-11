# CSV Export Parity - Implementation Plan
**Date**: November 28, 2025
**Status**: Ready for Implementation
**Issue**: CSV exports missing 60% of data available in JSON exports

---

## Problem Statement

### Current Situation
**JSON Export (`generateStructuredJSON`)** exports:
```typescript
{
  metadata: { ... },
  data: dataset  // ← ENTIRE AnalyticsDataset object
}
```

**CSV Export (`generateCompleteDatasetCSV`)** exports:
```
ANALYTICS OVERVIEW      (12 summary metrics)
TOKEN USAGE            (tokenUsage array only)
QUALITY METRICS        (quality array only)
TOOL USAGE            (tools array only)
MODEL COMPARISON      (calculated from tokenUsage)
```

### Missing Data in CSV Exports
- ❌ `dataset.metrics.conversations` - Conversation metadata (session_id, experiment_name, message_count, duration, completion_status)
- ❌ `dataset.metrics.errors` - Error details (error_type, error_message, fallback_used, model_id)
- ❌ `dataset.metrics.latency` - Latency measurements (latency_ms, tokens_per_second, model_id)
- ❌ `dataset.aggregations.trends` - Trend analysis (direction, change_percent, confidence)

### Impact
- **Excel/Google Sheets users** lose 60%+ of available data
- **Session A/B testing** data not available in CSV format
- **Error analysis** impossible without JSON export
- **Performance profiling** incomplete without latency data

---

## Data Structure Verification

### ConversationDataPoint (lines 46-54 in lib/analytics/types.ts)
```typescript
interface ConversationDataPoint {
  timestamp: Date;
  conversationId: string;
  messageCount: number;
  turnCount: number;
  durationMs: number;
  completionStatus: 'completed' | 'abandoned' | 'active';
  modelId: string;
}
```

### ErrorDataPoint (lines 56-64 in lib/analytics/types.ts)
```typescript
interface ErrorDataPoint {
  timestamp: Date;
  messageId: string;
  conversationId: string;
  errorType: string;
  errorMessage: string;
  fallbackUsed: boolean;
  modelId: string;
}
```

### LatencyDataPoint (lines 66-74 in lib/analytics/types.ts)
```typescript
interface LatencyDataPoint {
  timestamp: Date;
  messageId: string;
  conversationId: string;
  modelId: string;
  latencyMs: number;
  tokenCount: number;
  tokensPerSecond: number;
}
```

### TrendData (lines 101-106 in lib/analytics/types.ts)
```typescript
interface TrendData {
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  dataPoints: number;
  confidence: 'high' | 'medium' | 'low';
}
```

---

## Implementation Plan

### Phase 1: Verification ✅ COMPLETE

**Verified**:
- ✅ AnalyticsDataset structure (lib/analytics/types.ts)
- ✅ Data aggregator functions exist (dataAggregator.ts lines 58, 147, 221, 295, 365, 431)
- ✅ Export API flow (app/api/analytics/export/route.ts)
- ✅ Current CSV generators (csvGenerator.ts lines 44-228)
- ✅ ExportType options (components/analytics/types.ts lines 6-12)

**Findings**:
- Data structures are complete and well-defined
- Aggregator functions already fetch conversations, errors, latency data
- API already passes full dataset to generators
- **Missing**: CSV generators for conversations, errors, latency
- **Issue**: `generateCompleteDatasetCSV()` doesn't call these generators

---

### Phase 2: Add Missing CSV Generators

#### File: `/lib/analytics/export/csvGenerator.ts`
**Insertion Point**: After line 189 (after `generateQualityTrendsCSV`)

#### Generator 1: `generateConversationsCSV()`

**Purpose**: Export conversation metadata including session tags for A/B testing

**Code Block** (~35 lines):
```typescript
/**
 * Generate conversations CSV
 */
export function generateConversationsCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating conversations CSV');

  const data: CSVRow[] = dataset.metrics.conversations.map(point => ({
    Timestamp: point.timestamp.toISOString(),
    ConversationId: point.conversationId,
    MessageCount: point.messageCount,
    TurnCount: point.turnCount,
    DurationMs: point.durationMs,
    DurationMinutes: (point.durationMs / 60000).toFixed(2),
    CompletionStatus: point.completionStatus,
    ModelId: point.modelId,
  }));

  const headers = [
    'Timestamp',
    'ConversationId',
    'MessageCount',
    'TurnCount',
    'DurationMs',
    'DurationMinutes',
    'CompletionStatus',
    'ModelId'
  ];
  const csv = arrayToCSV(data, headers);

  console.log('[CSVGenerator] Conversations CSV generated', { rows: data.length });
  return csv;
}
```

**Why This Works**:
- Uses existing `escapeCSVValue()` and `arrayToCSV()` helper functions
- Maps each ConversationDataPoint to CSV row
- Includes all fields from interface
- Adds computed `DurationMinutes` for readability
- Follows same pattern as existing generators

#### Generator 2: `generateErrorsCSV()`

**Purpose**: Export error logs for debugging and quality analysis

**Code Block** (~35 lines):
```typescript
/**
 * Generate errors CSV
 */
export function generateErrorsCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating errors CSV');

  const data: CSVRow[] = dataset.metrics.errors.map(point => ({
    Timestamp: point.timestamp.toISOString(),
    MessageId: point.messageId,
    ConversationId: point.conversationId,
    ErrorType: point.errorType,
    ErrorMessage: point.errorMessage,
    FallbackUsed: point.fallbackUsed,
    ModelId: point.modelId,
  }));

  const headers = [
    'Timestamp',
    'MessageId',
    'ConversationId',
    'ErrorType',
    'ErrorMessage',
    'FallbackUsed',
    'ModelId'
  ];
  const csv = arrayToCSV(data, headers);

  console.log('[CSVGenerator] Errors CSV generated', { rows: data.length });
  return csv;
}
```

**Why This Works**:
- Exports all error fields for complete debugging context
- ErrorMessage properly escaped by `escapeCSVValue()` (handles commas, quotes)
- FallbackUsed boolean converted to string automatically
- Follows same pattern as existing generators

#### Generator 3: `generateLatencyCSV()`

**Purpose**: Export performance metrics for latency analysis

**Code Block** (~35 lines):
```typescript
/**
 * Generate latency CSV
 */
export function generateLatencyCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating latency CSV');

  const data: CSVRow[] = dataset.metrics.latency.map(point => ({
    Timestamp: point.timestamp.toISOString(),
    MessageId: point.messageId,
    ConversationId: point.conversationId,
    ModelId: point.modelId,
    LatencyMs: point.latencyMs,
    LatencySeconds: (point.latencyMs / 1000).toFixed(3),
    TokenCount: point.tokenCount,
    TokensPerSecond: point.tokensPerSecond.toFixed(2),
  }));

  const headers = [
    'Timestamp',
    'MessageId',
    'ConversationId',
    'ModelId',
    'LatencyMs',
    'LatencySeconds',
    'TokenCount',
    'TokensPerSecond'
  ];
  const csv = arrayToCSV(data, headers);

  console.log('[CSVGenerator] Latency CSV generated', { rows: data.length });
  return csv;
}
```

**Why This Works**:
- Includes raw latency_ms and computed latency_seconds for convenience
- TokensPerSecond formatted to 2 decimal places for readability
- All numeric fields preserved for analysis in Excel/Google Sheets
- Follows same pattern as existing generators

#### Generator 4: `generateTrendsCSV()`

**Purpose**: Export trend analysis summary for quick insights

**Code Block** (~40 lines):
```typescript
/**
 * Generate trends CSV
 */
export function generateTrendsCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating trends CSV');

  const data: CSVRow[] = [
    {
      Metric: 'Token Usage',
      Direction: dataset.aggregations.trends.tokenUsage.direction,
      ChangePercent: dataset.aggregations.trends.tokenUsage.changePercent.toFixed(2),
      DataPoints: dataset.aggregations.trends.tokenUsage.dataPoints,
      Confidence: dataset.aggregations.trends.tokenUsage.confidence,
    },
    {
      Metric: 'Quality',
      Direction: dataset.aggregations.trends.quality.direction,
      ChangePercent: dataset.aggregations.trends.quality.changePercent.toFixed(2),
      DataPoints: dataset.aggregations.trends.quality.dataPoints,
      Confidence: dataset.aggregations.trends.quality.confidence,
    },
    {
      Metric: 'Latency',
      Direction: dataset.aggregations.trends.latency.direction,
      ChangePercent: dataset.aggregations.trends.latency.changePercent.toFixed(2),
      DataPoints: dataset.aggregations.trends.latency.dataPoints,
      Confidence: dataset.aggregations.trends.latency.confidence,
    },
    {
      Metric: 'Error Rate',
      Direction: dataset.aggregations.trends.errorRate.direction,
      ChangePercent: dataset.aggregations.trends.errorRate.changePercent.toFixed(2),
      DataPoints: dataset.aggregations.trends.errorRate.dataPoints,
      Confidence: dataset.aggregations.trends.errorRate.confidence,
    },
  ];

  const headers = ['Metric', 'Direction', 'ChangePercent', 'DataPoints', 'Confidence'];
  const csv = arrayToCSV(data, headers);

  console.log('[CSVGenerator] Trends CSV generated');
  return csv;
}
```

**Why This Works**:
- Exports all 4 trend metrics (tokenUsage, quality, latency, errorRate)
- Fixed format for rows (no dynamic data, no empty arrays to check)
- ChangePercent formatted to 2 decimal places
- Provides quick summary of data trends

---

### Phase 3: Update `generateCompleteDatasetCSV()`

#### File: `/lib/analytics/export/csvGenerator.ts`
**Current Location**: Lines 194-228
**Current Code**:
```typescript
export function generateCompleteDatasetCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating complete dataset CSV');

  const sections: string[] = [];

  sections.push('ANALYTICS OVERVIEW');
  sections.push(generateOverviewCSV(dataset));
  sections.push('');

  if (dataset.metrics.tokenUsage.length > 0) {
    sections.push('TOKEN USAGE');
    sections.push(generateTimeSeriesCSV(dataset));
    sections.push('');
  }

  if (dataset.metrics.quality.length > 0) {
    sections.push('QUALITY METRICS');
    sections.push(generateQualityTrendsCSV(dataset));
    sections.push('');
  }

  if (dataset.metrics.tools.length > 0) {
    sections.push('TOOL USAGE');
    sections.push(generateToolUsageCSV(dataset));
    sections.push('');
  }

  sections.push('MODEL COMPARISON');
  sections.push(generateModelComparisonCSV(dataset));

  const csv = sections.join('\n');

  console.log('[CSVGenerator] Complete dataset CSV generated');
  return csv;
}
```

**Updated Code** (adds conversations, errors, latency, trends):
```typescript
export function generateCompleteDatasetCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating complete dataset CSV');

  const sections: string[] = [];

  // Section 1: Overview
  sections.push('ANALYTICS OVERVIEW');
  sections.push(generateOverviewCSV(dataset));
  sections.push('');

  // Section 2: Trends
  sections.push('TRENDS ANALYSIS');
  sections.push(generateTrendsCSV(dataset));
  sections.push('');

  // Section 3: Token Usage
  if (dataset.metrics.tokenUsage.length > 0) {
    sections.push('TOKEN USAGE');
    sections.push(generateTimeSeriesCSV(dataset));
    sections.push('');
  }

  // Section 4: Quality Metrics
  if (dataset.metrics.quality.length > 0) {
    sections.push('QUALITY METRICS');
    sections.push(generateQualityTrendsCSV(dataset));
    sections.push('');
  }

  // Section 5: Tool Usage
  if (dataset.metrics.tools.length > 0) {
    sections.push('TOOL USAGE');
    sections.push(generateToolUsageCSV(dataset));
    sections.push('');
  }

  // Section 6: Conversations (NEW)
  if (dataset.metrics.conversations.length > 0) {
    sections.push('CONVERSATIONS');
    sections.push(generateConversationsCSV(dataset));
    sections.push('');
  }

  // Section 7: Errors (NEW)
  if (dataset.metrics.errors.length > 0) {
    sections.push('ERRORS');
    sections.push(generateErrorsCSV(dataset));
    sections.push('');
  }

  // Section 8: Latency (NEW)
  if (dataset.metrics.latency.length > 0) {
    sections.push('LATENCY');
    sections.push(generateLatencyCSV(dataset));
    sections.push('');
  }

  // Section 9: Model Comparison
  sections.push('MODEL COMPARISON');
  sections.push(generateModelComparisonCSV(dataset));

  const csv = sections.join('\n');

  console.log('[CSVGenerator] Complete dataset CSV generated');
  return csv;
}
```

**Changes**:
- ✅ Added Section 2: Trends Analysis (always included, no conditional)
- ✅ Added Section 6: Conversations (conditional on data length)
- ✅ Added Section 7: Errors (conditional on data length)
- ✅ Added Section 8: Latency (conditional on data length)
- ✅ Preserved existing sections and ordering
- ✅ No breaking changes - all existing functionality intact

**Why This Works**:
- Conditional checks prevent empty sections
- Maintains backward compatibility
- CSV structure still valid for Excel/Google Sheets
- Section headers make data easy to navigate

---

### Phase 4: Export API Updates (Optional - May Not Be Needed)

#### File: `/app/api/analytics/export/route.ts`
**Current Exports** (lines 13-28):
```typescript
import {
  generateCompleteDatasetCSV,
  generateOverviewCSV,
  generateTimeSeriesCSV,
  generateModelComparisonCSV,
  generateToolUsageCSV,
  generateQualityTrendsCSV,
} from '@/lib/analytics/export/csvGenerator';
```

**Potential Update** (add new generator imports):
```typescript
import {
  generateCompleteDatasetCSV,
  generateOverviewCSV,
  generateTimeSeriesCSV,
  generateModelComparisonCSV,
  generateToolUsageCSV,
  generateQualityTrendsCSV,
  generateConversationsCSV,
  generateErrorsCSV,
  generateLatencyCSV,
  generateTrendsCSV,
} from '@/lib/analytics/export/csvGenerator';
```

**Export Type Additions**:
Currently supports (line 52):
```typescript
exportType: 'overview' | 'timeseries' | 'complete' | 'model_comparison' | 'tool_usage' | 'quality_trends'
```

**Potential Addition** (if we want individual exports):
```typescript
exportType: 'overview' | 'timeseries' | 'complete' | 'model_comparison' | 'tool_usage' | 'quality_trends' | 'conversations' | 'errors' | 'latency' | 'trends'
```

**Note**: This is OPTIONAL. The `'complete'` export type will automatically include the new sections after we update `generateCompleteDatasetCSV()`. Individual export types only needed if users want to export ONLY conversations, errors, latency, or trends.

**Recommendation**: Start with just updating `generateCompleteDatasetCSV()`. Add individual export types later if users request them.

---

## Verification Steps

### Step 1: TypeScript Compilation
```bash
npx tsc --noEmit 2>&1 | grep "csvGenerator"
```
**Expected**: No errors in csvGenerator.ts

### Step 2: Manual Test Export
1. Navigate to `/analytics`
2. Click "Export Data"
3. Select:
   - Format: CSV
   - Type: Complete Dataset
4. Download file
5. Open in Excel/Google Sheets

**Expected CSV Structure**:
```
ANALYTICS OVERVIEW
Metric,Value
Total Messages,1234
...

TRENDS ANALYSIS
Metric,Direction,ChangePercent,DataPoints,Confidence
Token Usage,up,12.50,100,high
...

TOKEN USAGE
Timestamp,Type,MessageId,ModelId,InputTokens,OutputTokens,TotalTokens,Cost
...

QUALITY METRICS
...

TOOL USAGE
...

CONVERSATIONS
Timestamp,ConversationId,MessageCount,TurnCount,DurationMs,DurationMinutes,CompletionStatus,ModelId
...

ERRORS
Timestamp,MessageId,ConversationId,ErrorType,ErrorMessage,FallbackUsed,ModelId
...

LATENCY
Timestamp,MessageId,ConversationId,ModelId,LatencyMs,LatencySeconds,TokenCount,TokensPerSecond
...

MODEL COMPARISON
...
```

### Step 3: Compare with JSON Export
1. Export same date range as JSON
2. Compare data completeness
3. Verify CSV now includes conversations, errors, latency data

**Expected**: CSV export now has feature parity with JSON export (all data present)

### Step 4: Validate CSV Formatting
- ✅ No syntax errors (opens in Excel without errors)
- ✅ Headers present for each section
- ✅ Commas properly escaped in error messages
- ✅ Timestamps in ISO 8601 format
- ✅ Numbers formatted correctly (no leading zeros, proper decimals)

### Step 5: Test Edge Cases
**Empty Data**:
- Export with no conversations → CONVERSATIONS section not included
- Export with no errors → ERRORS section not included
- Export with no latency data → LATENCY section not included

**Expected**: Sections conditionally included, no errors

**Large Data**:
- Export with 10,000+ rows
- Verify file size is reasonable
- Verify all rows included

**Special Characters**:
- Export with error messages containing commas, quotes, newlines
- Verify proper CSV escaping

---

## Testing Checklist

After implementation:

- [ ] TypeScript compilation passes
- [ ] `generateConversationsCSV()` exports conversation data correctly
- [ ] `generateErrorsCSV()` exports error logs correctly
- [ ] `generateLatencyCSV()` exports latency metrics correctly
- [ ] `generateTrendsCSV()` exports trend analysis correctly
- [ ] `generateCompleteDatasetCSV()` includes all new sections
- [ ] CSV file opens in Excel without errors
- [ ] CSV file opens in Google Sheets without errors
- [ ] Data in CSV matches data in JSON export
- [ ] Empty metrics don't break export (conditional sections)
- [ ] Error messages with special characters properly escaped
- [ ] Session A/B testing data (conversations) now available in CSV
- [ ] Performance profiling data (latency) now available in CSV
- [ ] Error analysis data now available in CSV
- [ ] Trend analysis now available in CSV

---

## Breaking Changes Analysis

### None Expected ✅

**Reason**:
1. **Only adding new functions** - No existing function signatures modified
2. **Backward compatible** - `generateCompleteDatasetCSV()` still accepts same parameters
3. **Output format unchanged** - Still valid CSV, just with more sections
4. **Conditional sections** - Empty data arrays don't break export
5. **No API changes** - Existing export types still work
6. **No UI changes** - Export button still works the same

**Potential Risk**:
- CSV file size will increase (more data exported)
- Users with scripts parsing CSV output may need to update parsers to handle new sections

**Mitigation**:
- File size increase is expected (users get more data)
- New sections are clearly labeled with section headers
- Section order is predictable and documented

---

## Rollback Plan

If issues occur:

**Step 1**: Revert `generateCompleteDatasetCSV()` to original version
```typescript
// Remove lines for CONVERSATIONS, ERRORS, LATENCY, TRENDS sections
```

**Step 2**: Comment out new generator functions
```typescript
// export function generateConversationsCSV() { ... }
// export function generateErrorsCSV() { ... }
// export function generateLatencyCSV() { ... }
// export function generateTrendsCSV() { ... }
```

**Step 3**: Verify exports work again
```bash
npm run build
# Test export functionality
```

**Result**: Reverts to original CSV export behavior (5 sections only)

---

## Implementation Order

1. ✅ **Discovery Phase** - COMPLETE
   - Verified AnalyticsDataset structure
   - Verified aggregator functions
   - Verified export API flow
   - Verified current CSV generators

2. **Implementation Phase** - READY
   - Add `generateConversationsCSV()` after line 189
   - Add `generateErrorsCSV()` after conversations generator
   - Add `generateLatencyCSV()` after errors generator
   - Add `generateTrendsCSV()` after latency generator
   - Update `generateCompleteDatasetCSV()` (lines 194-228)

3. **Verification Phase**
   - Run TypeScript compilation
   - Test CSV export in UI
   - Compare with JSON export
   - Test edge cases

4. **Documentation Phase**
   - Update export type descriptions if needed
   - Document new CSV structure
   - Update user-facing docs

---

## Summary

**Problem**: CSV exports only include 5 sections, missing 60% of data available in JSON

**Root Cause**: Missing CSV generators for conversations, errors, latency, trends

**Solution**: Add 4 new generators + update `generateCompleteDatasetCSV()`

**Impact**: CSV exports will have feature parity with JSON exports

**Lines Added**: ~145 lines total
- `generateConversationsCSV()`: ~35 lines
- `generateErrorsCSV()`: ~35 lines
- `generateLatencyCSV()`: ~35 lines
- `generateTrendsCSV()`: ~40 lines
- Updated `generateCompleteDatasetCSV()`: Add ~30 lines (new sections)

**Files Modified**: 1 file
- `/lib/analytics/export/csvGenerator.ts`

**Breaking Changes**: None

**Ready for Implementation**: ✅ YES
