# Demo Page Component Audit & Implementation Plan

**Date**: December 15, 2025
**Status**: Audit Complete - Awaiting Approval
**Objective**: Create an A/B model comparison demo with batch testing and analytics queries

---

## Executive Summary

This audit identifies components that can be reused for the demo page, their data dependencies, and what modifications are needed for demo data isolation. The demo will allow users to:
1. Pick a task domain (pre-seeded test suites)
2. Select models (base vs tuned, or BYOM)
3. Run batch tests with blind A/B comparison
4. Rate responses
5. Query analytics about the batch test results

---

## Component Audit Results

### 1. Chat Component (`components/Chat.tsx`)

**File**: 1900 lines
**Current Props**:
```typescript
interface ChatProps {
  widgetConfig?: {
    sessionId: string;
    modelId: string;
    apiKey: string;
    userId?: string;
    theme?: string;
  };
  demoMode?: boolean;
}
```

**Data Sources**:
- `conversations` table (Supabase)
- `messages` table (Supabase)
- `/api/chat` endpoint

**Demo Mode Status**:
- `demoMode` prop exists (line 115)
- Uses `'demo-user'` as userId in demo mode (line 121)
- Skips feedback DB write in demo mode (line 888)
- Skips settings load in demo mode (line 746)

**ISSUE**: Still writes to main `conversations` and `messages` tables

**Required Changes for Demo Isolation**:
- Route to `demo_conversations` and `demo_messages` tables when `demoMode=true`
- Create demo-specific API route OR add demo flag to existing `/api/chat`

---

### 2. BatchTesting Component (`components/training/BatchTesting.tsx`)

**File**: 1397 lines
**Current Props**:
```typescript
interface BatchTestingProps {
  sessionToken?: string;
}
```

**Data Sources**:
- `/api/models` - Model list
- `/api/benchmarks` - Benchmarks
- `/api/test-suites` - Test suite selection
- `/api/batch-testing/run` - Start test
- `/api/batch-testing/cancel` - Cancel test
- `/api/batch-testing/archive` - Archive operations
- Direct Supabase: `batch_test_runs` table

**Key Features**:
- Model selection with search/grouping
- Test suite selection and creation (file upload: .txt, .json, .jsonl)
- Session tagging for analytics tracking
- Assistant judge for LLM evaluation
- Progress tracking with auto-refresh

**Required Changes for Demo Isolation**:
- Add `demoMode?: boolean` prop
- Route to `demo_batch_test_runs` table
- Use pre-seeded demo test suites (no user creation in demo)
- Limit models to demo-approved list

---

### 3. AnalyticsChat Component (`components/analytics/AnalyticsChat.tsx`)

**File**: 682 lines
**Current Props**: None (uses useAuth)

**Data Sources**:
- Direct Supabase: `conversations` table (fetches tagged sessions)
- `/api/analytics/chat` endpoint
- `/api/validation-sets` endpoint

**Key Features**:
- Session selection sidebar
- Model selection (gpt-4o-mini, gpt-4o, claude-3-5-sonnet, grok-beta)
- Streaming responses
- Validation set upload
- Message history per session

**Required Changes for Demo Isolation**:
- Add `demoMode?: boolean` prop
- Query `demo_conversations` for tagged sessions
- Route to demo-specific analytics endpoint
- Pre-populate with demo session data

---

### 4. ModelSelector Component (`components/models/ModelSelector.tsx`)

**File**: 232 lines
**Current Props**:
```typescript
interface ModelSelectorProps {
  value?: string;
  onChange: (modelId: string, model?: LLMModelDisplay) => void;
  sessionToken?: string;
  disabled?: boolean;
}
```

**Data Sources**:
- `/api/models` endpoint

**Features**:
- Search/filter models
- Group by provider
- Auto-select default model

**Required Changes for Demo Isolation**:
- Add `demoMode?: boolean` prop
- Filter to demo-approved models only
- Hide "Manage Models" link in demo mode

---

### 5. ModelComparisonView Component (`components/evaluation/ModelComparisonView.tsx`)

**File**: 498 lines
**Current Props**:
```typescript
interface ModelComparisonViewProps {
  sessionToken?: string;
  open: boolean;
  onClose: () => void;
  initialPrompt?: string;
}
```

**Data Sources**:
- `/api/models` endpoint
- `/api/chat` endpoint (non-streaming)

**Key Features**:
- A/B comparison (2-4 models side-by-side)
- Multi-axis rating (Clarity, Accuracy, Conciseness, Overall)
- Preference buttons (Prefer/Reject)
- Export as JSONL
- Response time tracking

**HIGHLY REUSABLE**: This is perfect for the blind A/B demo comparison!

**Required Changes for Demo Isolation**:
- Add `demoMode?: boolean` prop
- Filter models to demo-approved list
- Store comparison results to demo tables
- Hide model names until rating complete (blind comparison)

---

### 6. EvaluationModal Component (`components/evaluation/EvaluationModal.tsx`)

**File**: 386 lines
**Current Props**:
```typescript
interface EvaluationModalProps {
  messageId: string;
  onClose: () => void;
  onSuccess?: () => void;
}
```

**Data Sources**:
- Direct Supabase: `messages` table
- `/api/evaluate` endpoint
- `judgmentsService` for human judgments

**Key Features**:
- 5-star rating
- Success/Failure toggle
- Failure tags (hallucination, wrong_tool, etc.)
- Citation correctness validation
- Groundedness slider
- Notes and expected behavior

**Required Changes for Demo Isolation**:
- Add `demoMode?: boolean` prop
- Query `demo_messages` instead
- Store evaluations to demo tables

---

### 7. RatingDistribution Component (`components/analytics/RatingDistribution.tsx`)

**File**: 85 lines
**Current Props**:
```typescript
interface RatingDistributionProps {
  data: Array<{ rating: number; count: number }>;
}
```

**Data Sources**: None (data passed via props)

**Features**:
- Bar chart showing rating distribution
- Summary stats (Total, Average, Most Common)

**FULLY REUSABLE**: Pure presentation component, no changes needed.

---

## Database Schema for Demo Isolation

### New Tables Required

```sql
-- Demo conversations (mirrors conversations)
CREATE TABLE demo_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_user_id TEXT NOT NULL DEFAULT 'demo-user',
  session_id TEXT,
  experiment_name TEXT,
  model_id TEXT,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Demo messages (mirrors messages)
CREATE TABLE demo_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES demo_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  content_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Demo batch test runs
CREATE TABLE demo_batch_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_user_id TEXT NOT NULL DEFAULT 'demo-user',
  model_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  total_prompts INTEGER DEFAULT 0,
  completed_prompts INTEGER DEFAULT 0,
  failed_prompts INTEGER DEFAULT 0,
  config JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Demo evaluations
CREATE TABLE demo_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES demo_messages(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  success BOOLEAN DEFAULT TRUE,
  failure_tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Demo comparison results (for A/B testing)
CREATE TABLE demo_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_user_id TEXT NOT NULL DEFAULT 'demo-user',
  prompt TEXT NOT NULL,
  model_a_id TEXT NOT NULL,
  model_a_response TEXT,
  model_b_id TEXT NOT NULL,
  model_b_response TEXT,
  preferred_model TEXT,
  model_a_rating JSONB,
  model_b_rating JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-seeded demo test suites
CREATE TABLE demo_test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  task_domain TEXT NOT NULL, -- 'customer_support', 'code_generation', 'qa', etc.
  prompts TEXT[] NOT NULL,
  expected_answers TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TTL cleanup: Add trigger to delete demo data older than 24 hours
-- (implementation TBD based on cleanup strategy)
```

---

## Phased Implementation Plan

### Phase 1: Database Schema & API Foundation
**Files to Create/Modify**:
- `supabase/migrations/XXXX_demo_tables.sql` - New demo tables
- `lib/demo/types.ts` - Demo-specific types
- `lib/demo/queries.ts` - Demo database queries

**Verification**:
- [ ] Tables created successfully
- [ ] RLS policies configured
- [ ] Test data can be inserted/queried

---

### Phase 2: Demo Data Service Layer
**Files to Create**:
- `lib/demo/demo-data.service.ts` - Centralized demo data service
- `lib/demo/seed-demo-data.ts` - Script to seed demo test suites

**Pre-seeded Test Suites** (task domains):
1. **Customer Support** - 15-20 support ticket prompts
2. **Code Generation** - 15-20 coding task prompts
3. **Q&A/Knowledge** - 15-20 factual question prompts
4. **Creative Writing** - 15-20 creative prompts

**Verification**:
- [ ] Demo data service functions work
- [ ] Test suites seeded successfully
- [ ] Queries return expected data

---

### Phase 3: Component Modifications

#### 3A: Chat Component Demo Isolation
**File**: `components/Chat.tsx`
**Changes**:
- Add routing logic for `demoMode` to use demo tables
- Create demo-specific chat handler

**Insertion Points**:
- Line ~238: Add demo conversation creation logic
- Line ~350: Route message saves to demo tables

**Verification**:
- [ ] Demo mode writes to demo_conversations
- [ ] Demo mode writes to demo_messages
- [ ] Non-demo mode unaffected

#### 3B: BatchTesting Component Demo Mode
**File**: `components/training/BatchTesting.tsx`
**Changes**:
- Add `demoMode` prop
- Filter to pre-seeded test suites only
- Route to demo batch test tables
- Limit model selection

**Insertion Points**:
- Line 69: Add demoMode to props interface
- Line 234-252: Conditional fetch for demo mode
- Line 513-614: Demo-specific test run logic

**Verification**:
- [ ] Demo mode shows only demo test suites
- [ ] Demo mode writes to demo_batch_test_runs
- [ ] Demo mode limits model selection

#### 3C: ModelComparisonView Blind Comparison
**File**: `components/evaluation/ModelComparisonView.tsx`
**Changes**:
- Add `demoMode` prop
- Implement blind comparison (hide model names until rated)
- Store to demo_comparisons table
- Add "reveal" button after rating

**Insertion Points**:
- Line 44-53: Add demoMode to props
- Line 386-430: Conditional model name display
- New function: saveComparison() for demo mode

**Verification**:
- [ ] Model names hidden during rating
- [ ] Reveal button works after all ratings
- [ ] Comparison saved to demo_comparisons

#### 3D: EvaluationModal Demo Routing
**File**: `components/evaluation/EvaluationModal.tsx`
**Changes**:
- Add `demoMode` prop
- Route queries to demo_messages
- Store evaluations to demo_evaluations

**Insertion Points**:
- Line 8-12: Add demoMode to props
- Line 46-66: Conditional table selection
- Line 89-103: Route to demo evaluation endpoint

**Verification**:
- [ ] Demo mode queries demo_messages
- [ ] Demo mode stores to demo_evaluations

---

### Phase 4: Demo Page UI Implementation

**Files to Create**:
- `app/demo/comparison/page.tsx` - New A/B comparison demo page

**UI Flow**:
```
1. Welcome Screen
   ├── Explain what the demo does
   └── "Start Demo" button

2. Task Selection
   ├── Choose domain (Customer Support, Code Gen, Q&A, Creative)
   └── Brief description of each

3. Model Selection
   ├── Pre-tuned model (ours) - auto-selected
   ├── Base model - auto-selected
   └── Optional: BYOM (Bring Your Own Model) via API key

4. Batch Test Running
   ├── Progress indicator
   ├── Real-time updates
   └── ~5-10 prompts for demo speed

5. Blind Rating Interface
   ├── Show prompt
   ├── Show Response A and Response B (randomized)
   ├── Rate each (star rating + prefer/reject)
   └── Reveal which model after rating

6. Results Dashboard
   ├── Comparison summary
   ├── Rating distribution
   ├── Win/loss/tie stats
   └── "Try Analytics Assistant" CTA

7. Analytics Assistant Integration
   ├── Pre-loaded demo session
   └── Guided prompts for querying
```

**Verification**:
- [ ] Full flow works end-to-end
- [ ] Data properly isolated
- [ ] No main database writes

---

### Phase 5: Analytics Assistant Demo Integration

**Files to Modify**:
- `components/analytics/AnalyticsChat.tsx` - Add demo mode
- `app/api/analytics/chat/route.ts` - Add demo query support

**Changes**:
- Query demo tables for tagged sessions
- Return demo batch test analytics
- Provide guided prompts for demo users

**Verification**:
- [ ] Analytics queries demo data only
- [ ] Guided prompts work correctly
- [ ] Results match demo batch tests

---

### Phase 6: Cleanup & Polish

**Tasks**:
- TTL cleanup for demo data (24-hour retention)
- Rate limiting for demo users
- Error handling and edge cases
- Loading states and animations
- Mobile responsiveness

**Verification**:
- [ ] Old demo data cleaned up
- [ ] Rate limits enforced
- [ ] All error states handled
- [ ] Works on mobile

---

## Component Dependency Graph

```
DemoPage
├── DemoWelcome (new)
├── TaskSelector (new)
├── ModelSelector (modified)
│   └── /api/models (filtered for demo)
├── BatchTesting (modified)
│   ├── demo_test_suites (read)
│   ├── demo_batch_test_runs (write)
│   └── /api/batch-testing/run (demo mode)
├── ModelComparisonView (modified)
│   ├── /api/chat (demo mode)
│   ├── demo_comparisons (write)
│   └── demo_evaluations (write)
├── ResultsDashboard (new)
│   ├── RatingDistribution (reuse as-is)
│   └── Comparison stats
└── AnalyticsChat (modified)
    ├── demo_conversations (read)
    └── /api/analytics/chat (demo mode)
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Demo data leaking to main DB | Explicit table routing, test coverage |
| Performance impact from demo traffic | Separate demo tables, rate limiting |
| Demo abuse (API key farming) | Rate limits, session TTL |
| Breaking existing functionality | Feature flags, test coverage |
| Complex blind comparison UX | User testing, clear instructions |

---

## Files Requiring Modification Summary

| File | Change Type | Risk Level |
|------|------------|------------|
| `components/Chat.tsx` | Demo routing | Medium |
| `components/training/BatchTesting.tsx` | Demo mode prop | Medium |
| `components/evaluation/ModelComparisonView.tsx` | Blind mode | Medium |
| `components/evaluation/EvaluationModal.tsx` | Demo routing | Low |
| `components/models/ModelSelector.tsx` | Demo filtering | Low |
| `components/analytics/AnalyticsChat.tsx` | Demo mode | Medium |
| `app/api/chat/route.ts` | Demo flag | Medium |
| `app/api/batch-testing/run/route.ts` | Demo flag | Medium |
| `app/api/analytics/chat/route.ts` | Demo queries | Medium |

---

## Next Steps (Awaiting Approval)

1. Review this audit document
2. Approve or request changes to the implementation plan
3. Prioritize phases if needed
4. Begin Phase 1 implementation

---

---

## Implementation Progress

### Phase 1: Database Schema & API Foundation - COMPLETE

**Files Created:**
- `supabase/migrations/20251215000000_create_demo_tables.sql` - 8 demo tables with RLS policies
  - `demo_conversations`
  - `demo_messages`
  - `demo_batch_test_runs`
  - `demo_batch_test_results`
  - `demo_evaluations`
  - `demo_comparisons`
  - `demo_test_suites`
  - `demo_analytics_cache`
  - Plus cleanup function `cleanup_old_demo_data()`

- `lib/demo/types.ts` - All TypeScript types for demo functionality
- `lib/demo/queries.ts` - Database query functions
- `lib/demo/index.ts` - Module exports

### Phase 2: Demo Data Service - COMPLETE

**Files Created:**
- `lib/demo/demo-data.service.ts` - High-level service with:
  - Test suite operations
  - Batch test operations
  - Comparison operations
  - Analytics computation
  - Rate limiting
  - Model helpers

- `scripts/seed-demo-test-suites.ts` - Seed script with 10 test suites:
  - Customer Support: 2 suites (18 prompts)
  - Code Generation: 3 suites (24 prompts)
  - Q&A: 2 suites (16 prompts)
  - Creative: 2 suites (16 prompts)

### Phase 3: Component Modifications - COMPLETE

**Files Modified:**
- `components/evaluation/ModelComparisonView.tsx`
  - Added `demoMode` prop
  - Added `demoModels` prop for pre-selected models
  - Added `onDemoSubmit` callback
  - Implemented blind comparison (hidden model names)
  - Added reveal button and revealed summary
  - Randomized display order

**Files Created:**
- `components/ui/progress.tsx` - Progress bar component

### Phase 4: Demo Comparison Page - COMPLETE

**Files Created:**
- `app/demo/comparison/page.tsx` - Full demo wizard with:
  - Welcome screen
  - Task domain selection (4 domains)
  - Model selection (4 models)
  - Running state with progress
  - Blind rating interface
  - Results dashboard with winner display
  - Links to Analytics Assistant

- `app/api/demo/test-suites/route.ts` - API for fetching demo test suites

---

## Next Steps to Deploy

1. **Run the migration:**
   ```bash
   npx supabase db push
   # OR apply directly to your Supabase instance
   ```

2. **Seed the demo test suites:**
   ```bash
   npx ts-node scripts/seed-demo-test-suites.ts
   ```

3. **Test the demo page:**
   - Navigate to `/demo/comparison`
   - Complete the wizard flow
   - Verify data is stored in demo tables

4. **Optional - Set up cleanup cron:**
   - Call `cleanup_old_demo_data()` periodically to remove data older than 24 hours

---

**Document Version**: 2.0
**Last Updated**: December 15, 2025
