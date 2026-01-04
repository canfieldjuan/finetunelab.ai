# BYOM Demo - Atlas Integration & Auth Implementation Plan

**Date:** 2026-01-01
**Status:** 🔵 PLANNING - Awaiting User Approval
**Scope:** Major architectural change to BYOM demo page
**Author:** Claude (Sonnet 4.5)

---

## Executive Summary

Transform the BYOM demo from anonymous sandbox into authenticated onboarding experience with production Atlas assistant. This enables users to analyze their batch test results using the real Atlas AI assistant instead of their own model.

### Key Changes
1. **Soft Registration** - Email/password after batch test (Step 4.5)
2. **Real Atlas Integration** - Replace Step 5 with production Atlas assistant
3. **Analytics Dashboard** - New Step 6 shows traces & analytics
4. **Export Step** - Moved to Step 7 with enhanced capabilities

### Critical Concern Addressed
**Atlas Data Access:** Comprehensive plan to ensure Atlas can only see user's own demo batch test data through proper authentication and database scoping.

---

## Current State Analysis

### Phase 0 Discovery - COMPLETED ✅

#### Atlas Implementation Verified
- **Location:** `/components/analytics/AnalyticsChat.tsx`
- **Requires:** Authenticated user via `AuthContext`
- **Data Access:** Calls `/api/analytics/chat` with user's auth token
- **Tools Available:** 11 tools (traces, eval metrics, training metrics, etc.)
- **User Scoping:** All queries filter by `user.id` automatically

#### Auth System Verified
- **Context:** `/contexts/AuthContext.tsx`
- **Provider:** Supabase Auth
- **Features:** Email/password, OAuth (GitHub/Google), SSO
- **Session Management:** Automatic token refresh
- **User Data:** `user.id`, `user.email`, `session.access_token`

#### Analytics Pages Exist
- **Main:** `/app/analytics/page.tsx`
- **Chat (Atlas):** `/app/analytics/chat/page.tsx`
- **Traces:** `/app/analytics/traces/page.tsx`
- **Exports:** `/app/analytics/exports/page.tsx`

#### Current Demo Data Flow (BROKEN)
```
Step 1: Welcome
Step 2: Task Selection (domain)
Step 3: Model Config (user's API key)
Step 4: Batch Test Execution
  └─> Writes to: demo_batch_test_runs ✅
  └─> Writes to: demo_batch_test_results ❌ (FAILS - missing columns)
Step 5: DemoAtlasChat (uses user's model)
Step 6: Export
```

**Problem Identified:**
- `demo_batch_test_results` table missing `input_tokens` and `output_tokens` columns
- INSERT operations fail silently
- No results stored → metrics show zeros

---

## Critical Data Access Concern - SOLUTION

### The Challenge
**Question:** How does Atlas see demo user's batch test data securely?

### Current Atlas Data Access Pattern
```typescript
// /components/analytics/AnalyticsChat.tsx:67-72
const { data } = await supabase
  .from('conversations')
  .select('id, session_id, experiment_name')
  .eq('user_id', user.id)  // ✅ USER SCOPING
  .not('session_id', 'is', null)
  .not('experiment_name', 'is', null)
```

**Atlas fetches data filtered by authenticated user's ID.**

### Demo Tables - Current State (INSECURE)
```sql
-- demo_batch_test_runs
CREATE TABLE demo_batch_test_runs (
  id UUID PRIMARY KEY,
  demo_user_id TEXT DEFAULT 'demo-user',  -- ❌ NOT REAL USER
  demo_session_id TEXT,
  -- NO user_id column! ❌
);

-- demo_batch_test_results
CREATE TABLE demo_batch_test_results (
  id UUID PRIMARY KEY,
  test_run_id UUID,
  demo_session_id TEXT,
  -- NO user_id column! ❌
);
```

### SOLUTION: Add User ID + RLS Policies

#### Step 1: Add user_id columns
```sql
-- Migration: 20260101_add_user_id_to_demo_tables.sql
ALTER TABLE demo_batch_test_runs
  ADD COLUMN user_id UUID REFERENCES auth.users(id);

ALTER TABLE demo_batch_test_results
  ADD COLUMN user_id UUID REFERENCES auth.users(id);

ALTER TABLE demo_model_configs
  ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Index for fast lookups
CREATE INDEX idx_demo_batch_test_runs_user_id
  ON demo_batch_test_runs(user_id);

CREATE INDEX idx_demo_batch_test_results_user_id
  ON demo_batch_test_results(user_id);
```

#### Step 2: Update RLS Policies (CRITICAL FOR SECURITY)
```sql
-- Drop old public access policies
DROP POLICY IF EXISTS "demo_batch_test_runs_public_access" ON demo_batch_test_runs;
DROP POLICY IF EXISTS "demo_batch_test_results_public_access" ON demo_batch_test_results;

-- Add user-scoped policies
CREATE POLICY "demo_batch_test_runs_user_access"
  ON demo_batch_test_runs
  FOR ALL
  USING (user_id = auth.uid())  -- ✅ ONLY SEE OWN DATA
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "demo_batch_test_results_user_access"
  ON demo_batch_test_results
  FOR ALL
  USING (user_id = auth.uid())  -- ✅ ONLY SEE OWN DATA
  WITH CHECK (user_id = auth.uid());
```

#### Step 3: Atlas Tool Extension
**New Tool:** `demo_batch_test_traces`

```typescript
// /lib/tools/analytics/demo-traces.handler.ts (NEW FILE)
export async function executeDemoBatchTestTraces(
  args: DemoTracesArgs,
  userId: string,  // ✅ REQUIRED
  authHeader: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ✅ ALWAYS FILTER BY userId
  const { data, error } = await supabase
    .from('demo_batch_test_results')
    .select('*')
    .eq('user_id', userId)  // ✅ USER SCOPING
    .eq('demo_session_id', args.session_id);

  return formatDemoTraces(data);
}
```

**Add to analyticsTools array:**
```typescript
{
  type: 'function',
  function: {
    name: 'demo_batch_test_traces',
    description: 'Get traces from user\'s BYOM demo batch tests',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Demo session ID' },
        limit: { type: 'number', description: 'Max results' }
      }
    }
  }
}
```

---

## Implementation Phases

### Phase 1: Fix Foundation (Token Storage Bug)
**Priority:** CRITICAL
**Estimated Time:** 30 minutes
**Dependencies:** None

#### 1.1: Create Database Migration
**File:** `/supabase/migrations/20260101_add_token_columns.sql`

```sql
-- Add missing token columns to demo_batch_test_results
ALTER TABLE demo_batch_test_results
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER;

COMMENT ON COLUMN demo_batch_test_results.input_tokens IS
  'Number of input tokens sent to model';
COMMENT ON COLUMN demo_batch_test_results.output_tokens IS
  'Number of output tokens generated by model';
```

#### 1.2: Verify Fix
**Test Plan:**
1. Run migration against Supabase
2. Trigger new batch test
3. Verify results are stored: `SELECT * FROM demo_batch_test_results WHERE demo_session_id = ?`
4. Verify metrics show non-zero values

**Success Criteria:**
- ✅ All 10 prompts have stored results
- ✅ `latency_ms` shows actual latencies
- ✅ `input_tokens` and `output_tokens` populated
- ✅ Success rate shows correct percentage

**Files to Verify Won't Break:**
- `/app/api/demo/v2/batch-test/route.ts` (INSERT statement)
- `/lib/demo/demo-analytics.service.ts` (metrics calculation)

---

### Phase 2: Add Authentication
**Priority:** HIGH
**Estimated Time:** 2 hours
**Dependencies:** Phase 1 complete

#### 2.1: Registration Modal Component
**File:** `/components/demo/DemoRegistrationModal.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function DemoRegistrationModal({
  onComplete,
  sessionData
}: {
  onComplete: () => void;
  sessionData: { session_id: string; test_run_id: string }
}) {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const authFn = mode === 'signup' ? signUp : signIn;
    const { error } = await authFn(email, password);

    if (error) {
      setError(error);
    } else {
      // Migrate anonymous session data to authenticated user
      await migrateSessionData(sessionData);
      onComplete();
    }
  };

  return (
    // Modal UI implementation
  );
}
```

**Migration API:**
```typescript
// /app/api/demo/migrate-session/route.ts (NEW)
export async function POST(req: NextRequest) {
  const { session_id } = await req.json();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Update demo_batch_test_runs with user_id
  await supabase
    .from('demo_batch_test_runs')
    .update({ user_id: user.id })
    .eq('demo_session_id', session_id);

  // Update demo_batch_test_results with user_id
  await supabase
    .from('demo_batch_test_results')
    .update({ user_id: user.id })
    .eq('demo_session_id', session_id);

  return NextResponse.json({ success: true });
}
```

#### 2.2: Update Demo Flow
**File:** `/app/demo/test-model/page.tsx`

**Changes:**
```typescript
// Add new step between batch_test and atlas_chat
type DemoStep = 'welcome' | 'task_selection' | 'model_config' |
                'batch_test' | 'registration' | 'atlas_chat' |
                'analytics' | 'export';

// After batch test completes
const handleTestComplete = useCallback(() => {
  // Check if user is authenticated
  if (!user) {
    setStep('registration');  // Show registration modal
  } else {
    setStep('atlas_chat');  // Skip to Atlas
  }
}, [user]);

// After registration
const handleRegistrationComplete = () => {
  setStep('atlas_chat');
};
```

**Add Registration Step UI:**
```typescript
case 'registration':
  return (
    <DemoRegistrationModal
      onComplete={handleRegistrationComplete}
      sessionData={{
        session_id: sessionConfig.session_id,
        test_run_id: testRunId
      }}
    />
  );
```

**Files to Check for Breaking Changes:**
- `/components/demo/BatchTestProgress.tsx` (ensure onComplete still works)
- `/components/demo/ModelConfigForm.tsx` (ensure state flow intact)

---

### Phase 3: Integrate Production Atlas
**Priority:** HIGH
**Estimated Time:** 1.5 hours
**Dependencies:** Phase 2 complete

#### 3.1: Replace DemoAtlasChat with Real Atlas
**File:** `/app/demo/test-model/page.tsx`

**Before:**
```typescript
case 'atlas_chat':
  return (
    <div className="space-y-4">
      {sessionConfig && (
        <DemoAtlasChat  // ❌ Uses user's model
          sessionId={sessionConfig.session_id}
          modelName={sessionConfig.model_name}
        />
      )}
    </div>
  );
```

**After:**
```typescript
case 'atlas_chat':
  return (
    <div className="space-y-4">
      <div className="max-w-3xl mx-auto mb-4">
        <Card>
          <CardHeader>
            <CardTitle>Analyze with Atlas</CardTitle>
            <CardDescription>
              Chat with our AI assistant to analyze your batch test results.
              Atlas has access to your test metrics, traces, and performance data.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
      {sessionConfig && user && (
        <AnalyticsChat  // ✅ Production Atlas
          demoMode={true}
          demoSessionId={sessionConfig.session_id}
          demoTestRunId={testRunId}
        />
      )}
    </div>
  );
```

#### 3.2: Extend AnalyticsChat for Demo Mode
**File:** `/components/analytics/AnalyticsChat.tsx`

**Add Props:**
```typescript
interface AnalyticsChatProps {
  demoMode?: boolean;
  demoSessionId?: string;
  demoTestRunId?: string;
}

export function AnalyticsChat({
  demoMode = false,
  demoSessionId,
  demoTestRunId
}: AnalyticsChatProps) {
  // ...existing code...

  // Override session selection in demo mode
  useEffect(() => {
    if (demoMode && demoSessionId && demoTestRunId) {
      setSelectedSession({
        session_id: demoSessionId,
        experiment_name: 'BYOM Demo',
        conversation_count: 1,
        conversation_ids: [] // Not used for demo
      });
    }
  }, [demoMode, demoSessionId, demoTestRunId]);
}
```

#### 3.3: Add Demo Batch Test Tool
**File:** `/lib/tools/analytics/demo-traces.handler.ts` (NEW - 300 lines)

**Full Implementation:** (See detailed specification in appendix)

**Key Features:**
- Queries `demo_batch_test_results` filtered by `user_id`
- Returns traces in same format as main traces tool
- Supports operations: get_traces, get_summary, get_performance
- Includes token usage, latency metrics, error analysis

#### 3.4: Register Tool in API
**File:** `/app/api/analytics/chat/route.ts`

**Add Import:**
```typescript
import { executeDemoBatchTestTraces } from '@/lib/tools/analytics/demo-traces.handler';
```

**Add Tool Definition to analyticsTools array:**
```typescript
{
  type: 'function',
  function: {
    name: 'demo_batch_test_traces',
    description: 'Get batch test traces from BYOM demo sessions. Use this to analyze test results, performance metrics, success rates, latency distributions, and token usage from demo batch tests.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['get_traces', 'get_summary', 'get_performance_stats'],
          description: 'Operation to perform'
        },
        demo_session_id: {
          type: 'string',
          description: 'Demo session ID to analyze'
        },
        test_run_id: {
          type: 'string',
          description: 'Specific test run ID (optional)'
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default: 50)'
        }
      },
      required: ['operation', 'demo_session_id']
    }
  }
}
```

**Add Handler:**
```typescript
case 'demo_batch_test_traces':
  toolResult = await executeDemoBatchTestTraces(
    tool_call.function.arguments,
    userId!,
    authHeader!
  );
  break;
```

**Files to Verify:**
- Ensure existing tools still work
- Verify no breaking changes to `/lib/tools/toolManager.ts`

---

### Phase 4: Build Analytics Step
**Priority:** MEDIUM
**Estimated Time:** 2 hours
**Dependencies:** Phase 1 complete

#### 4.1: Create Demo Analytics Component
**File:** `/components/demo/DemoBatchAnalytics.tsx` (NEW - 400 lines)

**Reuse existing components:**
```typescript
import { TracesTable } from '@/components/analytics/TracesTable';
import { LatencyChart } from '@/components/analytics/LatencyChart';
import { TokenUsageChart } from '@/components/analytics/TokenUsageChart';
import { SuccessRateCard } from '@/components/analytics/SuccessRateCard';
```

**Features:**
- Live traces table (from `demo_batch_test_results`)
- Success rate donut chart
- Latency distribution histogram
- Token usage breakdown
- Cost estimation (based on model pricing)

**Data Fetching:**
```typescript
// Fetch from demo analytics service
const { data: metrics } = await fetch(
  `/api/demo/v2/metrics?session_id=${sessionId}`
);

const { data: results } = await fetch(
  `/api/demo/v2/batch-test?test_run_id=${testRunId}`
);
```

#### 4.2: Add to Demo Flow
**File:** `/app/demo/test-model/page.tsx`

**Update Steps:**
```typescript
const steps = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'task_selection', label: 'Domain' },
  { key: 'model_config', label: 'Connect' },
  { key: 'batch_test', label: 'Test' },
  { key: 'registration', label: 'Sign Up' },  // NEW
  { key: 'atlas_chat', label: 'Chat' },
  { key: 'analytics', label: 'Analytics' },    // NEW
  { key: 'export', label: 'Export' },
];
```

**Add Analytics Step:**
```typescript
case 'analytics':
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center max-w-6xl mx-auto mb-4">
        <Button variant="outline" onClick={() => setStep('atlas_chat')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Chat
        </Button>
        <Button onClick={() => setStep('export')}>
          Continue to Export
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      {sessionConfig && testRunId && (
        <DemoBatchAnalytics
          sessionId={sessionConfig.session_id}
          testRunId={testRunId}
          modelName={sessionConfig.model_name}
        />
      )}
    </div>
  );
```

**Files to Check:**
- Ensure no conflicts with `/app/analytics/page.tsx`
- Verify components are reusable (no hardcoded user queries)

---

### Phase 5: Enhanced Export Step
**Priority:** LOW
**Estimated Time:** 1 hour
**Dependencies:** Phase 4 complete

#### 5.1: Add Export Options
**File:** `/app/demo/test-model/page.tsx`

**Enhanced Export UI:**
```typescript
case 'export':
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Export Your Results</CardTitle>
        <CardDescription>
          Download your batch test data and analytics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Traces Export */}
        <div>
          <h3 className="font-medium mb-2">Traces</h3>
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={() => handleExport('traces', 'csv')}>
              Export Traces (CSV)
            </Button>
            <Button onClick={() => handleExport('traces', 'json')}>
              Export Traces (JSON)
            </Button>
          </div>
        </div>

        {/* Analytics Summary */}
        <div>
          <h3 className="font-medium mb-2">Analytics Summary</h3>
          <Button onClick={() => handleExport('summary', 'pdf')}>
            Download PDF Report
          </Button>
        </div>

        {/* Charts */}
        <div>
          <h3 className="font-medium mb-2">Visualizations</h3>
          <Button onClick={() => handleExportCharts()}>
            Export Charts (PNG)
          </Button>
        </div>

        {/* Share Link */}
        <div>
          <h3 className="font-medium mb-2">Share</h3>
          <Button onClick={() => generateShareLink()}>
            Generate Share Link
          </Button>
        </div>
      </CardContent>
    </Card>
  );
```

#### 5.2: Update Export API
**File:** `/app/api/demo/v2/export/route.ts`

**Add Formats:**
```typescript
const format = searchParams.get('format'); // 'csv' | 'json' | 'pdf'
const type = searchParams.get('type'); // 'traces' | 'summary'

if (type === 'summary' && format === 'pdf') {
  // Generate PDF report using pdfkit
  return generatePDFReport(sessionId, testRunId);
}
```

---

## Database Schema Changes

### Migration 1: Add Token Columns
**File:** `/supabase/migrations/20260101000001_add_token_columns.sql`

```sql
ALTER TABLE demo_batch_test_results
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER;
```

### Migration 2: Add User IDs + RLS
**File:** `/supabase/migrations/20260101000002_add_user_scoping.sql`

```sql
-- Add user_id columns
ALTER TABLE demo_batch_test_runs
  ADD COLUMN user_id UUID REFERENCES auth.users(id);

ALTER TABLE demo_batch_test_results
  ADD COLUMN user_id UUID REFERENCES auth.users(id);

ALTER TABLE demo_model_configs
  ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Indexes
CREATE INDEX idx_demo_batch_test_runs_user_id
  ON demo_batch_test_runs(user_id);

CREATE INDEX idx_demo_batch_test_results_user_id
  ON demo_batch_test_results(user_id);

CREATE INDEX idx_demo_model_configs_user_id
  ON demo_model_configs(user_id);

-- Update RLS policies
DROP POLICY IF EXISTS "demo_batch_test_runs_public_access" ON demo_batch_test_runs;
DROP POLICY IF EXISTS "demo_batch_test_results_public_access" ON demo_batch_test_results;

CREATE POLICY "demo_batch_test_runs_user_access"
  ON demo_batch_test_runs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "demo_batch_test_results_user_access"
  ON demo_batch_test_results
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## Files Affected - Complete List

### New Files (9)
1. `/components/demo/DemoRegistrationModal.tsx`
2. `/components/demo/DemoBatchAnalytics.tsx`
3. `/app/api/demo/migrate-session/route.ts`
4. `/lib/tools/analytics/demo-traces.handler.ts`
5. `/supabase/migrations/20260101000001_add_token_columns.sql`
6. `/supabase/migrations/20260101000002_add_user_scoping.sql`
7. `/development/progress-logs/2026-01-01_BYOM-DEMO-ATLAS-INTEGRATION-PLAN.md` (this file)

### Modified Files (4)
1. `/app/demo/test-model/page.tsx` - Add registration step, integrate Atlas, add analytics step
2. `/components/analytics/AnalyticsChat.tsx` - Add demo mode support
3. `/app/api/analytics/chat/route.ts` - Add demo_batch_test_traces tool
4. `/app/api/demo/v2/export/route.ts` - Add summary/PDF export

### Files to Verify (No Changes Needed)
1. `/app/api/demo/v2/batch-test/route.ts` - Verify INSERT works after adding columns
2. `/lib/demo/demo-analytics.service.ts` - Verify metrics calculation works
3. `/lib/tools/toolManager.ts` - Verify new tool doesn't break existing
4. `/contexts/AuthContext.tsx` - No changes needed
5. `/app/analytics/page.tsx` - Verify no conflicts

---

## Testing Plan

### Phase 1 Testing (Token Storage)
1. ✅ Run migration on Supabase
2. ✅ Start new batch test
3. ✅ Verify results stored: `SELECT COUNT(*) FROM demo_batch_test_results`
4. ✅ Verify tokens populated: `SELECT input_tokens, output_tokens FROM demo_batch_test_results`
5. ✅ Verify metrics show non-zero: Visit Step 5, check metrics

### Phase 2 Testing (Authentication)
1. ✅ Complete batch test as anonymous user
2. ✅ See registration modal
3. ✅ Sign up with email/password
4. ✅ Verify session migrated: Check `user_id` in database
5. ✅ Verify can't see other users' data
6. ✅ Test existing user login

### Phase 3 Testing (Atlas Integration)
1. ✅ Reach Step 5 (Atlas Chat) as authenticated user
2. ✅ Ask: "What was my success rate?"
3. ✅ Verify Atlas uses demo_batch_test_traces tool
4. ✅ Verify response includes actual metrics
5. ✅ Ask: "Show me the slowest prompts"
6. ✅ Verify Atlas returns correct data

### Phase 4 Testing (Analytics)
1. ✅ Navigate to Step 6 (Analytics)
2. ✅ Verify traces table shows all results
3. ✅ Verify success rate chart accurate
4. ✅ Verify latency histogram correct
5. ✅ Verify token usage displayed

### Phase 5 Testing (Export)
1. ✅ Navigate to Step 7 (Export)
2. ✅ Export traces as CSV - verify format
3. ✅ Export traces as JSON - verify structure
4. ✅ Generate PDF report - verify content

---

## Security Verification

### RLS Policy Testing
```sql
-- Test 1: User can see own data
SET request.jwt.claim.sub = '38c85707-1fc5-40c6-84be-c017b3b8e750';
SELECT COUNT(*) FROM demo_batch_test_results WHERE user_id = '38c85707-1fc5-40c6-84be-c017b3b8e750';
-- ✅ Should return > 0

-- Test 2: User cannot see other user's data
SELECT COUNT(*) FROM demo_batch_test_results WHERE user_id != '38c85707-1fc5-40c6-84be-c017b3b8e750';
-- ✅ Should return 0 (RLS blocks access)

-- Test 3: Anonymous user cannot access
RESET request.jwt.claim.sub;
SELECT COUNT(*) FROM demo_batch_test_results;
-- ✅ Should fail with "permission denied"
```

---

## Rollback Plan

### If Phase 1 Fails
```sql
-- Rollback migration
ALTER TABLE demo_batch_test_results
  DROP COLUMN IF EXISTS input_tokens,
  DROP COLUMN IF EXISTS output_tokens;
```

### If Phase 2 Fails
1. Remove registration modal component
2. Revert `page.tsx` changes
3. Keep batch test anonymous

### If Phase 3 Fails
1. Restore DemoAtlasChat component
2. Remove demo-traces.handler.ts
3. Remove tool from API

---

## Success Criteria

### Phase 1 ✅
- [ ] Migration runs without errors
- [ ] Batch test results stored successfully
- [ ] Metrics show actual latency values
- [ ] Metrics show actual token counts
- [ ] Success rate calculated correctly

### Phase 2 ✅
- [ ] Registration modal appears after batch test
- [ ] Sign up creates new user account
- [ ] Session data migrated to user
- [ ] Login works for existing users
- [ ] RLS policies prevent cross-user access

### Phase 3 ✅
- [ ] Atlas chat loads in Step 5
- [ ] demo_batch_test_traces tool available
- [ ] Atlas can answer questions about batch test
- [ ] Tool only returns user's own data
- [ ] Responses accurate and helpful

### Phase 4 ✅
- [ ] Analytics page shows traces
- [ ] Charts render correctly
- [ ] Metrics match expected values
- [ ] No errors in browser console

### Phase 5 ✅
- [ ] CSV export downloads
- [ ] JSON export valid
- [ ] PDF report generates
- [ ] All formats contain correct data

---

## Next Steps

1. **User Review** - Get approval on this plan
2. **Address Concerns** - Discuss any questions about Atlas data access
3. **Phased Implementation** - Execute phases sequentially
4. **Testing** - Verify at each phase before proceeding
5. **Progress Logging** - Update this document with results

---

## Questions for User

1. **Atlas Query Limits:** Should we limit demo users to 10 Atlas questions per session?
2. **Account Persistence:** After demo, should user stay in "demo mode" or get full platform access?
3. **Data Retention:** Keep demo data for 24 hours or link to user account permanently?
4. **Model Selection:** Which Atlas model for demo users (GPT-4o-mini vs GPT-4o)?

---

**Status:** 🟡 AWAITING USER APPROVAL TO PROCEED
