# Metric Alert Rules - Phased Implementation Plan
**Date**: 2025-12-25
**Status**: 🚀 IN PROGRESS - User approved, executing phased implementation
**Started**: 2025-12-25 (Session continued from context)
**Estimated Time**: 5-6 hours total
**Breaking Changes**: ❌ NONE - All changes are additive and backward compatible

---

## 🔄 Implementation Log

### Session Start: 2025-12-25
- ✅ User approved full deployment (Option A)
- ✅ Critical requirements confirmed:
  - Update progress logs (never delete/overwrite)
  - Never assume, always verify
  - Verify code before updating
  - Find exact insertion points
  - Verify changes work
  - Validate no breaking changes

### Phase 1: Database Schema ✅ COMPLETE
**Time**: ~15 minutes
- ✅ Verified source migration file exists (115 lines, 5.0K)
- ✅ Copied migration to main repo: `supabase/migrations/20251225000000_create_metric_alert_rules.sql`
- ✅ No syntax errors found
- ✅ No conflicts with existing migrations
- ✅ Created verification script: `scripts/verify-metric-alert-tables.mjs`
- ✅ Verified tables exist in database:
  - `metric_alert_rules` (with RLS policies and indexes)
  - `metric_alert_rule_evaluations` (with RLS policies and indexes)
- ✅ RLS policies verified active (anonymous access blocked)
- ✅ Table structure validated
- 📝 Note: Tables already existed in database (migration previously run)

### Phase 2: Type Definitions ✅ COMPLETE
**Time**: ~10 minutes
**Goal**: Add metric alert types to `lib/alerts/alert.types.ts`
- ✅ Added 7 new AlertType variants (lines 22-29):
  - trace_latency_high, trace_error_rate_high, trace_cost_high
  - trace_throughput_low, trace_ttft_high
  - anomaly_critical, anomaly_high
- ✅ Updated alertTypeToPreferenceKey mapping (added 7 entries as null)
- ✅ Updated alertTypeToWebhookKey mapping (added 7 entries as null)
- ✅ Updated alertTypeToIntegrationKey mapping (added 7 entries as null)
- ✅ Added 3 new type definitions (lines 352-363):
  - MetricType, ComparisonOperator, AggregationMethod
- ✅ Added 3 new interfaces (lines 365-421):
  - MetricAlertRule, MetricAlertRuleEvaluation, TraceMetricAlertData
- ✅ TypeScript compilation verified (npx tsc --noEmit) - no errors
- ✅ File size: 315→421 lines (+106 lines, matches worktree)
- ✅ NO BREAKING CHANGES: All additions are new types/interfaces

### Phase 3: API Routes ✅ COMPLETE
**Time**: ~20 minutes
**Goal**: Create alert rules CRUD API with corrected imports
- ✅ Created directory: `app/api/analytics/alert-rules/`
- ✅ Created route file: `app/api/analytics/alert-rules/route.ts` (302 lines, 9.2K)
- ✅ Fixed import from `@/lib/supabaseServer` → `@supabase/supabase-js`
- ✅ Implemented proper authentication pattern:
  - Get Authorization header from request
  - Create client with anon key + auth header
  - Call `supabase.auth.getUser()` for verification
  - Pattern matches existing `/api/user/*` routes
- ✅ Implemented 4 HTTP methods:
  - GET: List user's alert rules (with RLS)
  - POST: Create new alert rule (with validation)
  - PATCH: Update existing rule (with RLS)
  - DELETE: Delete rule (with RLS)
- ✅ Field validation for metric_type, comparison_operator, aggregation_method
- ✅ RLS enforced: users can only access their own rules
- ✅ Added runtime: 'nodejs' for Supabase compatibility
- ✅ NO BREAKING CHANGES: New API route, no modifications to existing routes

### Phase 4: Scheduler Worker Enhancement ✅ COMPLETE
**Time**: ~45 minutes
**Goal**: Add metric evaluation methods to scheduler-worker.ts
- ✅ Updated header comment (line 3-4): Added "metric-based alert evaluation"
- ✅ Added imports (line 11-12):
  - MetricAlertRule, MetricType, ComparisonOperator, AggregationMethod, AlertType
  - AlertService
- ✅ Added METRIC_ALERT_EVAL_INTERVAL_MS constant (line 19): 60000ms
- ✅ Added metricAlertLastEval property (line 36): Track last evaluation time
- ✅ Added metric evaluation call in tick() method (lines 104-111):
  - Check if evaluation is due based on interval
  - Call evaluateMetricAlerts() asynchronously
  - Update metricAlertLastEval timestamp
- ✅ Added 7 new private methods (lines 446-770):
  1. evaluateMetricAlerts(): Fetch and evaluate all enabled rules
  2. evaluateSingleMetricRule(): Evaluate one rule against traces
  3. calculateMetricValue(): Extract and aggregate metric from traces
  4. percentile(): Calculate percentile values (p50, p95, p99)
  5. compareValue(): Compare metric value against threshold
  6. recordMetricEvaluation(): Save evaluation to database
  7. sendMetricAlert(): Send alert via AlertService
- ✅ TypeScript compilation verified - no errors
- ✅ File size: 444→771 lines (+327 lines, close to worktree 780)
- ✅ NO BREAKING CHANGES: All additions are new private methods

## 📊 Implementation Summary

### Phases Completed: 4/7 ✅
**Total Time**: ~2 hours
**Status**: Core implementation complete, ready for deployment and testing

### What's Working:
1. ✅ Database schema deployed (tables + RLS + indexes)
2. ✅ Type definitions added (7 alert types + 3 interfaces)
3. ✅ API routes created (GET/POST/PATCH/DELETE with auth)
4. ✅ Scheduler worker enhanced (metric evaluation engine)

### Next Steps:
- Phase 5: Deploy scheduler worker (deployment script + Render config)
- Phase 6: Alert formatting (email templates - OPTIONAL)
- Phase 7: End-to-end testing (verify all metric types work)

---

## 📋 Executive Summary

This plan implements the **Metric Alert Rules** feature - an advanced alerting infrastructure with anomaly detection for continuous monitoring of trace metrics. All changes have been verified as **non-breaking** and **backward compatible**.

**Source**: `worktrees/github-local-sync-setup-RMOQj/`
**Destination**: Main repository
**Approach**: Phased deployment with verification at each step

---

## ✅ Pre-Implementation Verification Complete

### Verified Files in Main Repo:
- ✅ `lib/alerts/alert.types.ts` (9,263 bytes) - EXISTS, needs extension
- ✅ `lib/evaluation/scheduler-worker.ts` (440 lines) - EXISTS, needs extension
- ✅ `lib/alerts/alert.service.ts` (13,859 bytes) - EXISTS, compatible
- ✅ `supabase/migrations/` - Latest is `20251222_add_trace_request_metadata.sql`
- ✅ `app/api/analytics/` - No `alert-rules/` directory (will create new)

### Verified No Breaking Changes:
- ✅ New `AlertType` variants are ADDITIVE to existing union type
- ✅ New database tables don't affect existing schemas
- ✅ Scheduler modifications are BACKWARD COMPATIBLE
- ✅ New API route doesn't conflict with existing routes
- ✅ Type additions don't modify existing interfaces

### Verified Dependencies:
- ✅ Uses `@supabase/supabase-js` (already in package.json)
- ✅ Uses existing `AlertService` (no modifications required initially)
- ✅ Uses existing auth patterns from other analytics APIs
- ✅ No new npm packages required

---

## 📂 Files to Create/Modify

### Files to CREATE (4 new files):

1. **Database Migration**
   - Path: `supabase/migrations/20251225000000_create_metric_alert_rules.sql`
   - Source: Worktree (116 lines)
   - Changes: NONE (direct copy)
   - Creates tables: `metric_alert_rules`, `metric_alert_rule_evaluations`

2. **API Route**
   - Path: `app/api/analytics/alert-rules/route.ts`
   - Source: Worktree (240 lines)
   - **Changes Required**: Fix import (line 7)
     - FROM: `import { createClient } from '@/lib/supabaseServer';`
     - TO: Direct Supabase client creation (pattern from traces/route.ts)
   - Endpoints: GET, POST, PATCH, DELETE

3. **Scheduler Deployment Script** (NEW - not in worktree)
   - Path: `scripts/run-scheduler-worker.ts`
   - Status: NEEDS CREATION
   - Purpose: Standalone process entry point for Render

4. **Email Templates** (NEW - not in worktree)
   - Path: `lib/alerts/formatters/metric-alert-templates.ts`
   - Status: NEEDS CREATION (can defer to Phase 5)
   - Purpose: Professional email formatting for metric alerts

### Files to MODIFY (2 existing files):

5. **Type Definitions**
   - Path: `lib/alerts/alert.types.ts`
   - Current: 316 lines (main repo)
   - Will be: ~422 lines (+106 lines from worktree)
   - **Additions**:
     - Lines 22-30: New AlertType variants (metric alerts)
     - Lines 349-422: MetricAlertRule interfaces
   - **Verification**: NO modifications to existing interfaces

6. **Scheduler Worker**
   - Path: `lib/evaluation/scheduler-worker.ts`
   - Current: 440 lines (main repo)
   - Will be: ~780 lines (+340 lines from worktree)
   - **Additions**:
     - Line 3: Update header comment
     - Line 11: Add import for MetricAlertRule types
     - Line 19: Add METRIC_ALERT_EVAL_INTERVAL_MS constant
     - Line 36: Add metricAlertLastEval property
     - Lines 458-780: New metric evaluation methods
   - **Verification**: NO modifications to existing methods

---

## 🔄 Phase-by-Phase Implementation

### PHASE 1: Database Schema (30 minutes)
**Goal**: Create database tables for metric alert rules

#### Step 1.1: Copy Migration File
```bash
cp worktrees/github-local-sync-setup-RMOQj/supabase/migrations/20251225000000_create_metric_alert_rules.sql \
   supabase/migrations/20251225000000_create_metric_alert_rules.sql
```

#### Step 1.2: Verify Migration File
- [ ] Confirm file copied successfully
- [ ] Check file size: 116 lines
- [ ] Verify no syntax errors: `cat supabase/migrations/20251225000000_create_metric_alert_rules.sql | grep "ERROR"`

#### Step 1.3: Run Migration Locally
```bash
# If using Supabase CLI:
supabase db push

# OR manually via SQL editor in Supabase Dashboard
```

#### Step 1.4: Verify Tables Created
```sql
-- Run in Supabase SQL Editor
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('metric_alert_rules', 'metric_alert_rule_evaluations');

-- Verify RLS policies
SELECT tablename, policyname FROM pg_policies
WHERE tablename = 'metric_alert_rules';

-- Verify indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'metric_alert_rules';
```

**Expected Results**:
- ✅ 2 tables created
- ✅ 4 RLS policies on `metric_alert_rules`
- ✅ 1 RLS policy on `metric_alert_rule_evaluations`
- ✅ 3 indexes on `metric_alert_rules`
- ✅ 4 indexes on `metric_alert_rule_evaluations`

#### Step 1.5: Test RLS Policies
```sql
-- Test as authenticated user (should work)
SET role authenticated;
SELECT * FROM metric_alert_rules LIMIT 1;

-- Test as anon (should fail)
SET role anon;
SELECT * FROM metric_alert_rules LIMIT 1; -- Should return empty
```

**Rollback Plan**: Drop tables if issues found
```sql
DROP TABLE IF EXISTS metric_alert_rule_evaluations CASCADE;
DROP TABLE IF EXISTS metric_alert_rules CASCADE;
```

**Success Criteria**:
- [ ] Migration file exists in main repo
- [ ] Tables created successfully
- [ ] RLS policies enforced
- [ ] Indexes created

**Estimated Time**: 30 minutes

---

### PHASE 2: Type Definitions (20 minutes)
**Goal**: Add TypeScript types for metric alert rules

#### Step 2.1: Backup Current Types File
```bash
cp lib/alerts/alert.types.ts lib/alerts/alert.types.ts.backup
```

#### Step 2.2: Identify Exact Insertion Points

**Insertion Point 1**: AlertType union (after line 21)
```typescript
// CURRENT (line 6-21):
export type AlertType =
  | 'job_started'
  ...
  | 'daily_summary'
  | 'weekly_digest';

// ADD AFTER LINE 21:
  | 'trace_latency_high'
  | 'trace_error_rate_high'
  | 'trace_cost_high'
  | 'trace_throughput_low'
  | 'trace_ttft_high'
  | 'anomaly_critical'
  | 'anomaly_high';
```

**Insertion Point 2**: End of file (after line 316)
```typescript
// ADD AT END OF FILE:
/**
 * Metric-based Alert Rule Configuration
 */
export type MetricType =
  | 'latency'
  | 'error_rate'
  | 'cost'
  | 'throughput'
  | 'ttft'
  | 'token_usage'
  | 'anomaly_severity';

export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

export type AggregationMethod = 'p50' | 'p95' | 'p99' | 'avg' | 'max' | 'min' | 'count' | 'sum';

export interface MetricAlertRule {
  id: string;
  user_id: string;
  rule_name: string;
  description?: string;
  metric_type: MetricType;
  threshold_value: number;
  comparison_operator: ComparisonOperator;
  time_window_minutes: number;
  aggregation_method: AggregationMethod;

  // Optional filters
  model_filter?: string;
  operation_filter?: string;
  status_filter?: string;

  // Notification settings
  notify_email: boolean;
  notify_webhooks: boolean;
  notify_integrations: boolean;
  cooldown_minutes: number;

  // State
  enabled: boolean;
  last_triggered_at?: string;
  trigger_count: number;

  created_at: string;
  updated_at: string;
}

export interface MetricAlertRuleEvaluation {
  rule_id: string;
  user_id: string;
  metric_value: number;
  threshold_value: number;
  triggered: boolean;
  time_window_start: string;
  time_window_end: string;
  sample_count: number;
  metadata: Record<string, unknown>;
  evaluated_at: string;
}

export interface TraceMetricAlertData {
  ruleId: string;
  ruleName: string;
  metricType: MetricType;
  metricValue: number;
  thresholdValue: number;
  comparisonOperator: ComparisonOperator;
  aggregationMethod: AggregationMethod;
  timeWindowMinutes: number;
  sampleCount: number;
  modelFilter?: string;
  operationFilter?: string;
}
```

**Insertion Point 3**: Update alertTypeToWebhookKey function (line 272-291)
```typescript
// UPDATE EXISTING FUNCTION (add metric alert types to mapping):
const mapping: Record<AlertType, keyof UserWebhook | null> = {
  // ... existing mappings ...
  daily_summary: null,
  weekly_digest: null,
  // ADD:
  trace_latency_high: null,
  trace_error_rate_high: null,
  trace_cost_high: null,
  trace_throughput_low: null,
  trace_ttft_high: null,
  anomaly_critical: null,
  anomaly_high: null,
};
```

**Insertion Point 4**: Update alertTypeToIntegrationKey function (line 296-315)
```typescript
// UPDATE EXISTING FUNCTION (add metric alert types to mapping):
const mapping: Record<AlertType, string | null> = {
  // ... existing mappings ...
  daily_summary: null,
  weekly_digest: null,
  // ADD:
  trace_latency_high: null,
  trace_error_rate_high: null,
  trace_cost_high: null,
  trace_throughput_low: null,
  trace_ttft_high: null,
  anomaly_critical: null,
  anomaly_high: null,
};
```

#### Step 2.3: Apply Changes
- [ ] Update AlertType union
- [ ] Add new interfaces at end of file
- [ ] Update alertTypeToWebhookKey mapping
- [ ] Update alertTypeToIntegrationKey mapping

#### Step 2.4: Verify TypeScript Compilation
```bash
npx tsc --noEmit --project tsconfig.json
```

**Expected**: No new TypeScript errors

#### Step 2.5: Verify No Breaking Changes
```bash
# Check that existing alert types still work
grep -r "AlertType" lib/alerts/ app/api/alerts/ | grep -v "node_modules" | wc -l
# Should show all existing usages still compile
```

**Rollback Plan**: Restore backup
```bash
mv lib/alerts/alert.types.ts.backup lib/alerts/alert.types.ts
```

**Success Criteria**:
- [ ] Types file updated with new definitions
- [ ] No TypeScript compilation errors
- [ ] Existing code still compiles
- [ ] New types exportable

**Estimated Time**: 20 minutes

---

### PHASE 3: API Routes (30 minutes)
**Goal**: Create REST API for managing alert rules

#### Step 3.1: Create Directory
```bash
mkdir -p app/api/analytics/alert-rules
```

#### Step 3.2: Create route.ts with Fixed Imports

**File**: `app/api/analytics/alert-rules/route.ts`

```typescript
/**
 * Metric Alert Rules API
 * Manage metric-based alert rules for traces and anomalies
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { MetricAlertRule } from '@/lib/alerts/alert.types';

// Supabase configuration (pattern from traces/route.ts)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET - List all alert rules for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get('authorization') || '',
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's alert rules
    const { data: rules, error: rulesError } = await supabase
      .from('metric_alert_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (rulesError) {
      console.error('[Alert Rules API] Error fetching rules:', rulesError);
      return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      rules: rules || [],
    });
  } catch (error) {
    console.error('[Alert Rules API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ... (copy remaining POST, PATCH, DELETE methods from worktree with same pattern)
```

**NOTE**: Copy full file from worktree but replace lines 1-16 with above pattern

#### Step 3.3: Verify Route File
- [ ] File created successfully
- [ ] Imports use correct paths
- [ ] No references to `@/lib/supabaseServer`
- [ ] All 4 HTTP methods implemented (GET, POST, PATCH, DELETE)

#### Step 3.4: Test API Endpoints

**Test 1: GET (list rules)**
```bash
curl -X GET http://localhost:3000/api/analytics/alert-rules \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"
```
Expected: `{"success":true,"rules":[]}`

**Test 2: POST (create rule)**
```bash
curl -X POST http://localhost:3000/api/analytics/alert-rules \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_name": "High Latency Alert",
    "metric_type": "latency",
    "threshold_value": 1000,
    "comparison_operator": ">",
    "time_window_minutes": 5,
    "aggregation_method": "p95",
    "notify_email": true
  }'
```
Expected: `{"success":true,"rule":{...}}`

**Test 3: Verify in Database**
```sql
SELECT id, rule_name, metric_type, threshold_value
FROM metric_alert_rules
ORDER BY created_at DESC
LIMIT 1;
```

**Rollback Plan**: Delete directory
```bash
rm -rf app/api/analytics/alert-rules
```

**Success Criteria**:
- [ ] API route file created
- [ ] GET endpoint returns rules list
- [ ] POST endpoint creates rule
- [ ] PATCH endpoint updates rule
- [ ] DELETE endpoint removes rule
- [ ] RLS policies enforced (users only see own rules)

**Estimated Time**: 30 minutes

---

### PHASE 4: Scheduler Worker Enhancement (1 hour)
**Goal**: Add metric alert evaluation to scheduler worker

#### Step 4.1: Backup Current Scheduler
```bash
cp lib/evaluation/scheduler-worker.ts lib/evaluation/scheduler-worker.ts.backup
```

#### Step 4.2: Identify Exact Code Insertion Points

**Location 1**: File header (line 1-4)
```typescript
// CURRENT:
// Evaluation Scheduler Worker
// Created: 2025-12-16
// Purpose: Background worker to check and execute due scheduled evaluations
// Deployment: Standalone process (Render background worker)

// UPDATE TO:
// Evaluation Scheduler Worker
// Created: 2025-12-16
// Updated: 2025-12-25 - Added metric-based alert evaluation
// Purpose: Background worker to check and execute due scheduled evaluations + metric alert rules
// Deployment: Standalone process (Render background worker)
```

**Location 2**: Imports (after line 9)
```typescript
// CURRENT:
import { sendScheduledEvaluationAlert } from '../alerts/alert.service';

// ADD AFTER LINE 9:
import type { MetricAlertRule, MetricType, ComparisonOperator, AggregationMethod } from '../alerts/alert.types';
import { AlertService } from '../alerts/alert.service';
```

**Location 3**: Constants (after line 15)
```typescript
// CURRENT:
const BATCH_TEST_TIMEOUT_MS = 600000; // 10 minutes timeout for batch tests

// ADD AFTER LINE 15:
const METRIC_ALERT_EVAL_INTERVAL_MS = 60000; // Evaluate metric alerts every minute
```

**Location 4**: Class properties (after line 34)
```typescript
// CURRENT:
private runningEvaluations = new Set<string>();

// ADD AFTER LINE 34:
private metricAlertLastEval: number = 0;
```

**Location 5**: tick() method enhancement (around line 100-120)
```typescript
// FIND the tick() method
// ADD before the existing scheduled evaluation check:

// Evaluate metric alert rules if interval elapsed
const now = Date.now();
if (now - this.metricAlertLastEval >= METRIC_ALERT_EVAL_INTERVAL_MS) {
  this.metricAlertLastEval = now;
  this.evaluateMetricAlerts().catch(err =>
    console.error('[EvalScheduler] Metric alert evaluation error:', err)
  );
}
```

**Location 6**: End of class (after last method, before closing brace)
```typescript
// ADD AT END OF CLASS (before final closing brace):

/**
 * Evaluate metric alert rules
 */
private async evaluateMetricAlerts(): Promise<void> {
  // ... (copy full implementation from worktree lines 458-493)
}

/**
 * Evaluate a single metric alert rule
 */
private async evaluateSingleMetricRule(rule: MetricAlertRule): Promise<void> {
  // ... (copy full implementation from worktree lines 495-583)
}

/**
 * Calculate metric value from traces
 */
private calculateMetricValue(
  traces: any[],
  metricType: MetricType,
  aggregationMethod: AggregationMethod
): number {
  // ... (copy full implementation from worktree lines 585-646)
}

/**
 * Calculate percentile
 */
private percentile(values: number[], p: number): number {
  // ... (copy full implementation from worktree lines 648-656)
}

/**
 * Compare value against threshold
 */
private compareValue(value: number, operator: ComparisonOperator, threshold: number): boolean {
  // ... (copy full implementation from worktree lines 658-678)
}

/**
 * Record metric evaluation in database
 */
private async recordMetricEvaluation(
  rule: MetricAlertRule,
  metricValue: number,
  thresholdValue: number,
  triggered: boolean,
  timeWindowStart: Date,
  timeWindowEnd: Date,
  sampleCount: number,
  metadata: Record<string, unknown>
): Promise<void> {
  // ... (copy full implementation from worktree lines 680-714)
}

/**
 * Send metric alert notification
 */
private async sendMetricAlert(
  rule: MetricAlertRule,
  metricValue: number,
  sampleCount: number,
  timeWindowStart: Date,
  timeWindowEnd: Date
): Promise<void> {
  // ... (copy full implementation from worktree lines 716-779)
}
```

#### Step 4.3: Apply Changes
- [ ] Update file header
- [ ] Add imports
- [ ] Add constants
- [ ] Add class property
- [ ] Update tick() method
- [ ] Add new private methods

#### Step 4.4: Verify TypeScript Compilation
```bash
npx tsc --noEmit lib/evaluation/scheduler-worker.ts
```

**Expected**: No TypeScript errors

#### Step 4.5: Verify No Breaking Changes
```bash
# Test that existing scheduled evaluation still works
grep -n "executeBatchTest\|checkScheduledEvaluations" lib/evaluation/scheduler-worker.ts
# Should show existing methods unchanged
```

**Rollback Plan**: Restore backup
```bash
mv lib/evaluation/scheduler-worker.ts.backup lib/evaluation/scheduler-worker.ts
```

**Success Criteria**:
- [ ] Scheduler file updated
- [ ] No TypeScript errors
- [ ] Existing scheduled evaluation logic unchanged
- [ ] New metric evaluation methods added

**Estimated Time**: 1 hour

---

### PHASE 5: Scheduler Deployment (1 hour)
**Goal**: Deploy scheduler worker to run metric evaluations

#### Step 5.1: Create Deployment Script

**File**: `scripts/run-scheduler-worker.ts`

```typescript
/**
 * Scheduler Worker Entry Point
 * Runs as standalone process on Render background worker
 * Evaluates scheduled batch tests + metric alert rules
 */

import { EvaluationSchedulerWorker } from '../lib/evaluation/scheduler-worker';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;

if (!supabaseUrl) {
  console.error('[SchedulerWorker] Missing NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('[SchedulerWorker] Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!appUrl) {
  console.error('[SchedulerWorker] Missing APP URL (NEXT_PUBLIC_APP_URL or APP_BASE_URL)');
  process.exit(1);
}

console.log('[SchedulerWorker] Starting with configuration:');
console.log('[SchedulerWorker] Supabase URL:', supabaseUrl);
console.log('[SchedulerWorker] App URL:', appUrl);

const worker = new EvaluationSchedulerWorker(
  supabaseUrl,
  supabaseServiceKey,
  appUrl
);

// Start the worker
worker.start();
console.log('[SchedulerWorker] Worker started successfully');

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SchedulerWorker] SIGTERM received, stopping worker');
  worker.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SchedulerWorker] SIGINT received, stopping worker');
  worker.stop();
  process.exit(0);
});

// Keep process alive
console.log('[SchedulerWorker] Worker is now running. Press Ctrl+C to stop.');
```

#### Step 5.2: Add npm Script

**File**: `package.json`

```json
{
  "scripts": {
    // ... existing scripts ...
    "scheduler:worker": "tsx scripts/run-scheduler-worker.ts"
  }
}
```

#### Step 5.3: Test Locally
```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_ROLE_KEY="your_service_key"
export NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Run worker
npm run scheduler:worker
```

**Expected Output**:
```
[SchedulerWorker] Starting with configuration:
[SchedulerWorker] Supabase URL: https://....supabase.co
[SchedulerWorker] App URL: http://localhost:3000
[EvalScheduler] Worker initialized
[EvalScheduler] Worker started
[EvalScheduler] Tick start
[EvalScheduler] Evaluating metric alert rules
[EvalScheduler] No enabled metric alert rules
[EvalScheduler] Tick completed in Xms
```

#### Step 5.4: Create Test Alert Rule
```bash
# Use the API to create a test rule
curl -X POST http://localhost:3000/api/analytics/alert-rules \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_name": "Test High Latency",
    "metric_type": "latency",
    "threshold_value": 100,
    "comparison_operator": ">",
    "time_window_minutes": 5,
    "aggregation_method": "p95",
    "notify_email": true,
    "enabled": true
  }'
```

#### Step 5.5: Verify Evaluation Runs
```bash
# Check worker logs - should see:
[EvalScheduler] Evaluating 1 metric alert rules
[EvalScheduler] Evaluating rule: Test High Latency for window: ...
```

#### Step 5.6: Verify Evaluation History
```sql
SELECT rule_id, metric_value, triggered, sample_count, evaluated_at
FROM metric_alert_rule_evaluations
ORDER BY evaluated_at DESC
LIMIT 5;
```

**Expected**: Evaluation records created every minute

#### Step 5.7: Deploy to Render (Production)

**Option A: Render Background Worker** (Recommended)
1. Go to Render Dashboard
2. Create new Background Worker
3. Configure:
   - Name: `scheduler-worker`
   - Build Command: `npm install`
   - Start Command: `npm run scheduler:worker`
   - Environment Variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `NEXT_PUBLIC_APP_URL`

**Option B: Vercel Cron** (Alternative)
If Render not available, create cron endpoint:

**File**: `app/api/cron/evaluate-alerts/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { EvaluationSchedulerWorker } from '@/lib/evaluation/scheduler-worker';

export async function GET() {
  const worker = new EvaluationSchedulerWorker(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    process.env.NEXT_PUBLIC_APP_URL!
  );

  // Run single evaluation cycle
  await worker.tick();

  return NextResponse.json({ success: true });
}
```

**Vercel cron config**: `vercel.json`
```json
{
  "crons": [{
    "path": "/api/cron/evaluate-alerts",
    "schedule": "* * * * *"
  }]
}
```

**Success Criteria**:
- [ ] Deployment script created
- [ ] Worker runs locally
- [ ] Metric alert rules evaluated every minute
- [ ] Evaluation history recorded
- [ ] Worker deployed to production

**Estimated Time**: 1 hour

---

### PHASE 6: Alert Formatting (1 hour) - OPTIONAL
**Goal**: Add professional email/webhook formatting for metric alerts

**Note**: Can be deferred - alerts will work with generic formatting initially

#### Step 6.1: Create Email Templates

**File**: `lib/alerts/formatters/metric-alert-templates.ts`

```typescript
import type { TraceMetricAlertData } from '../alert.types';

export function formatMetricAlertEmail(data: TraceMetricAlertData): {
  subject: string;
  html: string;
} {
  const subject = `🚨 Alert: ${data.ruleName}`;

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Metric Alert Triggered</h2>

        <div style="background: #fef2f2; padding: 16px; border-left: 4px solid #dc2626; margin: 16px 0;">
          <strong>${data.ruleName}</strong>
        </div>

        <h3>Alert Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px; font-weight: bold;">Metric</td>
            <td style="padding: 8px;">${data.metricType}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px; font-weight: bold;">Current Value</td>
            <td style="padding: 8px;">${data.metricValue.toFixed(2)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px; font-weight: bold;">Threshold</td>
            <td style="padding: 8px;">${data.comparisonOperator} ${data.thresholdValue}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px; font-weight: bold;">Aggregation</td>
            <td style="padding: 8px;">${data.aggregationMethod.toUpperCase()}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px; font-weight: bold;">Time Window</td>
            <td style="padding: 8px;">${data.timeWindowMinutes} minutes</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px; font-weight: bold;">Sample Count</td>
            <td style="padding: 8px;">${data.sampleCount} traces</td>
          </tr>
        </table>

        ${data.modelFilter ? `<p><strong>Model Filter:</strong> ${data.modelFilter}</p>` : ''}
        ${data.operationFilter ? `<p><strong>Operation Filter:</strong> ${data.operationFilter}</p>` : ''}

        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          This alert was triggered based on your configured metric alert rules.
        </p>
      </body>
    </html>
  `;

  return { subject, html };
}
```

#### Step 6.2: Update Email Channel

**File**: `lib/alerts/channels/email.channel.ts`

Add case for metric alerts in send() method.

**Success Criteria**:
- [ ] Email templates created
- [ ] Templates used by email channel
- [ ] Emails look professional
- [ ] All metric data displayed

**Estimated Time**: 1 hour (can defer)

---

### PHASE 7: End-to-End Testing (1-2 hours)
**Goal**: Comprehensive testing of entire flow

#### Test Case 1: Create Alert Rule via UI
- [ ] Navigate to analytics dashboard
- [ ] Create new metric alert rule
- [ ] Verify rule appears in list
- [ ] Verify rule saved to database

#### Test Case 2: Trigger Alert Manually
```bash
# Create traces that exceed threshold
curl -X POST http://localhost:3000/api/analytics/traces \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "span_name": "test_operation",
    "latency_ms": 2000,  // Exceeds threshold
    "status": "success"
  }'

# Wait 60 seconds for scheduler to evaluate

# Check evaluation history
SELECT * FROM metric_alert_rule_evaluations
WHERE triggered = true
ORDER BY evaluated_at DESC LIMIT 1;
```

- [ ] Alert triggered
- [ ] Email sent
- [ ] Webhook called (if configured)
- [ ] Evaluation recorded

#### Test Case 3: Cooldown Period
- [ ] Verify second alert not sent within cooldown
- [ ] Verify alert sent after cooldown expires

#### Test Case 4: Rule Filtering
- [ ] Create rule with model_filter
- [ ] Create traces with different models
- [ ] Verify only matching traces evaluated

#### Test Case 5: All Metric Types
Test each metric type:
- [ ] latency
- [ ] error_rate
- [ ] cost
- [ ] throughput
- [ ] ttft
- [ ] token_usage
- [ ] anomaly_severity

#### Test Case 6: All Aggregation Methods
- [ ] p50, p95, p99
- [ ] avg, max, min
- [ ] count, sum

#### Test Case 7: Edge Cases
- [ ] No traces in time window
- [ ] All traces filtered out
- [ ] Rule disabled mid-evaluation
- [ ] Database connection error

**Success Criteria**:
- [ ] All test cases pass
- [ ] No errors in logs
- [ ] Alerts sent correctly
- [ ] Performance acceptable (< 5s per evaluation)

**Estimated Time**: 1-2 hours

---

## 🚨 Risk Mitigation

### Breaking Change Verification
- ✅ **AlertType Union**: New types added at end (non-breaking)
- ✅ **Database Schema**: New tables don't affect existing queries
- ✅ **Scheduler**: New methods don't modify existing evaluation logic
- ✅ **API Routes**: New endpoint doesn't conflict with existing routes

### Rollback Procedures

**Phase 1 Rollback** (Database):
```sql
DROP TABLE IF EXISTS metric_alert_rule_evaluations CASCADE;
DROP TABLE IF EXISTS metric_alert_rules CASCADE;
```

**Phase 2 Rollback** (Types):
```bash
mv lib/alerts/alert.types.ts.backup lib/alerts/alert.types.ts
```

**Phase 3 Rollback** (API):
```bash
rm -rf app/api/analytics/alert-rules
```

**Phase 4 Rollback** (Scheduler):
```bash
mv lib/evaluation/scheduler-worker.ts.backup lib/evaluation/scheduler-worker.ts
```

**Phase 5 Rollback** (Deployment):
```bash
# Stop Render background worker
# OR disable Vercel cron
```

---

## ✅ Pre-Deployment Checklist

### Code Quality
- [ ] All TypeScript compiles without errors
- [ ] No console.error in production code (only logging)
- [ ] All functions have JSDoc comments
- [ ] No hard-coded values (use env vars)
- [ ] No TODO comments in production code

### Security
- [ ] RLS policies enforced on all tables
- [ ] User authentication required for all endpoints
- [ ] Input validation on all API parameters
- [ ] SQL injection prevention (using parameterized queries)
- [ ] Rate limiting considered (defer to AlertService)

### Performance
- [ ] Database indexes on frequently queried columns
- [ ] Evaluation completes in < 5 seconds
- [ ] No N+1 query problems
- [ ] Cooldown prevents alert spam

### Documentation
- [ ] Progress log created
- [ ] API endpoints documented
- [ ] Database schema documented
- [ ] Deployment instructions clear

---

## 📊 Success Metrics

### Functional Requirements
- [ ] Users can create/edit/delete alert rules via API
- [ ] Rules evaluated every 60 seconds
- [ ] Alerts sent when thresholds exceeded
- [ ] Cooldown period prevents spam
- [ ] All 7 metric types supported
- [ ] All 8 aggregation methods work
- [ ] Filters work correctly

### Performance Requirements
- [ ] Evaluation completes in < 5s (for 1000 traces)
- [ ] Database queries optimized with indexes
- [ ] No memory leaks in scheduler worker
- [ ] Scheduler recovers from errors

### Quality Requirements
- [ ] Zero TypeScript errors
- [ ] Zero breaking changes to existing code
- [ ] All tests pass
- [ ] Professional email formatting (Phase 6)

---

## 📅 Timeline

**Estimated Total Time**: 5-6 hours

| Phase | Duration | Dependencies |
|-------|----------|-------------|
| Phase 1: Database | 30 min | None |
| Phase 2: Types | 20 min | None (parallel with Phase 1) |
| Phase 3: API Routes | 30 min | Phase 1, 2 |
| Phase 4: Scheduler | 1 hour | Phase 2 |
| Phase 5: Deployment | 1 hour | Phase 4 |
| Phase 6: Formatting | 1 hour | Phase 3 (optional) |
| Phase 7: Testing | 1-2 hours | Phase 5 |

**Recommended Order**:
1. Phases 1 + 2 in parallel (50 min total)
2. Phase 3 (30 min)
3. Phase 4 (1 hour)
4. Phase 5 (1 hour)
5. Phase 7 (1-2 hours)
6. Phase 6 if time permits (1 hour)

---

## 🔍 Post-Implementation Tasks

### Monitoring
- [ ] Monitor scheduler worker logs
- [ ] Monitor evaluation performance
- [ ] Monitor alert delivery success rate
- [ ] Monitor database growth

### Documentation
- [ ] User guide for creating alert rules
- [ ] API reference documentation
- [ ] Troubleshooting guide
- [ ] Architecture documentation

### Future Enhancements
- [ ] UI components for rule management
- [ ] Advanced anomaly detection (ML-based)
- [ ] Alert escalation policies
- [ ] Alert grouping/deduplication
- [ ] Alert muting during maintenance
- [ ] Historical alert analytics
- [ ] Slack/Discord native integrations

---

## ❓ FAQ

**Q: Will this break existing alerts?**
A: No. All changes are additive. Existing job/batch test alerts continue to work.

**Q: What if scheduler worker crashes?**
A: Evaluations will resume when worker restarts. No data loss, just evaluation delay.

**Q: Can I run scheduler locally?**
A: Yes. Use `npm run scheduler:worker` with proper env vars.

**Q: How do I disable all metric alerts?**
A: Set all rules to `enabled = false` or stop scheduler worker.

**Q: What's the cost impact?**
A: Minimal. One database query per rule per minute. For 10 rules = 10 queries/min.

---

## 📞 Support

**Issues During Implementation**:
1. Stop at current phase
2. Review error logs
3. Check rollback procedure for current phase
4. Restore backup if needed
5. Report issue with full error details

**Testing Failures**:
1. Don't proceed to next phase
2. Investigate root cause
3. Fix issue or rollback
4. Re-test before continuing

---

**Plan Created**: 2025-12-25
**Plan Status**: ⏳ AWAITING USER APPROVAL
**Next Step**: User reviews and approves plan
**After Approval**: Begin Phase 1 (Database Migration)
