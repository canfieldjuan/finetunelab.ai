# Predictions Trends & Visualization - Implementation Plan
**Date:** 2025-12-09
**Status:** AWAITING APPROVAL
**Session Type:** Feature Enhancement - Permanent Implementation Plan

---

## Executive Summary

This plan adds **Prediction Trends & Visualization** to the existing predictions tracking system. Currently, predictions are displayed in a static table and side-by-side comparison view. This enhancement adds trend visualizations showing how prediction quality improves (or degrades) across training epochs.

**Core Value Proposition:**
- **Early Warning System**: Visual detection of quality degradation before training completes
- **Quality Progress Tracking**: Line charts showing score improvements epoch-over-epoch
- **Learning Velocity**: Rate of improvement metrics to optimize hyperparameters
- **Sample-Level Insights**: Track which samples improve vs. which remain problematic

**Current State:**
- ✅ Predictions stored in database with epoch/step tracking
- ✅ Scoring metrics computed (exact_match, char_error_rate, length_ratio, word_overlap)
- ✅ API endpoints for fetching predictions by job/epoch
- ✅ UI components: PredictionsTable, PredictionsComparison
- ❌ **Missing**: Score columns NOT in database schema
- ❌ **Missing**: Trend visualization across epochs
- ❌ **Missing**: Aggregate metrics (avg scores per epoch)

---

## Current Infrastructure Analysis

### Python Backend (Predictions Generation)

**Files:**
1. **`predictions_sampler.py`** - Loads random samples from dataset
2. **`predictions_generator.py`** - Generates predictions using model
3. **`predictions_scorer.py`** - Computes quality metrics
4. **`predictions_writer.py`** - Writes to database (lines 121-148)
5. **`predictions_callback.py`** - HuggingFace Trainer callback
6. **`predictions_config.py`** - Configuration validation

**Current Scoring Metrics** (computed but NOT stored):
```python
{
    'exact_match': float,        # 1.0 or 0.0
    'char_error_rate': float,    # 0.0 (perfect) to 1.0 (wrong)
    'length_ratio': float,       # prediction_len / truth_len
    'word_overlap': float        # 0.0 to 1.0
}
```

**Issue Found:** `predictions_writer.py:136-144` tries to write scores, but database schema **does NOT have these columns**!

### Database Schema

**Current Table:** `training_predictions`
```sql
CREATE TABLE training_predictions (
  id UUID PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  epoch INTEGER NOT NULL,
  step INTEGER NOT NULL,
  sample_index INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  ground_truth TEXT,
  prediction TEXT NOT NULL,
  created_at TIMESTAMPTZ
)
```

**Missing Columns:**
- `exact_match` FLOAT
- `char_error_rate` FLOAT
- `length_ratio` FLOAT
- `word_overlap` FLOAT

**Verification:** Checked `/home/juan-canfield/Desktop/web-ui/supabase/migrations/20251115115752_create_training_predictions_table.sql` - NO score columns exist.

### API Layer

**Existing Endpoints:**
1. **`GET /api/training/predictions/[jobId]`** - Fetch predictions with pagination
   - Supports `?epoch=N` filtering
   - Returns: predictions array, total_count, epoch_count
   - Location: `/home/juan-canfield/Desktop/web-ui/app/api/training/predictions/[jobId]/route.ts`

2. **`GET /api/training/predictions/[jobId]/epochs`** - Fetch epoch summary
   - Returns: epochs array with prediction_count, latest_step per epoch
   - Location: `/home/juan-canfield/Desktop/web-ui/app/api/training/predictions/[jobId]/epochs/route.ts`

**Missing Endpoints:**
- `GET /api/training/predictions/[jobId]/trends` - Aggregate metrics per epoch
- `GET /api/training/predictions/[jobId]/samples/[sampleIndex]/trend` - Single sample trend

### UI Components

**Existing Components:**
1. **`PredictionsTable.tsx`** (`/components/training/PredictionsTable.tsx`)
   - Displays predictions in table with epoch filtering
   - Shows: epoch, step, prompt, prediction, ground_truth
   - Pagination: 10 per page
   - Does NOT show scores (not in database)

2. **`PredictionsComparison.tsx`** (`/components/training/PredictionsComparison.tsx`)
   - Side-by-side comparison of same sample across epochs
   - Select sample index, shows all epochs
   - Does NOT show score trends

3. **Chart Infrastructure** (Recharts library)
   - Example: `GradNormChart.tsx` uses `LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`
   - Uses `useSharedTrainingMetrics` context for realtime data
   - Pattern: Loading state → Error state → Empty state → Chart

**Missing Components:**
- `PredictionsTrendsChart.tsx` - Line chart showing scores over epochs
- Aggregate metrics display (avg exact_match per epoch, etc.)

### TypeScript Types

**Current Types:** `/lib/training/types/predictions-types.ts`
```typescript
export interface TrainingPrediction {
  id: string;
  job_id: string;
  user_id: string;
  epoch: number;
  step: number;
  sample_index: number;
  prompt: string;
  ground_truth?: string;
  prediction: string;
  created_at: string;
  // MISSING: exact_match, char_error_rate, length_ratio, word_overlap
}
```

---

## Issues to Address

### Issue 1: Score Columns Missing from Database (CRITICAL)
**Location:** Database schema
**Problem:** Python code computes and tries to write scores, but columns don't exist
**Impact:** Scores are computed but silently dropped during database insert
**Evidence:**
- `predictions_writer.py:136-144` writes `exact_match`, etc.
- `training_predictions` table has NO such columns
- No error raised (silent failure)

### Issue 2: No Aggregate Metrics Endpoint (HIGH)
**Location:** API layer
**Problem:** No endpoint to get average scores per epoch
**Impact:** UI would need to fetch ALL predictions and compute averages client-side (inefficient)
**Required:** New endpoint returning `{epoch: number, avg_exact_match: float, ...}[]`

### Issue 3: No Visualization Components (HIGH)
**Location:** UI layer
**Problem:** No charts showing score trends across epochs
**Impact:** Users can't visually track quality improvement
**Required:** Line charts showing metrics over time

### Issue 4: TypeScript Types Incomplete (MEDIUM)
**Location:** Type definitions
**Problem:** `TrainingPrediction` interface missing score fields
**Impact:** Type safety issues when adding visualization

---

## Phased Implementation Plan

### Phase 1: Database Schema Migration (CRITICAL - BLOCKING)
**Effort:** 20 minutes
**Risk:** Low (additive change, no breaking)
**Dependencies:** None
**Blocks:** All other phases

**Changes:**
1. Create migration file: `supabase/migrations/20251209_add_prediction_scores.sql`
2. Add score columns to `training_predictions` table
3. Backfill strategy for existing data (NULL if no ground_truth)
4. Update indexes if needed

**Migration Content:**
```sql
-- Add scoring columns to training_predictions table
-- Date: 2025-12-09
-- Feature: Prediction trends visualization

ALTER TABLE training_predictions
  ADD COLUMN IF NOT EXISTS exact_match FLOAT,
  ADD COLUMN IF NOT EXISTS char_error_rate FLOAT,
  ADD COLUMN IF NOT EXISTS length_ratio FLOAT,
  ADD COLUMN IF NOT EXISTS word_overlap FLOAT;

-- Add index for efficient epoch-level aggregations
CREATE INDEX IF NOT EXISTS idx_training_predictions_job_epoch_scores
  ON training_predictions(job_id, epoch)
  WHERE exact_match IS NOT NULL;

-- Verify migration
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'training_predictions'
  AND column_name IN ('exact_match', 'char_error_rate', 'length_ratio', 'word_overlap');
```

**Verification Steps:**
1. Run migration in local Supabase
2. Verify columns exist with correct types
3. Verify index created
4. Test that existing predictions still load correctly
5. Test that new predictions with scores are stored

**Rollback Plan:**
```sql
ALTER TABLE training_predictions
  DROP COLUMN IF EXISTS exact_match,
  DROP COLUMN IF EXISTS char_error_rate,
  DROP COLUMN IF EXISTS length_ratio,
  DROP COLUMN IF EXISTS word_overlap;

DROP INDEX IF EXISTS idx_training_predictions_job_epoch_scores;
```

**Files to Verify After:**
- No code changes needed (writer already tries to write these columns)
- `predictions_writer.py:136-144` will now work correctly

---

### Phase 2: TypeScript Type Updates (LOW RISK)
**Effort:** 10 minutes
**Risk:** None (type-only changes)
**Dependencies:** Phase 1 (conceptual, not blocking)

**Changes:**

**File:** `/lib/training/types/predictions-types.ts`

**Lines 15-26** - Update `TrainingPrediction` interface:
```typescript
export interface TrainingPrediction {
  id: string;
  job_id: string;
  user_id: string;
  epoch: number;
  step: number;
  sample_index: number;
  prompt: string;
  ground_truth?: string;
  prediction: string;
  created_at: string;
  // Quality metrics (populated when ground_truth exists)
  exact_match?: number;        // 1.0 = perfect match, 0.0 = no match
  char_error_rate?: number;    // 0.0 = perfect, 1.0 = completely wrong
  length_ratio?: number;       // prediction_length / ground_truth_length
  word_overlap?: number;       // 0.0 to 1.0 word-level similarity
}
```

**Add new interfaces** (after line 51):
```typescript
/**
 * Aggregate metrics for a single epoch
 */
export interface PredictionEpochMetrics {
  epoch: number;
  step: number;
  sample_count: number;
  avg_exact_match: number | null;
  avg_char_error_rate: number | null;
  avg_length_ratio: number | null;
  avg_word_overlap: number | null;
  min_char_error_rate: number | null;
  max_char_error_rate: number | null;
}

/**
 * Response from trends endpoint
 */
export interface PredictionsTrendsResponse {
  job_id: string;
  trends: PredictionEpochMetrics[];
  overall_improvement: number | null; // % change from first to last epoch
}

/**
 * Single sample trend across epochs
 */
export interface SampleTrendPoint {
  epoch: number;
  step: number;
  prediction: string;
  exact_match: number | null;
  char_error_rate: number | null;
  word_overlap: number | null;
}

export interface SampleTrendResponse {
  job_id: string;
  sample_index: number;
  prompt: string;
  ground_truth: string | null;
  trend: SampleTrendPoint[];
}
```

**Verification:**
- TypeScript compilation should pass
- No breaking changes to existing components

---

### Phase 3: Aggregate Metrics API Endpoint (MEDIUM)
**Effort:** 40 minutes
**Risk:** Low (new endpoint, doesn't modify existing)
**Dependencies:** Phase 1 (database schema), Phase 2 (types)

**New File:** `/app/api/training/predictions/[jobId]/trends/route.ts`

**Implementation:**
```typescript
/**
 * @swagger
 * /api/training/predictions/{jobId}/trends:
 *   get:
 *     summary: Get prediction quality trends
 *     description: |
 *       Retrieve aggregated quality metrics across epochs for visualization.
 *
 *       Returns average scores per epoch, allowing trend analysis of model
 *       improvement during training.
 *     tags:
 *       - Metrics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trends retrieved successfully
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { PredictionsTrendsResponse } from '@/lib/training/types/predictions-types';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[Predictions Trends API] GET trends for job:', jobId);

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAuth = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify job ownership
    const jobQuery = await supabase
      .from('local_training_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobQuery.error || !jobQuery.data) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Fetch all predictions with scores
    const { data: predictions, error: predictionsError } = await supabase
      .from('training_predictions')
      .select('epoch, step, exact_match, char_error_rate, length_ratio, word_overlap')
      .eq('job_id', jobId)
      .order('epoch', { ascending: true });

    if (predictionsError) {
      console.error('[Predictions Trends API] Query error:', predictionsError);
      return NextResponse.json(
        { error: 'Failed to fetch trends' },
        { status: 500 }
      );
    }

    // Aggregate by epoch
    const epochMap = new Map<number, {
      epoch: number;
      step: number;
      samples: {
        exact_match: number | null;
        char_error_rate: number | null;
        length_ratio: number | null;
        word_overlap: number | null;
      }[];
    }>();

    for (const pred of predictions || []) {
      const existing = epochMap.get(pred.epoch);
      const sample = {
        exact_match: pred.exact_match,
        char_error_rate: pred.char_error_rate,
        length_ratio: pred.length_ratio,
        word_overlap: pred.word_overlap,
      };

      if (existing) {
        existing.samples.push(sample);
        existing.step = Math.max(existing.step, pred.step);
      } else {
        epochMap.set(pred.epoch, {
          epoch: pred.epoch,
          step: pred.step,
          samples: [sample],
        });
      }
    }

    // Compute averages
    const trends = Array.from(epochMap.values()).map((epochData) => {
      const samples = epochData.samples;
      const validExactMatch = samples.filter(s => s.exact_match !== null).map(s => s.exact_match!);
      const validCER = samples.filter(s => s.char_error_rate !== null).map(s => s.char_error_rate!);
      const validLengthRatio = samples.filter(s => s.length_ratio !== null).map(s => s.length_ratio!);
      const validWordOverlap = samples.filter(s => s.word_overlap !== null).map(s => s.word_overlap!);

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      const min = (arr: number[]) => arr.length > 0 ? Math.min(...arr) : null;
      const max = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : null;

      return {
        epoch: epochData.epoch,
        step: epochData.step,
        sample_count: samples.length,
        avg_exact_match: avg(validExactMatch),
        avg_char_error_rate: avg(validCER),
        avg_length_ratio: avg(validLengthRatio),
        avg_word_overlap: avg(validWordOverlap),
        min_char_error_rate: min(validCER),
        max_char_error_rate: max(validCER),
      };
    }).sort((a, b) => a.epoch - b.epoch);

    // Calculate overall improvement (first to last epoch CER)
    let overall_improvement = null;
    if (trends.length >= 2) {
      const firstCER = trends[0].avg_char_error_rate;
      const lastCER = trends[trends.length - 1].avg_char_error_rate;
      if (firstCER !== null && lastCER !== null && firstCER > 0) {
        overall_improvement = ((firstCER - lastCER) / firstCER) * 100;
      }
    }

    const response: PredictionsTrendsResponse = {
      job_id: jobId,
      trends,
      overall_improvement,
    };

    console.log('[Predictions Trends API] Returning', trends.length, 'trend points');
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Predictions Trends API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get trends',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

**Exact Insertion Point:** Create new file (doesn't exist yet)

**Verification Steps:**
1. Create file at exact path
2. Test endpoint with curl/Postman
3. Verify aggregations are correct
4. Test with job having no scores (should return null averages)
5. Test with job having mixed scored/unscored predictions

**No Breaking Changes:** New endpoint, doesn't affect existing code

---

### Phase 4: Trends Visualization Component (MEDIUM-HIGH)
**Effort:** 60 minutes
**Risk:** Low (new component, uses existing patterns)
**Dependencies:** Phase 2 (types), Phase 3 (API endpoint)

**New File:** `/components/training/PredictionsTrendsChart.tsx`

**Implementation Pattern:** Follow `GradNormChart.tsx` structure

**Component Structure:**
```typescript
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import type { PredictionsTrendsResponse } from '@/lib/training/types/predictions-types';

interface PredictionsTrendsChartProps {
  jobId: string;
  authToken: string;
}

export function PredictionsTrendsChart({
  jobId,
  authToken,
}: PredictionsTrendsChartProps) {
  const [trendsData, setTrendsData] = useState<PredictionsTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPredictions, setHasPredictions] = useState<boolean | null>(null);

  const checkPredictions = useCallback(async () => {
    try {
      const url = `/api/training/predictions/${jobId}?limit=1`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        setHasPredictions(false);
        return;
      }

      const data = await response.json();
      const exists = (data.total_count || 0) > 0;
      setHasPredictions(exists);
    } catch (err) {
      console.error('[PredictionsTrendsChart] Error checking predictions:', err);
      setHasPredictions(false);
    }
  }, [jobId, authToken]);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = `/api/training/predictions/${jobId}/trends`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trends');
      }

      const data = await response.json();
      setTrendsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [jobId, authToken]);

  useEffect(() => {
    checkPredictions();
  }, [checkPredictions]);

  useEffect(() => {
    if (hasPredictions === true) {
      fetchTrends();
      const interval = setInterval(fetchTrends, 30000); // Poll every 30s
      return () => clearInterval(interval);
    } else if (hasPredictions === false) {
      setLoading(false);
    }
  }, [hasPredictions, fetchTrends]);

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prediction Quality Trends</CardTitle>
          <CardDescription>Loading trends data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8 text-gray-500">
            <div className="animate-spin mr-3 h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prediction Quality Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>Error loading trends: {error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // No predictions state
  if (!trendsData || trendsData.trends.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prediction Quality Trends</CardTitle>
          <CardDescription>Track quality improvement across epochs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-gray-500">
            <Info className="mx-auto mb-2 h-8 w-8" />
            <p className="font-medium">No prediction data available yet</p>
            <p className="text-sm mt-1">Trends will appear as training progresses</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const trends = trendsData.trends;
  const hasScores = trends.some(t => t.avg_char_error_rate !== null);

  // No scores state (predictions exist but no ground truth)
  if (!hasScores) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prediction Quality Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Predictions found, but no quality scores available.
              Ensure your dataset includes ground truth responses.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Chart data
  const improvement = trendsData.overall_improvement;
  const improvementText = improvement !== null
    ? `${improvement > 0 ? '↓' : '↑'} ${Math.abs(improvement).toFixed(1)}%`
    : 'N/A';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Prediction Quality Trends</CardTitle>
            <CardDescription>
              Quality metrics across {trends.length} epochs
            </CardDescription>
          </div>
          {improvement !== null && (
            <div className="text-right">
              <div className="text-sm text-gray-600">Overall Improvement</div>
              <div className={`text-lg font-semibold flex items-center gap-1 ${
                improvement > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {improvement > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {improvementText}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Character Error Rate Chart (lower is better) */}
          <div>
            <h4 className="text-sm font-medium mb-2">Character Error Rate (CER)</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="epoch"
                  label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }}
                />
                <YAxis
                  label={{ value: 'Error Rate', angle: -90, position: 'insideLeft' }}
                  domain={[0, 1]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white border border-gray-200 p-3 rounded shadow-lg">
                          <p className="font-semibold">Epoch {data.epoch}</p>
                          <p className="text-sm text-gray-600">Step {data.step}</p>
                          <p className="text-sm">Avg CER: {data.avg_char_error_rate?.toFixed(3) || 'N/A'}</p>
                          <p className="text-xs text-gray-500">
                            Range: {data.min_char_error_rate?.toFixed(3)} - {data.max_char_error_rate?.toFixed(3)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avg_char_error_rate"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Avg Error Rate"
                  dot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-1">Lower is better. 0.0 = perfect match, 1.0 = completely wrong</p>
          </div>

          {/* Exact Match Rate Chart */}
          <div>
            <h4 className="text-sm font-medium mb-2">Exact Match Rate</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="epoch"
                  label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }}
                />
                <YAxis
                  label={{ value: 'Match Rate', angle: -90, position: 'insideLeft' }}
                  domain={[0, 1]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white border border-gray-200 p-3 rounded shadow-lg">
                          <p className="font-semibold">Epoch {data.epoch}</p>
                          <p className="text-sm">
                            Exact Match: {((data.avg_exact_match || 0) * 100).toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-500">{data.sample_count} samples</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avg_exact_match"
                  stroke="#22c55e"
                  strokeWidth={2}
                  name="Exact Match %"
                  dot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-1">Higher is better. 1.0 = perfect match</p>
          </div>

          {/* Word Overlap Chart */}
          <div>
            <h4 className="text-sm font-medium mb-2">Word Overlap</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="epoch"
                  label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }}
                />
                <YAxis
                  label={{ value: 'Overlap Score', angle: -90, position: 'insideLeft' }}
                  domain={[0, 1]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white border border-gray-200 p-3 rounded shadow-lg">
                          <p className="font-semibold">Epoch {data.epoch}</p>
                          <p className="text-sm">
                            Word Overlap: {((data.avg_word_overlap || 0) * 100).toFixed(1)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avg_word_overlap"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Word Overlap"
                  dot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-1">Higher is better. Measures word-level similarity</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Exact Insertion Point:** Create new file (doesn't exist yet)

**Verification Steps:**
1. Create file at exact path
2. Test component renders with mock data
3. Test loading/error/empty states
4. Test with real training job
5. Verify charts update on interval
6. Test responsiveness on different screen sizes

**Integration Point:** `/app/training/monitor/page.tsx`

**Line to add (after line 97):**
```typescript
const PredictionsTrendsChart = dynamic(() => import('@/components/training/PredictionsTrendsChart').then(mod => ({ default: mod.PredictionsTrendsChart })), {
  ssr: false,
  loading: () => <div>Loading trends chart...</div>,
});
```

**Line to add component (after line 990, inside predictions section):**
```tsx
<PredictionsTrendsChart
  jobId={jobId}
  authToken={sessionToken}
/>
```

**No Breaking Changes:** New component, doesn't modify existing

---

### Phase 5: Testing & Validation (CRITICAL)
**Effort:** 30 minutes
**Risk:** None (testing only)
**Dependencies:** All previous phases

**Test Cases:**

1. **Database Schema:**
   - ✅ Score columns exist with correct types
   - ✅ Indexes created
   - ✅ Existing predictions still load
   - ✅ New predictions with scores are stored correctly

2. **API Endpoints:**
   - ✅ `/trends` endpoint returns correct aggregations
   - ✅ Handles jobs with no predictions
   - ✅ Handles predictions without scores
   - ✅ Handles mixed scored/unscored predictions
   - ✅ Auth validation works

3. **UI Components:**
   - ✅ Chart renders with multiple epochs
   - ✅ Chart handles single epoch
   - ✅ Chart handles no scores
   - ✅ Loading state shows correctly
   - ✅ Error state shows correctly
   - ✅ Auto-refresh works
   - ✅ Tooltips show correct data

4. **Integration:**
   - ✅ Full training run with predictions enabled
   - ✅ Scores computed and stored
   - ✅ Charts update in real-time
   - ✅ No performance degradation
   - ✅ No memory leaks from polling

**Verification Commands:**
```bash
# Test database migration
psql -d your_db -f supabase/migrations/20251209_add_prediction_scores.sql

# Test API endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/training/predictions/job_123/trends

# Test TypeScript compilation
npx tsc --noEmit

# Run training with predictions
python standalone_trainer.py --config test_config.json
```

---

## Files to Modify/Create

### New Files:
1. **`supabase/migrations/20251209_add_prediction_scores.sql`** - Database schema migration
2. **`app/api/training/predictions/[jobId]/trends/route.ts`** - Trends API endpoint
3. **`components/training/PredictionsTrendsChart.tsx`** - Visualization component

### Modified Files:
1. **`lib/training/types/predictions-types.ts`** - Add score fields to types (lines 15-26, after line 51)
2. **`app/training/monitor/page.tsx`** - Import and render new chart (lines 97, 990)

### No Changes Needed:
- ✅ `predictions_writer.py` - Already tries to write scores (will now work)
- ✅ `predictions_scorer.py` - Already computes scores correctly
- ✅ `predictions_generator.py` - Already passes scores to writer
- ✅ Existing API endpoints - No modifications needed
- ✅ Existing UI components - No modifications needed

---

## Risk Assessment

| Phase | Risk Level | Impact if Fails | Mitigation |
|-------|-----------|-----------------|------------|
| Phase 1 (DB Migration) | Low | Scores not stored | Simple rollback, test in dev first |
| Phase 2 (TypeScript Types) | None | Type errors only | Easy to fix, no runtime impact |
| Phase 3 (API Endpoint) | Low | Trends not available | Doesn't affect existing features |
| Phase 4 (UI Component) | Low | Chart doesn't render | Doesn't break existing predictions |
| Phase 5 (Testing) | None | Bugs found | Expected, fixable |

**Overall Risk:** LOW - All changes are additive, no modifications to existing working code

---

## Breaking Changes Analysis

### Database Schema (Phase 1):
- ✅ **NO BREAKING CHANGES** - Adding columns is non-breaking
- Existing predictions: Columns will be NULL (acceptable)
- New predictions: Columns will populate if ground_truth exists
- Existing queries: Still work (don't select new columns)

### API Layer (Phase 3):
- ✅ **NO BREAKING CHANGES** - New endpoint, doesn't modify existing
- Existing `/predictions/[jobId]` endpoint: Unchanged
- Existing `/predictions/[jobId]/epochs` endpoint: Unchanged

### UI Layer (Phase 4):
- ✅ **NO BREAKING CHANGES** - New component added alongside existing
- Existing `PredictionsTable`: Unchanged
- Existing `PredictionsComparison`: Unchanged
- Monitor page: New component added, existing components unmodified

### Python Backend:
- ✅ **NO CHANGES NEEDED** - Already tries to write scores
- Once Phase 1 complete, scores will magically start being stored
- No code modifications required

---

## Success Criteria

### Must Have (Blocking):
- [x] Database migration runs successfully
- [ ] Score columns exist and accept data
- [ ] Trends API endpoint returns correct aggregations
- [ ] Charts render with real training data
- [ ] No breaking changes to existing features
- [ ] All existing tests pass

### Should Have:
- [ ] Charts auto-refresh during training
- [ ] Multiple chart types (CER, exact match, word overlap)
- [ ] Overall improvement % displayed
- [ ] Tooltips show detailed epoch info
- [ ] Loading/error/empty states handled

### Nice to Have:
- [ ] Chart export to PNG/CSV
- [ ] Configurable chart metrics display
- [ ] Sample-level trend drilling
- [ ] Comparison across multiple jobs

---

## Dependencies

### External:
- Recharts library (already installed, used by existing charts)
- Supabase SDK (already installed)
- React/Next.js (existing)

### Internal:
- Phase 1 blocks all other phases (database schema required)
- Phase 2 conceptually depends on Phase 1 (types match schema)
- Phase 3 depends on Phase 1 (needs columns to aggregate)
- Phase 4 depends on Phase 2 (types) and Phase 3 (API endpoint)
- Phase 5 depends on all previous phases

---

## Rollback Plan

### Full Rollback (if critical issues):
1. Drop new database columns (SQL in Phase 1)
2. Delete `/app/api/training/predictions/[jobId]/trends/route.ts`
3. Delete `/components/training/PredictionsTrendsChart.tsx`
4. Revert changes to `predictions-types.ts`
5. Revert changes to `app/training/monitor/page.tsx`

### Partial Rollback:
- **Phase 1 only:** Drop columns, system returns to current state
- **Phase 1-3 only:** Keep backend, remove UI component
- **Hide UI only:** Keep all backend, comment out component in monitor page

---

## Future Enhancements (Out of Scope)

1. **BLEU Score Integration** - Add industry-standard metric
2. **Sample-Level Trends** - Drill down to individual sample improvement
3. **Multi-Job Comparison** - Compare trends across different training runs
4. **Export Functionality** - Download charts as PNG/CSV
5. **Configurable Metrics** - Let users choose which metrics to display
6. **Diversity Metrics** - Track response diversity, repetition detection
7. **Confidence Scores** - Add model logits/probabilities
8. **Semantic Similarity** - TF-IDF or embedding-based metrics
9. **Real-Time Alerts** - Notify on quality degradation
10. **Learning Velocity** - Rate of improvement calculations

---

## Post-Implementation Monitoring

### Metrics to Track:
1. **Database Performance:**
   - Query time for trends aggregation
   - Index usage on `idx_training_predictions_job_epoch_scores`
   - Table size growth

2. **API Performance:**
   - `/trends` endpoint response time
   - Error rate
   - Cache hit rate (if caching added later)

3. **UI Performance:**
   - Chart render time
   - Memory usage from polling
   - User engagement with trends feature

### Success Indicators:
- Users enable predictions more frequently
- Early training termination increases (catching bad runs faster)
- Support requests about "model not learning" decrease
- Positive feedback on visual quality tracking

---

## Context for Session Continuity

### What This Plan Builds On:
1. **Recent Masking Fixes (2025-12-09):**
   - Fixed response template masking issues
   - Added auto-pretokenization for chat models
   - Improved template detection (6 formats supported)
   - Fixed predictions format to use chat templates

2. **Existing Predictions System:**
   - Sampler, generator, scorer, writer already implemented
   - Callback integration with HuggingFace Trainer working
   - API endpoints for fetching predictions exist
   - UI table and comparison views functional

### Why This Enhancement Matters:
User quote: "These predictions are sooo valuable. keeps you from even testing a shitty trained model. and watching thr responses improve is facinating"

Current gap: Users can see individual predictions but NOT trends over time. This plan adds the missing visualization layer to make quality progression immediately visible.

### Integration with Existing Systems:
- **Database:** Builds on existing `training_predictions` table
- **API:** Adds new endpoint alongside existing ones
- **UI:** New component follows existing chart patterns (GradNormChart, etc.)
- **Python:** No changes needed (already computes and tries to write scores)

---

**Status:** AWAITING USER APPROVAL
**Next Action:** User review and approval of phased plan
**Estimated Total Time:** 2.5 hours (all phases)
**Recommended Approach:** Implement Phase 1-4 sequentially, thorough testing in Phase 5

---

**Prepared By:** Claude Sonnet 4.5
**Date:** 2025-12-09
**Session:** Predictions Trends & Visualization Implementation Planning
