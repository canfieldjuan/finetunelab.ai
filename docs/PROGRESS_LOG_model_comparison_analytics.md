# Progress Log: Side-by-Side Model Comparison & Session Tagging

**Date Started:** 2025-10-15
**Status:** Planning Phase
**Priority:** High (P2)

---

## Overview

Implement side-by-side model comparison analytics with manual session tagging to enable:
1. **Model A/B Testing** - Compare performance of different LLMs side-by-side
2. **Session Management** - Tag and track experimental sessions
3. **Analytics Filtering** - Filter all metrics by model and session

---

## Requirements

### Must Have (P2 - High Priority)
- ✅ Add session_id and experiment_name to conversations table
- ⏳ Create Session Tagging UI in chat interface
- ⏳ Add Model & Session filters to Analytics Dashboard
- ⏳ Implement side-by-side comparison layout (2 columns)
- ⏳ Track model_id throughout chat flow
- ⏳ Update analytics queries to filter by model/session

### Should Have
- ⏳ Session list/management UI
- ⏳ Export comparison data
- ⏳ Highlight significant differences between models

### Explicitly NOT Implementing (Yet)
- ❌ Auto-session generation (manual tagging only)
- ❌ Real-time model switching mid-conversation
- ❌ More than 2-model comparison
- ❌ Statistical significance testing

---

## Implementation Plan

### Phase 1: Database Schema (✅ COMPLETED)
1. ✅ Verify existing llm_model_id columns
2. ✅ Create migration: Add session tracking columns
3. ✅ Add indexes for performance
4. ✅ Run migration in Supabase
5. ✅ Verify schema changes - ALL TESTS PASSED

### Phase 2: Session Tagging UI
1. ⏳ Add session input to Chat interface
2. ⏳ Create SessionManager component
3. ⏳ Add session tagging to new conversations
4. ⏳ Display current session badge
5. ⏳ Persist session in conversation metadata

### Phase 3: Model Tracking Enhancement
1. ⏳ Verify model_id flows to messages table
2. ⏳ Add model_id to API route logging
3. ⏳ Update Chat.tsx to track selected model
4. ⏳ Ensure model_id saved with each message

### Phase 4: Analytics Filter UI
1. ⏳ Create ModelSelector filter component
2. ⏳ Create SessionSelector filter component
3. ⏳ Add filters to AnalyticsDashboard header
4. ⏳ Wire up filter state management

### Phase 5: Update Analytics Queries
1. ⏳ Modify useAnalytics hook to accept filters
2. ⏳ Add model_id filter to queries
3. ⏳ Add session_id filter to queries
4. ⏳ Update all aggregation functions
5. ⏳ Test query performance

### Phase 6: Side-by-Side Layout
1. ⏳ Create ComparisonView component
2. ⏳ Implement 2-column grid layout
3. ⏳ Duplicate all chart components
4. ⏳ Add model labels to each column
5. ⏳ Add "Select Second Model" dropdown

### Phase 7: Comparison Logic
1. ⏳ Load data for both models simultaneously
2. ⏳ Calculate delta/difference metrics
3. ⏳ Highlight wins/losses
4. ⏳ Add comparison summary card

### Phase 8: Testing & Validation
1. ⏳ Test session tagging end-to-end
2. ⏳ Test model filtering with real data
3. ⏳ Test side-by-side with 2 models
4. ⏳ Test with missing data scenarios
5. ⏳ Verify no breaking changes

---

## Files to Create

### New Components
1. `/components/analytics/ModelSelector.tsx` - Model filter dropdown
2. `/components/analytics/SessionSelector.tsx` - Session filter dropdown
3. `/components/analytics/ComparisonView.tsx` - Side-by-side layout container
4. `/components/analytics/ComparisonMetricsCard.tsx` - Delta summary card
5. `/components/chat/SessionManager.tsx` - Session tagging UI

### New Migrations
1. `/docs/schema_updates/11_session_tracking.sql` - Add session columns

---

## Files to Modify

### Database Schema
- **File:** `/docs/schema_updates/11_session_tracking.sql` (NEW)
- **Purpose:** Add session_id and experiment_name to conversations
- **Changes:**
  ```sql
  ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS session_id TEXT,
    ADD COLUMN IF NOT EXISTS experiment_name TEXT;
  ```

### Analytics Hook
- **File:** `/hooks/useAnalytics.ts`
- **Lines:** 22-30, 40-46
- **Purpose:** Add model/session filter parameters
- **Changes:**
  - Add `modelId?: string` to UseAnalyticsParams interface
  - Add `sessionId?: string` to UseAnalyticsParams interface
  - Add `.eq('llm_model_id', modelId)` to queries (if provided)
  - Add `.eq('session_id', sessionId)` to queries (if provided)

### Analytics Dashboard
- **File:** `/components/analytics/AnalyticsDashboard.tsx`
- **Lines:** 25-29 (state), 67-95 (header filters)
- **Purpose:** Add filter dropdowns and comparison mode toggle
- **Changes:**
  - Add `selectedModelId` state
  - Add `selectedSessionId` state
  - Add `comparisonMode` state
  - Add `secondaryModelId` state (for comparison)
  - Render ModelSelector and SessionSelector components
  - Conditionally render ComparisonView vs normal view

### Chat Component
- **File:** `/components/Chat.tsx`
- **Lines:** TBD (need to verify)
- **Purpose:** Add session tagging UI
- **Changes:**
  - Add session input field in header
  - Save session_id when creating conversation
  - Display current session badge

### API Route
- **File:** `/app/api/chat/route.ts`
- **Lines:** 430-442 (message insert)
- **Purpose:** Ensure model_id is saved
- **Changes:**
  - Add llm_model_id to message insert
  - Log model_id for debugging

---

## Database Schema Changes

### Migration 11: Session Tracking

**File:** `/docs/schema_updates/11_session_tracking.sql`

```sql
-- ============================================
-- SESSION TRACKING FOR A/B TESTING
-- Date: 2025-10-15
-- ============================================

-- Add session tracking to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS experiment_name TEXT;

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_conversations_session_id
  ON conversations(session_id) WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_experiment_name
  ON conversations(experiment_name) WHERE experiment_name IS NOT NULL;

-- Verify changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'conversations'
  AND column_name IN ('session_id', 'experiment_name', 'llm_model_id');
```

---

## Exact Code Insertion Points

### 1. useAnalytics Hook - Add Filter Parameters

**File:** `/hooks/useAnalytics.ts`
**Line 22-26:** Modify UseAnalyticsParams interface

```typescript
// CURRENT:
interface UseAnalyticsParams {
  userId: string;
  timeRange?: '7d' | '30d' | '90d' | 'all';
}

// CHANGE TO:
interface UseAnalyticsParams {
  userId: string;
  timeRange?: '7d' | '30d' | '90d' | 'all';
  modelId?: string;  // ADD
  sessionId?: string;  // ADD
}
```

**Line 40-46:** Add filter clauses to queries

```typescript
// CURRENT (line 40-46):
const { data: messages, error: msgError} = await supabase
  .from('messages')
  .select('id, role, created_at, latency_ms, ...')
  .eq('user_id', userId)
  .gte('created_at', dateFilter)
  .order('created_at', { ascending: true });

// CHANGE TO (add conditionals):
let messagesQuery = supabase
  .from('messages')
  .select('id, role, created_at, latency_ms, ...')
  .eq('user_id', userId)
  .gte('created_at', dateFilter);

if (modelId) {
  messagesQuery = messagesQuery.eq('llm_model_id', modelId);
}
if (sessionId) {
  messagesQuery = messagesQuery.eq('conversation_id', conversationId);  // Need to join
}

const { data: messages, error: msgError } = await messagesQuery
  .order('created_at', { ascending: true });
```

### 2. AnalyticsDashboard - Add Filter State

**File:** `/components/analytics/AnalyticsDashboard.tsx`
**Line 25-29:** Add new state variables

```typescript
// CURRENT (line 25-29):
const { user } = useAuth();
const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
const { data, loading, error } = useAnalytics({
  userId: user?.id || '',
  timeRange
});

// CHANGE TO:
const { user } = useAuth();
const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined);  // ADD
const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);  // ADD
const [comparisonMode, setComparisonMode] = useState(false);  // ADD
const [secondaryModelId, setSecondaryModelId] = useState<string | undefined>(undefined);  // ADD

const { data, loading, error } = useAnalytics({
  userId: user?.id || '',
  timeRange,
  modelId: selectedModelId,  // ADD
  sessionId: selectedSessionId  // ADD
});
```

**Line 83-95:** Add filter dropdowns

```typescript
// CURRENT (line 83-95):
{/* Time Range Filter */}
<Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select range" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="7d">Last 7 days</SelectItem>
    <SelectItem value="30d">Last 30 days</SelectItem>
    <SelectItem value="90d">Last 90 days</SelectItem>
    <SelectItem value="all">All time</SelectItem>
  </SelectContent>
</Select>

// ADD AFTER (new filter row):
<div className="flex gap-3 items-center">
  <ModelSelector value={selectedModelId} onChange={setSelectedModelId} userId={user?.id} />
  <SessionSelector value={selectedSessionId} onChange={setSelectedSessionId} userId={user?.id} />
  <Button
    variant={comparisonMode ? "default" : "outline"}
    onClick={() => setComparisonMode(!comparisonMode)}
  >
    {comparisonMode ? "Single View" : "Compare Models"}
  </Button>
</div>
```

### 3. Chat Component - Add Session Tagging

**File:** `/components/Chat.tsx`
**Lines:** TBD - Need to verify current structure

**Insertion Point A:** Add state for session management
```typescript
const [currentSession, setCurrentSession] = useState<{
  sessionId: string | null;
  experimentName: string | null;
}>({ sessionId: null, experimentName: null });
```

**Insertion Point B:** Update conversation creation to include session
```typescript
// In handleSend or new conversation creation:
const { data, error } = await supabase
  .from("conversations")
  .insert({
    user_id: user.id,
    title: "New Chat",
    llm_model_id: selectedModelId,  // ADD
    session_id: currentSession.sessionId,  // ADD
    experiment_name: currentSession.experimentName  // ADD
  })
```

---

## Implementation Guidelines

### Code Standards
- Write in 30-line blocks or complete logic blocks
- Add console.log at key points: `[ModelComparison]`, `[SessionTag]`, `[Analytics]`
- No stub/mock/TODO implementations
- Maintain backward compatibility (filters are optional)
- Verify each phase before proceeding

### Logging Strategy
```typescript
console.log('[Analytics] Filtering by model:', modelId);
console.log('[Analytics] Filtering by session:', sessionId);
console.log('[SessionTag] Created session:', sessionId, experimentName);
console.log('[ModelComparison] Loading data for models:', primaryId, secondaryId);
console.log('[ModelComparison] Comparison delta:', delta);
```

### Backward Compatibility
- All filters are OPTIONAL - existing code works without them
- Model/session filters only apply if provided
- Default view shows all data (current behavior)
- Comparison mode is opt-in toggle

---

## Testing Checklist

### Phase 1: Schema Migration
- [ ] Run migration script
- [ ] Verify columns created
- [ ] Verify indexes created
- [ ] Test RLS policies still work
- [ ] Check migration doesn't break existing data

### Phase 2: Session Tagging
- [ ] Create conversation with session tag
- [ ] Verify session_id saved to database
- [ ] Verify experiment_name saved
- [ ] Test without session tag (should be null)
- [ ] Test session badge displays correctly

### Phase 3: Model Filtering
- [ ] Select model in filter dropdown
- [ ] Verify analytics updates
- [ ] Verify only model's data shown
- [ ] Test with model that has no data
- [ ] Test clearing filter

### Phase 4: Session Filtering
- [ ] Select session in filter dropdown
- [ ] Verify analytics updates
- [ ] Verify only session's data shown
- [ ] Test with session that has no data
- [ ] Test clearing filter

### Phase 5: Side-by-Side Comparison
- [ ] Enable comparison mode
- [ ] Select second model
- [ ] Verify two columns appear
- [ ] Verify data loads for both models
- [ ] Verify comparison deltas correct
- [ ] Test with mismatched data availability

### Phase 6: Edge Cases
- [ ] Test with user that has no conversations
- [ ] Test with conversations missing model_id
- [ ] Test with very large datasets
- [ ] Test filter combinations (model + session + timeRange)
- [ ] Verify no errors in console

---

## Progress Tracking

### Session 1: 2025-10-15 - Phase 1 Complete ✅
- ✅ Created comprehensive implementation plan
- ✅ Verified existing schema has llm_model_id columns
- ✅ Identified exact files and insertion points
- ✅ Created migration script (11_session_tracking.sql)
- ✅ Created verification script (verify-session-migration.ts)
- ✅ Created execution steps documentation
- ✅ Analyzed code impact: NO breaking changes
- ✅ Grep search: NO existing usage of new columns
- ✅ Query pattern analysis: All queries are SAFE
- ✅ Risk assessment: NONE - backward compatible
- ✅ Executed migration in Supabase
- ✅ Verified schema changes - ALL 5 TESTS PASSED
- ✅ Confirmed server still running (no errors)
- ✅ Confirmed 15 columns in conversations table
- ✅ Confirmed 2 existing conversations intact
- ⏳ Next: Phase 2 - Session Tagging UI

---

## Notes & Decisions

### Decision Log
1. **Side-by-side layout (Option A)** - Two columns showing metrics for each model
2. **Manual session tagging** - User explicitly names experiments
3. **Optional filters** - Backward compatible, filters only apply when selected
4. **Max 2 models** - Keep comparison simple, scalable to 3+ later if needed
5. **Session in conversations table** - Simpler than separate experiments table

### Technical Decisions
1. **Query approach**: Filter at database level, not client-side aggregation
2. **UI pattern**: Filters above dashboard, comparison toggle button
3. **State management**: Local component state (no Redux/Zustand needed yet)
4. **Chart duplication**: Render same components twice with different data props

### Open Questions
- None yet - will emerge during implementation

### Risks & Mitigation
- **Risk:** Queries become slow with multiple filters
  - **Mitigation:** Indexes on model_id and session_id, monitor query performance
- **Risk:** Users forget to tag sessions
  - **Mitigation:** Prominent UI, save last session as default
- **Risk:** Model comparison shows insignificant differences
  - **Mitigation:** Add "confidence" indicators, show sample size
- **Risk:** Breaking existing analytics
  - **Mitigation:** All filters optional, test without filters first

---

## Next Steps

### Immediate (Phase 1)
1. Verify current database has llm_model_id in conversations and messages
2. Create and run migration script for session_id and experiment_name
3. Verify migration successful
4. Create ModelSelector component (read-only, show available models)
5. Create SessionSelector component (read-only, show available sessions)

### Then (Phase 2)
1. Add session tagging UI to Chat component
2. Wire up session_id saving in conversation creation
3. Test session tagging end-to-end

### Then (Phase 3-6)
1. Implement analytics filtering
2. Build side-by-side layout
3. Comprehensive testing

---

**Last Updated:** 2025-10-15
**Next Session:** Begin Phase 1 - Database Migration
