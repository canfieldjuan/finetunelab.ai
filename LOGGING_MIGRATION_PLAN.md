# Logging Migration Progress & Plan

## ✅ Completed Components

### 1. Chat.tsx (100% Complete)
- **103 logs migrated**
- All console.log/error/warn statements replaced
- Zero new TypeScript errors introduced
- Status: Production-ready

### 2. BatchTesting.tsx (30% Complete - In Progress)
- **13 of 41 logs migrated**
- Import added: `import { log } from '@/lib/utils/logger';`
- Completed sections:
  - Component mount (1 log)
  - useEffect hooks (4 logs)
  - fetchModels (5 logs)
  - fetchBenchmarks (3 logs)
- Remaining: 28 logs in test operations and UI handlers

## 🔄 High Priority Components (Breakage Risk)

### Critical Components to Migrate:

1. **BatchTesting.tsx** (PARTIALLY DONE)
   - Total logs: 41
   - Migrated: 13
   - Remaining: 28
   - Priority: HIGH (complex state, frequent API calls)
   - Sections remaining:
     ```
     - fetchTestRuns (3 logs)
     - getFilteredModels (3 logs)
     - startBatchTest (4 logs)
     - cancelTest (4 logs)
     - getValidatorBreakdown (4 logs)
     - Component loaded (1 log)
     - UI event handlers (~9 logs)
     ```

2. **AnomalyFeed.tsx** (NOT STARTED)
   - Total logs: 22
   - Module: Analytics
   - Priority: HIGH (authentication, real-time data)
   - Key sections:
     - fetchAnomalies (9 logs)
     - acknowledgeAnomaly (6 logs)
     - Auto-refresh (4 logs)
     - Initial load (3 logs)

3. **AddModelDialog.tsx** (NOT STARTED)
   - Total logs: 10
   - Module: Settings
   - Priority: MEDIUM (model configuration)
   - Key sections:
     - testConnection (5 logs)
     - createModel (4 logs)
     - Template selection (1 log)

4. **ModelSelector.tsx** (NOT STARTED)
   - Total logs: 5
   - Module: Settings
   - Priority: HIGH (core functionality)
   - All logs in fetchModels and onChange

## 📋 Migration Commands (Copy-Paste Ready)

### For BatchTesting.tsx (Remaining logs):

```typescript
// 1. Fetch test runs
Replace:
console.log('[BatchTesting] Found', data?.length || 0, 'test runs');
console.error('[BatchTesting] Error fetching test runs:', err);

With:
log.debug('BatchTesting', 'Test runs loaded', { count: data?.length || 0 });
log.error('BatchTesting', 'Error fetching test runs', { error: err });

// 2. Filter models
Replace:
console.log('[BatchTesting] getFilteredModels called, total models:', models.length, 'search:', modelSearch);
console.log('[BatchTesting] No search filter, returning all', models.length, 'models');
console.log('[BatchTesting] Filtered models:', filtered.length, 'of', models.length);
console.log('[BatchTesting] Grouped into', Object.keys(grouped).length, 'providers');

With:
log.trace('BatchTesting', 'Filtering models', { totalModels: models.length, search: modelSearch });
log.trace('BatchTesting', 'No search filter, returning all models', { count: models.length });
log.debug('BatchTesting', 'Models filtered', { filtered: filtered.length, total: models.length });
log.debug('BatchTesting', 'Models grouped by provider', { providerCount: Object.keys(grouped).length });

// 3. Start test
Replace:
console.log('[BatchTesting] Starting batch test', { ... });
console.error('[BatchTesting] Non-JSON error response:', text.substring(0, 200));
console.log('[BatchTesting] Batch test started:', data.test_run_id);
console.error('[BatchTesting] Start error:', err);

With:
log.debug('BatchTesting', 'Starting batch test', { modelId: selectedModelId, benchmarkId, numPrompts: promptLimit });
log.error('BatchTesting', 'Non-JSON error response', { preview: text.substring(0, 200) });
log.debug('BatchTesting', 'Batch test started successfully', { testRunId: data.test_run_id });
log.error('BatchTesting', 'Error starting test', { error: err });

// 4. Cancel test
Replace:
console.log('[BatchTesting] Cancelling test run:', testRunId);
console.error('[BatchTesting] Non-JSON error response:', text.substring(0, 200));
console.log('[BatchTesting] Test cancelled successfully');
console.error('[BatchTesting] Cancel error:', err);

With:
log.debug('BatchTesting', 'Cancelling test run', { testRunId });
log.error('BatchTesting', 'Non-JSON cancel response', { preview: text.substring(0, 200) });
log.debug('BatchTesting', 'Test cancelled successfully');
log.error('BatchTesting', 'Error cancelling test', { error: err });

// 5. Validator breakdown
Replace:
console.log('[BatchTesting] Fetching validator breakdown for:', testRunId);
console.warn('[BatchTesting] Failed to fetch validator breakdown:', response.status);
console.log('[BatchTesting] Validator breakdown:', data);
console.error('[BatchTesting] Error fetching validator breakdown:', err);

With:
log.debug('BatchTesting', 'Fetching validator breakdown', { testRunId });
log.warn('BatchTesting', 'Failed to fetch validator breakdown', { status: response.status });
log.debug('BatchTesting', 'Validator breakdown loaded', { breakdown: data });
log.error('BatchTesting', 'Error fetching validator breakdown', { error: err });

// 6. Component loaded (REMOVE - unnecessary noise)
Remove:
console.log('[BatchTesting] Component loaded');
```

### For AnomalyFeed.tsx:

```typescript
// First, add import:
import { log } from '@/lib/utils/logger';

// Then replace all 22 logs with structured equivalents:
// Authentication logs use ERROR/WARN
// Fetch logs use DEBUG
// Auto-refresh logs use TRACE
```

### For ModelSelector.tsx:

```typescript
// Add import
import { log } from '@/lib/utils/logger';

// Replace 5 logs:
console.log('[ModelSelector] Fetching models, authenticated:', !!sessionToken);
→ log.debug('ModelSelector', 'Fetching models', { authenticated: !!sessionToken });

console.log('[ModelSelector] Loaded', data.models.length, 'models');
→ log.debug('ModelSelector', 'Models loaded', { count: data.models.length });

console.error('[ModelSelector] Error fetching models:', errorMessage);
→ log.error('ModelSelector', 'Error fetching models', { error: errorMessage });

console.log('[ModelSelector] Model changed:', { ... });
→ log.debug('ModelSelector', 'Model changed', { modelId, name: model.name, provider: model.provider });

console.log('[ModelSelector] Component loaded'); // REMOVE
```

## 🎯 Quick Win Components (Low effort, high impact)

### Already identified in grep:
1. **Pricing.tsx** - 3 logs (simple component)
2. **WidgetAppsManagement.tsx** - 8 logs (settings feature)
3. **DatasetList.tsx** - 5 logs (training feature)
4. **ModelCard.tsx** - 3 logs (UI component)

## 📊 Migration Statistics

### Overall Progress:
- **Completed**: 116 logs (Chat.tsx: 103 + BatchTesting partial: 13)
- **Identified**: ~300+ logs across components
- **Completion**: ~38% of identified critical components

### Log Level Distribution (Target):
- **ERROR**: Critical failures, API errors
- **WARN**: Degraded functionality, fallbacks
- **DEBUG**: Normal operations, state changes
- **TRACE**: Very verbose, high-frequency operations
- **INFO**: Production events (rarely used)

## 🚀 Next Steps

1. **Complete BatchTesting.tsx** (28 logs remaining)
   - Copy-paste replacements from above
   - Test: `npm run dev` and verify
   - Estimated time: 10 minutes

2. **Migrate AnomalyFeed.tsx** (22 logs)
   - Authentication-heavy component
   - Use ERROR for auth failures
   - Estimated time: 15 minutes

3. **Quick wins batch** (19 logs total)
   - Pricing, ModelCard, DatasetList, WidgetApps
   - Simple components, low risk
   - Estimated time: 10 minutes

4. **ModelSelector.tsx** (5 logs)
   - Core functionality
   - High usage component
   - Estimated time: 5 minutes

## 🔧 Testing Checklist

After each migration:
- [ ] `npx tsc --noEmit <filename>` - Check TypeScript errors
- [ ] `npm run dev` - Verify app loads
- [ ] Browser console - Confirm structured logs appear
- [ ] Test filtering: `localStorage.setItem('log:level', 'ERROR')`
- [ ] Test module filter: `localStorage.setItem('log:modules', 'Settings,Training')`

## 📝 Notes

- Always import: `import { log } from '@/lib/utils/logger';`
- Remove "Component loaded" logs (unnecessary noise)
- Use structured data: `{ key: value }` not string concatenation
- Appropriate log levels prevent production noise
- TRACE for high-frequency operations (can be filtered)

## 🎉 Success Metrics

- Zero new TypeScript errors introduced
- All components compile successfully
- Page loads without runtime errors
- Structured logs appear in browser console
- Runtime filtering works (localStorage config)
- Production logs cleanly filterable
