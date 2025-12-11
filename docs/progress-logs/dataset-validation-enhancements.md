# Dataset Validation Enhancements - Implementation Plan

**Date:** 2025-12-07
**Status:** COMPLETED
**Priority:** Enhancement

## Overview

Enhance FineTune Lab's dataset validation capabilities with advanced analysis features including real tokenizer integration, outlier detection, cost estimation, and improved quality metrics.

## Current State Analysis

### Existing Files (Verified)

| File | Lines | Purpose |
|------|-------|---------|
| `/lib/training/dataset-validator.ts` | 611 | Main TypeScript validator class |
| `/lib/training/dataset_analyzer.py` | 357 | Python analysis tool |
| `/lib/training/dataset.types.ts` | 125 | Type definitions |
| `/lib/training/format-detector.ts` | ~450 | Format auto-detection |
| `/lib/training/format-normalizer.ts` | ~450 | Format conversion |
| `/app/api/training/dataset/route.ts` | 486 | Upload API endpoint |
| `/components/training/DatasetValidator.tsx` | 178 | Upload UI component |

### Current Capabilities
- Format detection (8 formats) with confidence levels
- Schema validation per format
- Role alternation validation
- Empty/malformed example detection
- MD5 hash duplicate detection
- Basic token counting (whitespace split)
- Character-based length statistics

### Identified Gaps
1. **No real tokenizer** - Uses `text.split()` instead of model tokenizers
2. **No cost estimation** - No training cost projections
3. **No outlier detection** - No flagging of unusual examples
4. **No semantic duplicates** - Only exact hash matching
5. **No content quality scoring** - No ML-based quality detection
6. **Limited UI feedback** - Warnings exist but not comprehensive

---

## Phased Implementation Plan

### Phase 1: Real Tokenizer Integration (Python)
**Goal:** Replace whitespace token counting with actual HuggingFace tokenizer

**File to Modify:** `/lib/training/dataset_analyzer.py`

**Insertion Point:** Lines 53-55 (replace `count_tokens_simple`)

**Current Code:**
```python
def count_tokens_simple(text: str) -> int:
    """Simple token count estimate (whitespace split)"""
    return len(text.split())
```

**New Code (Additive):**
```python
# Keep original for fallback
def count_tokens_simple(text: str) -> int:
    """Simple token count estimate (whitespace split) - fallback method"""
    return len(text.split())

# New tokenizer-based counting
_tokenizer_cache = {}

def get_tokenizer(model_name: str = "gpt2"):
    """Get or create cached tokenizer"""
    if model_name not in _tokenizer_cache:
        try:
            from transformers import AutoTokenizer
            _tokenizer_cache[model_name] = AutoTokenizer.from_pretrained(model_name)
        except Exception as e:
            print(f"Warning: Could not load tokenizer {model_name}: {e}")
            return None
    return _tokenizer_cache[model_name]

def count_tokens_accurate(text: str, model_name: str = "gpt2") -> int:
    """Accurate token count using HuggingFace tokenizer"""
    tokenizer = get_tokenizer(model_name)
    if tokenizer is None:
        return count_tokens_simple(text)
    try:
        return len(tokenizer.encode(text, add_special_tokens=False))
    except Exception:
        return count_tokens_simple(text)
```

**Dependencies:** `transformers` (already installed for training)

---

### Phase 2: Outlier Detection (Python)
**Goal:** Identify examples with unusual token counts using statistical methods

**File to Modify:** `/lib/training/dataset_analyzer.py`

**Insertion Point:** After line 165 (after `get_example_hash`)

**New Code (Additive):**
```python
def detect_outliers(token_counts: List[int], method: str = "iqr") -> Dict[str, Any]:
    """
    Detect outlier examples based on token counts

    Methods:
    - iqr: Interquartile Range (1.5 * IQR rule)
    - zscore: Z-score > 3 standard deviations
    """
    if len(token_counts) < 10:
        return {"outliers": [], "method": method, "threshold": None}

    import statistics

    if method == "zscore":
        mean = statistics.mean(token_counts)
        stdev = statistics.stdev(token_counts)
        if stdev == 0:
            return {"outliers": [], "method": method, "threshold": None}

        threshold = 3.0
        outliers = [
            {"index": i, "tokens": t, "zscore": (t - mean) / stdev}
            for i, t in enumerate(token_counts)
            if abs((t - mean) / stdev) > threshold
        ]
        return {"outliers": outliers, "method": method, "threshold": threshold, "mean": mean, "stdev": stdev}

    else:  # IQR method
        sorted_counts = sorted(token_counts)
        n = len(sorted_counts)
        q1 = sorted_counts[n // 4]
        q3 = sorted_counts[3 * n // 4]
        iqr = q3 - q1

        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        outliers = [
            {"index": i, "tokens": t, "type": "low" if t < lower_bound else "high"}
            for i, t in enumerate(token_counts)
            if t < lower_bound or t > upper_bound
        ]
        return {
            "outliers": outliers,
            "method": method,
            "lower_bound": lower_bound,
            "upper_bound": upper_bound,
            "q1": q1,
            "q3": q3
        }
```

---

### Phase 3: Training Cost Estimation (TypeScript)
**Goal:** Estimate training costs based on tokens and provider pricing

**New File:** `/lib/training/dataset-cost-estimator.ts`

```typescript
/**
 * Dataset Cost Estimator
 * Estimates training costs based on dataset size and provider pricing
 * Date: 2025-12-07
 */

export interface CostEstimate {
  provider: string;
  totalTokens: number;
  estimatedCost: number;
  currency: string;
  breakdown: {
    trainingTokens: number;
    epochs: number;
    costPerEpoch: number;
  };
  warnings: string[];
}

// Approximate pricing per 1M tokens (as of late 2024)
const PROVIDER_PRICING = {
  openai: {
    'gpt-3.5-turbo': { training: 8.00, inference: 0.002 },
    'gpt-4': { training: 25.00, inference: 0.03 },
  },
  local: {
    // Local training: compute cost estimate per GPU-hour
    gpuHourCost: 0.50, // Approximate electricity + depreciation
    tokensPerHour: 50000, // Rough estimate for consumer GPU
  },
  runpod: {
    // RunPod GPU pricing per hour
    'RTX 3090': 0.44,
    'RTX 4090': 0.74,
    'A100-40GB': 1.89,
    'A100-80GB': 2.49,
  },
};

export function estimateTrainingCost(
  totalTokens: number,
  epochs: number,
  provider: 'openai' | 'local' | 'runpod',
  options?: {
    model?: string;
    gpuType?: string;
    tokensPerSecond?: number;
  }
): CostEstimate {
  const warnings: string[] = [];
  let estimatedCost = 0;
  let breakdown = { trainingTokens: totalTokens * epochs, epochs, costPerEpoch: 0 };

  if (provider === 'openai') {
    const model = options?.model || 'gpt-3.5-turbo';
    const pricing = PROVIDER_PRICING.openai[model as keyof typeof PROVIDER_PRICING.openai];
    if (pricing) {
      const costPerMillion = pricing.training;
      estimatedCost = (breakdown.trainingTokens / 1_000_000) * costPerMillion;
      breakdown.costPerEpoch = (totalTokens / 1_000_000) * costPerMillion;
    } else {
      warnings.push(`Unknown OpenAI model: ${model}`);
    }
  } else if (provider === 'runpod') {
    const gpuType = options?.gpuType || 'RTX 4090';
    const hourlyRate = PROVIDER_PRICING.runpod[gpuType as keyof typeof PROVIDER_PRICING.runpod] || 0.74;
    const tokensPerSecond = options?.tokensPerSecond || 100;
    const totalSeconds = breakdown.trainingTokens / tokensPerSecond;
    const totalHours = totalSeconds / 3600;
    estimatedCost = totalHours * hourlyRate;
    breakdown.costPerEpoch = estimatedCost / epochs;
  } else {
    // Local estimate
    const tokensPerHour = options?.tokensPerSecond
      ? options.tokensPerSecond * 3600
      : PROVIDER_PRICING.local.tokensPerHour;
    const hours = breakdown.trainingTokens / tokensPerHour;
    estimatedCost = hours * PROVIDER_PRICING.local.gpuHourCost;
    breakdown.costPerEpoch = estimatedCost / epochs;
    warnings.push('Local cost is approximate (electricity + GPU depreciation)');
  }

  return {
    provider,
    totalTokens,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    currency: 'USD',
    breakdown,
    warnings,
  };
}
```

---

### Phase 4: Enhanced Validation Result Types (TypeScript)
**Goal:** Extend types to include new metrics

**File to Modify:** `/lib/training/dataset.types.ts`

**Insertion Point:** After line 98 (after `DatasetStats` interface)

**New Code (Additive):**
```typescript
export interface EnhancedDatasetStats extends DatasetStats {
  // Token statistics (accurate)
  token_count_total: number;
  token_count_avg: number;
  token_count_min: number;
  token_count_max: number;
  token_count_median: number;
  tokenizer_used: string;

  // Outlier detection
  outliers: {
    count: number;
    indices: number[];
    method: 'iqr' | 'zscore';
  };

  // Quality metrics
  quality_score: number; // 0-100
  quality_issues: {
    empty_examples: number;
    malformed_examples: number;
    alternation_errors: number;
    duplicate_count: number;
  };

  // Cost estimation
  cost_estimate?: {
    provider: string;
    estimated_cost: number;
    currency: string;
  };
}

export interface DatasetAnalysisResult {
  valid: boolean;
  stats: EnhancedDatasetStats;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}
```

---

### Phase 5: UI Enhancements (React)
**Goal:** Display new validation metrics in the upload UI

**File to Modify:** `/components/training/DatasetValidator.tsx`

**Changes:**
1. Add display for token statistics
2. Add outlier warnings
3. Add cost estimate display
4. Add quality score indicator

**Insertion Point:** After line 151 (after small dataset warning)

---

### Phase 6: API Integration
**Goal:** Expose enhanced validation via API

**File to Modify:** `/app/api/training/dataset/route.ts`

**Changes:**
1. Call Python analyzer for deep analysis (optional, on-demand)
2. Return enhanced stats in response
3. Add `/api/training/dataset/analyze` endpoint for detailed analysis

---

## File Impact Analysis

### Files to CREATE (New)
| File | Purpose | Risk |
|------|---------|------|
| `/lib/training/dataset-cost-estimator.ts` | Cost estimation | None (new file) |

### Files to MODIFY (Additive Only)
| File | Changes | Lines Affected | Risk |
|------|---------|----------------|------|
| `/lib/training/dataset_analyzer.py` | Add tokenizer + outlier functions | +80 lines | Low |
| `/lib/training/dataset.types.ts` | Add enhanced types | +40 lines | Very Low |
| `/components/training/DatasetValidator.tsx` | Display new metrics | +60 lines | Low |
| `/app/api/training/dataset/route.ts` | Return enhanced stats | +20 lines | Low |

### Files NOT Modified
- `/lib/training/dataset-validator.ts` - Core validation unchanged
- `/lib/training/format-detector.ts` - Format detection unchanged
- `/lib/training/format-normalizer.ts` - Normalization unchanged

---

## Dependencies

### Python (Already Installed)
- `transformers` - For HuggingFace tokenizers (already in training requirements)

### No New Dependencies Required
- All functionality uses existing libraries

---

## Verification Steps

### Phase 1 Verification
```bash
# Test tokenizer loading
cd lib/training
python3 -c "from dataset_analyzer import count_tokens_accurate; print(count_tokens_accurate('Hello world'))"
```

### Phase 2 Verification
```bash
# Test outlier detection
python3 -c "from dataset_analyzer import detect_outliers; print(detect_outliers([100,105,110,115,500,102,108]))"
```

### Phase 3 Verification
```bash
# TypeScript compilation
npx tsc --noEmit lib/training/dataset-cost-estimator.ts
```

### Full Integration Test
```bash
# Run existing dataset validation
npm run test -- --grep "dataset"
```

---

## Rollback Plan

All changes are **additive only**:
- New functions added alongside existing ones
- Existing code paths preserved
- New features can be disabled via feature flags if needed

---

## Approval Checklist

- [x] Plan reviewed
- [x] Additive-only approach confirmed
- [x] No breaking changes to existing validation
- [x] Dependencies verified (transformers already installed)
- [x] File paths verified
- [x] Ready to proceed with Phase 1

---

## Implementation Complete - 2025-12-07

All 6 phases have been successfully implemented:

### Phase 1: Real Tokenizer Integration
- Added `get_tokenizer()` with caching
- Added `count_tokens_accurate()` using HuggingFace AutoTokenizer
- Added `count_tokens()` unified function with fallback

### Phase 2: Outlier Detection
- Added `detect_outliers()` with IQR and z-score methods
- Added `calculate_quality_score()` (0-100 scoring)

### Phase 3: Cost Estimation
- Created `/lib/training/dataset-cost-estimator.ts`
- Supports OpenAI, RunPod, and local providers
- GPU pricing and throughput estimates

### Phase 4: Enhanced Types
- Added `EnhancedDatasetStats` interface
- Added `OutlierDetail`, `CostEstimateSummary`, `DatasetAnalysisResult` types

### Phase 5: UI Enhancements
- Updated `DatasetValidator.tsx` with new `enhancedStats` prop
- Added Token Statistics display
- Added Quality Score with progress bar
- Added Outlier Detection warnings
- Added Cost Estimate display

### Phase 6: API Integration
- Updated `/app/api/training/dataset/route.ts`
- Added cost estimation to upload response
- Stores cost estimates in metadata
