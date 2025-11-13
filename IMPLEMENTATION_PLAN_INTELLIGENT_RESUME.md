# Implementation Plan: Intelligent Resume with Config Suggestions

**Feature:** Add intelligent failure analysis and configuration suggestions to checkpoint resume functionality

**Date:** 2025-11-10

**Status:** Awaiting Approval

---

## Executive Summary

### Current State
- ✅ CheckpointResumeCard UI exists
- ✅ Resume API exists
- ✅ Database has `error_message` column
- ❌ **GAP:** Training server sends "error" but DB expects "error_message"
- ❌ **GAP:** No error analysis/suggestions
- ❌ **GAP:** No config adjustment UI

### Goal
Allow users to resume failed training with intelligent configuration suggestions while maintaining full control over parameters.

---

## Critical Findings & Risks

### 🔴 Breaking Change Risk: NONE
- CheckpointResumeCard only used in `/app/training/monitor/page.tsx`
- All changes are **additive** (new fields, new logic)
- Existing resume functionality remains unchanged

### 🟡 Field Mismatch Bug (Must Fix First)
**Problem:** Training server saves errors as "error" but database column is "error_message"

**Impact:** Error messages not persisting to database

**Files Affected:**
- `/lib/training/training_server.py` (line 1386)
- `/app/api/training/local/jobs/route.ts` (missing error_message in destructuring)

**Fix Required:** Phase 1 (Foundation)

---

## Implementation Phases

### ✅ Phase 0: Pre-Implementation Verification (Complete)

**Tasks:**
- [x] Verify database schema supports error_message
- [x] Confirm CheckpointResumeCard integration points
- [x] Identify all affected files
- [x] Document current data flow

**Findings:**
- Database migration: `20251103000002_add_training_progress_columns.sql`
- Column exists: `error_message TEXT DEFAULT NULL`
- Index exists: `idx_local_training_jobs_error` on (status, error_message)

---

### 🔧 Phase 1: Foundation - Fix Error Persistence (2-3 hours)

**Goal:** Ensure error messages are properly saved to database

#### 1.1 Fix Training Server Error Field

**File:** `/lib/training/training_server.py`

**Location:** Lines 1370-1392 (monitor_job function)

**Change:**
```python
# BEFORE (line 1386):
"error": job.error,

# AFTER:
"error_message": job.error,
```

**Additional Locations to Check:**
- Search for all `persist_job()` calls
- Verify all pass "error_message" not "error"

**Validation:**
```bash
grep -n '"error":' /home/juan-canfield/Desktop/web-ui/lib/training/training_server.py
```

#### 1.2 Update API to Accept error_message

**File:** `/app/api/training/local/jobs/route.ts`

**Location:** Lines 85-130 (request body destructuring)

**Change:**
```typescript
// Add to destructuring (line ~130):
const {
  // ... existing fields ...
  error_message,  // ADD THIS
  last_parameter_update_at
} = body;
```

**Location:** Lines 158-200 (LocalTrainingJobData interface)

**Change:**
```typescript
interface LocalTrainingJobData {
  // ... existing fields ...
  error_message?: string;  // ADD THIS
  last_parameter_update_at?: string;
}
```

**Location:** Lines 200-250 (jobData object construction)

**Change:**
```typescript
const jobData: LocalTrainingJobData = {};

// ... existing field assignments ...

if (error_message !== undefined) {
  jobData.error_message = error_message;
}
```

#### 1.3 Validation Tests

**Test 1:** Trigger OOM Error
```bash
# Run training with insufficient memory
# Verify error_message appears in database
```

**Test 2:** Query Database
```sql
SELECT id, status, error_message
FROM local_training_jobs
WHERE status = 'failed'
ORDER BY started_at DESC
LIMIT 5;
```

**Expected:** error_message populated with actual error text

**Breaking Change Risk:** ❌ NONE (additive only)

---

### 🧠 Phase 2: Error Analysis Logic (3-4 hours)

**Goal:** Create backend logic to analyze errors and generate suggestions

#### 2.1 Create Error Analyzer Module

**File:** `/lib/training/error_analyzer.py` (NEW FILE)

**Content:**
```python
"""
Error Analysis and Configuration Suggestions

Analyzes training failures and generates intelligent configuration
adjustments to prevent recurrence.

Date: 2025-11-10
"""

import re
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class ConfigSuggestion:
    """Single configuration adjustment suggestion"""
    field: str
    current_value: any
    suggested_value: any
    reason: str
    impact: str  # e.g., "~75% memory reduction"


@dataclass
class FailureAnalysis:
    """Complete failure analysis with suggestions"""
    error_type: str  # 'oom_eval', 'oom_training', 'timeout', etc.
    error_phase: str  # 'evaluation', 'training', 'initialization'
    suggestions: List[ConfigSuggestion]
    description: str
    confidence: str  # 'high', 'medium', 'low'


def analyze_training_failure(
    error_message: str,
    config: Dict
) -> FailureAnalysis:
    """
    Analyze training failure and generate suggestions

    Args:
        error_message: Error message from training logs
        config: Training configuration dict

    Returns:
        FailureAnalysis with suggestions
    """

    # OOM during evaluation
    if 'CUDA out of memory' in error_message:
        if 'eval' in error_message.lower():
            return _analyze_oom_eval(error_message, config)
        else:
            return _analyze_oom_training(error_message, config)

    # Timeout
    elif 'timeout' in error_message.lower() or 'no progress' in error_message.lower():
        return _analyze_timeout(error_message, config)

    # Unknown error
    else:
        return FailureAnalysis(
            error_type='unknown',
            error_phase='unknown',
            suggestions=[],
            description='Unknown error occurred',
            confidence='low'
        )


def _analyze_oom_eval(error_message: str, config: Dict) -> FailureAnalysis:
    """Analyze OOM during evaluation"""

    suggestions = []

    # Eval batch size
    current_eval_batch = config.get('per_device_eval_batch_size', 4)
    if current_eval_batch > 1:
        suggestions.append(ConfigSuggestion(
            field='per_device_eval_batch_size',
            current_value=current_eval_batch,
            suggested_value=max(1, current_eval_batch // 2),
            reason='Reduces memory per evaluation step',
            impact=f'~{50}% eval memory reduction'
        ))

    # Eval accumulation
    current_eval_accum = config.get('eval_accumulation_steps', 10)
    if current_eval_accum > 2:
        suggestions.append(ConfigSuggestion(
            field='eval_accumulation_steps',
            current_value=current_eval_accum,
            suggested_value=max(1, current_eval_accum // 5),
            reason='Limits samples held in memory during evaluation',
            impact=f'~{80}% eval memory reduction'
        ))

    # Gradient checkpointing
    if not config.get('gradient_checkpointing', False):
        suggestions.append(ConfigSuggestion(
            field='gradient_checkpointing',
            current_value=False,
            suggested_value=True,
            reason='Trades compute for memory by recomputing activations',
            impact='15-20% additional memory savings (10% slower)'
        ))

    # Calculate total impact
    total_impact = 75 if len(suggestions) >= 2 else 50

    return FailureAnalysis(
        error_type='oom_eval',
        error_phase='evaluation',
        suggestions=suggestions,
        description=f'CUDA Out of Memory during evaluation. Estimated {total_impact}% memory reduction needed.',
        confidence='high'
    )


def _analyze_oom_training(error_message: str, config: Dict) -> FailureAnalysis:
    """Analyze OOM during training"""

    suggestions = []

    # Train batch size
    current_train_batch = config.get('per_device_train_batch_size', 4)
    if current_train_batch > 1:
        suggestions.append(ConfigSuggestion(
            field='per_device_train_batch_size',
            current_value=current_train_batch,
            suggested_value=max(1, current_train_batch // 2),
            reason='Reduces memory per training step',
            impact='~50% training memory reduction'
        ))

    # Gradient accumulation (increase to maintain effective batch size)
    current_grad_accum = config.get('gradient_accumulation_steps', 1)
    suggestions.append(ConfigSuggestion(
        field='gradient_accumulation_steps',
        current_value=current_grad_accum,
        suggested_value=current_grad_accum * 2,
        reason='Maintains effective batch size while using less memory',
        impact='No impact on convergence'
    ))

    # Gradient checkpointing
    if not config.get('gradient_checkpointing', False):
        suggestions.append(ConfigSuggestion(
            field='gradient_checkpointing',
            current_value=False,
            suggested_value=True,
            reason='Saves memory by recomputing activations during backward pass',
            impact='20-30% memory savings (10-15% slower)'
        ))

    return FailureAnalysis(
        error_type='oom_training',
        error_phase='training',
        suggestions=suggestions,
        description='CUDA Out of Memory during training. Reduce batch size and enable memory optimizations.',
        confidence='high'
    )


def _analyze_timeout(error_message: str, config: Dict) -> FailureAnalysis:
    """Analyze timeout failures"""

    suggestions = []

    # Check if evaluation is too slow
    current_eval_batch = config.get('per_device_eval_batch_size', 4)
    if current_eval_batch < 8:
        suggestions.append(ConfigSuggestion(
            field='per_device_eval_batch_size',
            current_value=current_eval_batch,
            suggested_value=current_eval_batch * 2,
            reason='Increases evaluation speed',
            impact='~2x faster evaluation'
        ))

    # Reduce eval frequency
    current_eval_steps = config.get('eval_steps', 100)
    if current_eval_steps < 500:
        suggestions.append(ConfigSuggestion(
            field='eval_steps',
            current_value=current_eval_steps,
            suggested_value=current_eval_steps * 2,
            reason='Evaluates less frequently, reducing overhead',
            impact='~2x faster overall training'
        ))

    return FailureAnalysis(
        error_type='timeout',
        error_phase='evaluation',
        suggestions=suggestions,
        description='Training timed out due to slow progress. Optimize evaluation frequency.',
        confidence='medium'
    )
```

**Validation:**
- Unit tests for each error type
- Verify suggestions are sensible
- Test with real error messages

**Breaking Change Risk:** ❌ NONE (new file)

---

### 🔌 Phase 3: Failure Analysis API (2 hours)

**Goal:** Expose error analysis via API

#### 3.1 Create Analysis Endpoint

**File:** `/app/api/training/local/[jobId]/analyze-failure/route.ts` (NEW FILE)

**Content:**
```typescript
/**
 * Training Failure Analysis API
 * GET /api/training/local/[jobId]/analyze-failure
 *
 * Analyzes a failed training job and returns intelligent config suggestions
 * Date: 2025-11-10
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[AnalyzeFailure] GET request for job:', jobId);

  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get job from database
    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify job is failed/cancelled
    if (!['failed', 'cancelled'].includes(job.status)) {
      return NextResponse.json(
        { error: 'Can only analyze failed/cancelled jobs' },
        { status: 400 }
      );
    }

    // Call Python error analyzer
    const pythonPath = process.env.VLLM_PYTHON_PATH || process.env.PYTHON_PATH || 'python3';
    const scriptPath = process.cwd() + '/lib/training/analyze_error_cli.py';

    const analysisCommand = `${pythonPath} ${scriptPath} --job-id ${jobId} --error "${job.error_message || ''}" --config '${JSON.stringify(job.config)}'`;

    console.log('[AnalyzeFailure] Running analysis...');

    const { stdout, stderr } = await execAsync(analysisCommand, {
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });

    if (stderr) {
      console.warn('[AnalyzeFailure] stderr:', stderr);
    }

    const analysis = JSON.parse(stdout);

    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.error('[AnalyzeFailure] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze failure',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

#### 3.2 Create CLI Wrapper for Python

**File:** `/lib/training/analyze_error_cli.py` (NEW FILE)

**Content:**
```python
"""
CLI wrapper for error_analyzer.py

Usage:
  python analyze_error_cli.py --job-id <id> --error "<msg>" --config '{...}'
"""

import sys
import json
import argparse
from error_analyzer import analyze_training_failure


def main():
    parser = argparse.ArgumentParser(description='Analyze training failure')
    parser.add_argument('--job-id', required=True, help='Training job ID')
    parser.add_argument('--error', required=True, help='Error message')
    parser.add_argument('--config', required=True, help='Training config (JSON)')

    args = parser.parse_args()

    try:
        config = json.loads(args.config)
    except json.JSONDecodeError as e:
        print(json.dumps({
            "error": f"Invalid config JSON: {e}",
            "error_type": "invalid_input"
        }), file=sys.stderr)
        sys.exit(1)

    # Analyze failure
    analysis = analyze_training_failure(args.error, config)

    # Convert to JSON-serializable dict
    result = {
        "error_type": analysis.error_type,
        "error_phase": analysis.error_phase,
        "description": analysis.description,
        "confidence": analysis.confidence,
        "suggestions": [
            {
                "field": s.field,
                "current_value": s.current_value,
                "suggested_value": s.suggested_value,
                "reason": s.reason,
                "impact": s.impact
            }
            for s in analysis.suggestions
        ]
    }

    # Output JSON to stdout
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
```

**Validation:**
```bash
# Test the CLI
python /home/juan-canfield/Desktop/web-ui/lib/training/analyze_error_cli.py \
  --job-id test-123 \
  --error "CUDA out of memory during eval" \
  --config '{"per_device_eval_batch_size": 4, "eval_accumulation_steps": 10}'
```

**Expected:** JSON output with suggestions

**Breaking Change Risk:** ❌ NONE (new files)

---

### 🎨 Phase 4: UI - Config Adjustment Interface (4-5 hours)

**Goal:** Update CheckpointResumeCard with suggestions and config controls

#### 4.1 Add State and Data Fetching

**File:** `/components/training/CheckpointResumeCard.tsx`

**Location:** Lines 29-37 (state declarations)

**Add:**
```typescript
// New state for failure analysis
const [failureAnalysis, setFailureAnalysis] = useState<FailureAnalysis | null>(null);
const [resumeMode, setResumeMode] = useState<'adjust' | 'original'>('adjust');
const [configAdjustments, setConfigAdjustments] = useState<Record<string, any>>({});
const [fetchingAnalysis, setFetchingAnalysis] = useState(false);
const [analysisError, setAnalysisError] = useState<string | null>(null);
```

**Location:** After line 76 (add new useEffect)

**Add:**
```typescript
// Fetch failure analysis when component loads
useEffect(() => {
  const fetchAnalysis = async () => {
    setFetchingAnalysis(true);
    setAnalysisError(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_TRAINING_BACKEND_URL || 'http://localhost:8000';
      const authData = localStorage.getItem('sb-' + supabaseUrl.split('//')[1].split('.')[0] + '-auth-token');
      if (!authData) {
        throw new Error('Not authenticated');
      }

      const { access_token } = JSON.parse(authData);

      const response = await fetch(`/api/training/local/${jobId}/analyze-failure`, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch analysis: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[CheckpointResumeCard] Analysis fetched:', data);

      setFailureAnalysis(data.analysis);

      // Pre-fill config adjustments with suggestions
      const initialAdjustments: Record<string, any> = {};
      data.analysis.suggestions.forEach((suggestion: any) => {
        initialAdjustments[suggestion.field] = suggestion.suggested_value;
      });
      setConfigAdjustments(initialAdjustments);

    } catch (err) {
      console.error('[CheckpointResumeCard] Error fetching analysis:', err);
      setAnalysisError(err instanceof Error ? err.message : 'Failed to analyze failure');
    } finally {
      setFetchingAnalysis(false);
    }
  };

  if (jobStatus === 'failed') {
    fetchAnalysis();
  }
}, [jobId, jobStatus]);
```

#### 4.2 Update Resume Handler

**Location:** Lines 79-138 (handleResume function)

**Modify:**
```typescript
const handleResume = async () => {
  setLoading(true);
  setError(null);
  setSuccess(false);

  try {
    // ... existing auth code ...

    // Build resume request with config adjustments if in adjust mode
    const resumePayload: any = {
      checkpoint_path: resumeFromBest ? undefined : selectedCheckpoint,
      resume_from_best: resumeFromBest,
    };

    // Add config adjustments if in adjust mode
    if (resumeMode === 'adjust' && Object.keys(configAdjustments).length > 0) {
      resumePayload.config_adjustments = configAdjustments;
    }

    console.log('[CheckpointResumeCard] Submitting resume request with adjustments');

    const response = await fetch(`/api/training/local/${jobId}/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
      body: JSON.stringify(resumePayload),
    });

    // ... rest of existing code ...
  } catch (err) {
    // ... existing error handling ...
  }
};
```

#### 4.3 Add Config Adjustment UI

**Location:** Lines 197-280 (between header and resume button)

**Add After Line 227:**
```typescript
{/* Resume Mode Selector */}
<div className="space-y-2">
  <label className="block text-sm font-medium text-gray-700">Resume Strategy</label>
  <div className="flex items-center space-x-4">
    <label className="flex items-center">
      <input
        type="radio"
        name="resume-mode"
        checked={resumeMode === 'adjust'}
        onChange={() => setResumeMode('adjust')}
        className="mr-2"
      />
      <span className="text-sm">Adjust Config (recommended)</span>
    </label>
    <label className="flex items-center">
      <input
        type="radio"
        name="resume-mode"
        checked={resumeMode === 'original'}
        onChange={() => setResumeMode('original')}
        className="mr-2"
      />
      <span className="text-sm text-amber-600">Use Original Config (risky)</span>
    </label>
  </div>
</div>

{/* Failure Analysis and Suggestions */}
{resumeMode === 'adjust' && failureAnalysis && (
  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md space-y-3">
    <div className="flex items-start">
      <div className="flex-shrink-0">
        <svg className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="ml-3 flex-1">
        <h4 className="text-sm font-medium text-blue-900">
          {failureAnalysis.description}
        </h4>
        <p className="text-xs text-blue-700 mt-1">
          Detected: {failureAnalysis.error_type.replace(/_/g, ' ')} during {failureAnalysis.error_phase}
        </p>
      </div>
    </div>

    <div className="space-y-3 mt-3">
      <p className="text-sm font-medium text-blue-900">Suggested Changes (you can modify):</p>

      {failureAnalysis.suggestions.map((suggestion: any, index: number) => (
        <div key={index} className="bg-white p-3 rounded border border-blue-200">
          <div className="flex justify-between items-start mb-2">
            <label className="text-sm font-medium text-gray-900">
              {suggestion.field.replace(/_/g, ' ')}
            </label>
            <span className="text-xs text-green-600 font-medium">
              {suggestion.impact}
            </span>
          </div>

          <div className="flex items-center space-x-3 mb-2">
            <div className="flex-1">
              <span className="text-xs text-gray-600">Current:</span>
              <span className="ml-2 text-sm font-mono text-gray-900">
                {JSON.stringify(suggestion.current_value)}
              </span>
            </div>
            <div className="flex-1">
              <span className="text-xs text-gray-600">Suggested:</span>
              <input
                type="number"
                value={configAdjustments[suggestion.field] ?? suggestion.suggested_value}
                onChange={(e) => {
                  const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                  setConfigAdjustments(prev => ({
                    ...prev,
                    [suggestion.field]: value
                  }));
                }}
                className="ml-2 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <p className="text-xs text-gray-600 italic">
            {suggestion.reason}
          </p>
        </div>
      ))}
    </div>
  </div>
)}

{/* Loading analysis state */}
{resumeMode === 'adjust' && fetchingAnalysis && (
  <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
    <p className="text-sm text-gray-600">Analyzing failure...</p>
  </div>
)}

{/* Analysis error state */}
{resumeMode === 'adjust' && analysisError && !failureAnalysis && (
  <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
    <p className="text-sm text-amber-700">
      Could not analyze failure: {analysisError}
    </p>
    <p className="text-xs text-amber-600 mt-1">
      You can still resume with original config or manually adjust parameters.
    </p>
  </div>
)}
```

#### 4.4 Update TypeScript Interfaces

**Location:** Top of file (add new interfaces)

**Add:**
```typescript
interface ConfigSuggestion {
  field: string;
  current_value: any;
  suggested_value: any;
  reason: string;
  impact: string;
}

interface FailureAnalysis {
  error_type: string;
  error_phase: string;
  suggestions: ConfigSuggestion[];
  description: string;
  confidence: string;
}
```

**Breaking Change Risk:** ❌ NONE (all changes are additive)

---

### 🔌 Phase 5: Update Resume API to Accept Config Adjustments (1 hour)

**Goal:** Modify resume API to merge config adjustments

**File:** `/app/api/training/local/[jobId]/resume/route.ts`

**Location:** Lines 74-77 (request body parsing)

**Add:**
```typescript
const { checkpoint_path, resume_from_best, config_adjustments } = body;

console.log('[ResumeTraining] Request params:', {
  checkpoint_path,
  resume_from_best,
  config_adjustments,
});
```

**Location:** Lines 169-178 (resume config creation)

**Modify:**
```typescript
// Create resume configuration with adjustments
const resumeConfig = {
  ...job.config, // Inherit original job config
  ...config_adjustments, // Apply user adjustments (overrides original)
  checkpoint_resume: {
    enabled: true,
    checkpoint_path: resumeCheckpoint,
    resume_from_best: resume_from_best || false,
  },
};

console.log('[ResumeTraining] Config adjustments applied:', config_adjustments);
console.log('[ResumeTraining] Resume config created');
```

**Breaking Change Risk:** ❌ NONE (config_adjustments is optional)

---

### ✅ Phase 6: Testing & Validation (2-3 hours)

#### 6.1 Unit Tests

**Create:** `/lib/training/test_error_analyzer.py`

**Tests:**
- OOM eval detection
- OOM training detection
- Timeout detection
- Suggestion generation
- Edge cases (no config, minimal config)

#### 6.2 Integration Tests

**Test 1: Error Persistence**
```bash
1. Trigger OOM during training
2. Check database: SELECT error_message FROM local_training_jobs WHERE id = '<job_id>'
3. Verify: error_message contains "CUDA out of memory"
```

**Test 2: Analysis API**
```bash
1. Call GET /api/training/local/<failed_job_id>/analyze-failure
2. Verify: Returns suggestions with correct values
3. Verify: Suggestions are sensible (batch size reduced, etc.)
```

**Test 3: UI Display**
```bash
1. Navigate to failed job monitor page
2. Verify: CheckpointResumeCard shows error analysis
3. Verify: Suggestions are displayed with current/suggested values
4. Verify: User can edit suggested values
```

**Test 4: Resume with Adjustments**
```bash
1. Adjust config in UI
2. Click "Resume Training"
3. Verify: New job created with adjusted config
4. Verify: Training doesn't fail with same error
```

#### 6.3 End-to-End Test

**Scenario: OOM Resume Flow**
```
1. Start training that will OOM during eval
2. Wait for failure
3. Navigate to monitor page
4. See "Resume Training" card with:
   - Error description
   - 2-3 suggestions (batch size, accumulation, etc.)
   - Pre-filled suggested values
5. Optionally adjust values
6. Click "Resume Training"
7. Verify new job starts with adjusted config
8. Verify training completes without OOM
```

---

## Files Modified Summary

### Backend (Python)
1. ✏️ `/lib/training/training_server.py` - Fix "error" → "error_message"
2. ➕ `/lib/training/error_analyzer.py` - NEW: Error analysis logic
3. ➕ `/lib/training/analyze_error_cli.py` - NEW: CLI wrapper

### Backend (TypeScript)
4. ✏️ `/app/api/training/local/jobs/route.ts` - Add error_message field
5. ➕ `/app/api/training/local/[jobId]/analyze-failure/route.ts` - NEW: Analysis API
6. ✏️ `/app/api/training/local/[jobId]/resume/route.ts` - Accept config_adjustments

### Frontend
7. ✏️ `/components/training/CheckpointResumeCard.tsx` - Add config adjustment UI

### Tests
8. ➕ `/lib/training/test_error_analyzer.py` - NEW: Unit tests

---

## Rollout Plan

### Phase 1 (Day 1)
- Fix error persistence bug
- Test error messages appear in DB

### Phase 2-3 (Day 2)
- Implement error analysis logic
- Create analysis API
- Test with real error messages

### Phase 4-5 (Day 3)
- Update UI with suggestions
- Update resume API
- Manual testing

### Phase 6 (Day 4)
- Write unit tests
- Integration testing
- End-to-end testing
- Fix any issues

---

## Success Criteria

✅ Error messages persist to database correctly
✅ Analysis API returns intelligent suggestions
✅ UI displays suggestions clearly
✅ User can adjust suggested values
✅ Resume works with adjusted config
✅ Training succeeds after resume (doesn't hit same error)
✅ No breaking changes to existing functionality

---

## Monitoring & Rollback

### Monitoring
- Track resume success rate (before vs after)
- Log which suggestions users accept/modify
- Monitor for new error patterns

### Rollback Plan
If critical issues occur:
1. Revert `/components/training/CheckpointResumeCard.tsx` to show simple resume
2. Keep backend changes (error persistence fix is safe)
3. Disable analysis API endpoint

---

## Notes

- All changes are backwards compatible
- Existing resume functionality unchanged
- New features are opt-in (user chooses "adjust" mode)
- Error persistence fix is critical and should be deployed ASAP

---

**Status:** ✋ Awaiting User Approval

**Next Step:** Review plan, confirm approach, then begin Phase 1 implementation
