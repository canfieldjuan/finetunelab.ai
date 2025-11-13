# Model Comparison - Usage Guide

**Date:** October 17, 2025  
**Feature:** Model Analytics & Comparison  
**Tool:** `evaluation_metrics`  
**Operation:** `model_comparison`  

---

## 📋 Overview

The model comparison feature analyzes AI model performance across multiple dimensions:

- **Quality:** Average rating and success rate
- **Cost:** Average cost per message
- **Value:** Quality per dollar (quality/cost ratio)
- **Trend:** Improving, declining, or stable performance

---

## 🚀 Quick Start

### Basic Usage (Chat Interface)

Simply ask questions like:

```
"Which AI model has the best quality?"
"Compare AI model performance"
"Show me model cost comparison"
"Which model gives the best value for money?"
"What's the most cost-effective model?"
```

The assistant will automatically use the `evaluation_metrics` tool with `operation: model_comparison`.

---

## 🔧 API Usage

### Direct Tool Call

```typescript
import { evaluationMetricsTool } from './lib/tools/evaluation-metrics';

const result = await evaluationMetricsTool.execute({
  operation: 'model_comparison',
  userId: 'user-uuid-here',
  period: 'last_30_days', // Optional: defaults to 'week'
});

console.log(result);
```

### With Custom Date Range

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'model_comparison',
  userId: 'user-uuid-here',
  startDate: '2025-09-01T00:00:00Z',
  endDate: '2025-10-01T00:00:00Z',
});
```

### Filter by Specific Model

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'model_comparison',
  userId: 'user-uuid-here',
  period: 'month',
  modelId: 'gpt-4o-mini', // Optional: only analyze this model
});
```

---

## 📊 Response Format

### Success Response

```typescript
{
  success: true,
  data: {
    period: "2025-09-17T00:00:00Z to 2025-10-17T00:00:00Z",
    models: [
      {
        modelId: "gpt-4o-mini",
        provider: "openai",
        averageRating: 4.23,
        successRate: 0.956,
        totalEvaluations: 45,
        averageCost: 0.000489,
        qualityPerDollar: 8651.33,
        trend: "improving"
      },
      {
        modelId: "claude-3-5-sonnet",
        provider: "anthropic",
        averageRating: 4.45,
        successRate: 0.978,
        totalEvaluations: 32,
        averageCost: 0.001234,
        qualityPerDollar: 3605.67,
        trend: "stable"
      }
    ],
    bestModel: {
      byQuality: "claude-3-5-sonnet",
      byCost: "gpt-4o-mini",
      byValue: "gpt-4o-mini"
    },
    recommendations: [
      "Highest quality: claude-3-5-sonnet with 4.45 average rating",
      "Best value: gpt-4o-mini with 8651.33 quality per dollar",
      "Most cost-effective: gpt-4o-mini at $0.000489 per message",
      "Positive: gpt-4o-mini showing improving performance"
    ]
  }
}
```

### Empty Response (No Data)

```typescript
{
  success: true,
  data: {
    period: "2025-09-17T00:00:00Z to 2025-10-17T00:00:00Z",
    models: [],
    bestModel: {
      byQuality: "N/A",
      byCost: "N/A",
      byValue: "N/A"
    },
    recommendations: [
      "No model data available for this period"
    ]
  }
}
```

---

## 📈 Understanding the Metrics

### Model Performance Object

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `modelId` | string | AI model identifier | `"gpt-4o-mini"` |
| `provider` | string | Model provider | `"openai"` |
| `averageRating` | number | Mean rating (1-5 scale) | `4.23` |
| `successRate` | number | Success ratio (0-1) | `0.956` = 95.6% |
| `totalEvaluations` | number | Sample size | `45` |
| `averageCost` | number | Cost per message (USD) | `0.000489` |
| `qualityPerDollar` | number | Rating / Cost | `8651.33` |
| `trend` | string | Performance direction | `"improving"` |

### Trend Values

- **`"improving"`** - Performance increased by ≥5% (comparing first half vs second half of period)
- **`"declining"`** - Performance decreased by ≥5%
- **`"stable"`** - Performance changed by <5% or insufficient data (<10 evaluations)

### Quality Per Dollar

Higher is better! This metric shows how much "quality" you get per dollar spent.

**Formula:** `qualityPerDollar = averageRating / averageCost`

**Example:**

- Model A: 4.0 rating, $0.001 cost → 4000 quality/dollar
- Model B: 4.5 rating, $0.002 cost → 2250 quality/dollar
- **Winner:** Model A (better value despite lower quality)

---

## 🎯 Use Cases

### 1. Find Best Quality Model

**Question:** "Which model produces the highest quality responses?"

**What to check:** `bestModel.byQuality` or sort by `averageRating`

**Example:**

```typescript
const { data } = await execute({ operation: 'model_comparison', userId });
const bestQuality = data.models.sort((a, b) => b.averageRating - a.averageRating)[0];
console.log(`Best quality: ${bestQuality.modelId} (${bestQuality.averageRating}/5)`);
```

### 2. Optimize Costs

**Question:** "What's the cheapest model that maintains good quality?"

**What to check:** `bestModel.byValue` or sort by `qualityPerDollar`

**Example:**

```typescript
const goodQualityModels = data.models.filter(m => m.averageRating >= 4.0);
const bestValue = goodQualityModels.sort((a, b) => b.qualityPerDollar - a.qualityPerDollar)[0];
console.log(`Best value: ${bestValue.modelId}`);
```

### 3. Identify Performance Trends

**Question:** "Which models are getting better over time?"

**What to check:** Filter by `trend === "improving"`

**Example:**

```typescript
const improvingModels = data.models.filter(m => m.trend === 'improving');
console.log('Improving models:', improvingModels.map(m => m.modelId));
```

### 4. Cost Analysis

**Question:** "How much am I spending on each model?"

**What to check:** `averageCost` and `totalEvaluations`

**Example:**

```typescript
data.models.forEach(model => {
  const totalSpent = model.averageCost * model.totalEvaluations;
  console.log(`${model.modelId}: $${totalSpent.toFixed(4)} total`);
});
```

### 5. Compare Specific Models

**Question:** "Should I switch from GPT-4o-mini to Claude Sonnet?"

**What to do:** Compare their metrics side-by-side

**Example:**

```typescript
const gpt = data.models.find(m => m.modelId === 'gpt-4o-mini');
const claude = data.models.find(m => m.modelId === 'claude-3-5-sonnet');

console.log('Quality:', gpt.averageRating, 'vs', claude.averageRating);
console.log('Cost:', gpt.averageCost, 'vs', claude.averageCost);
console.log('Value:', gpt.qualityPerDollar, 'vs', claude.qualityPerDollar);
```

---

## ⚙️ Parameters Reference

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `operation` | string | Must be `"model_comparison"` |
| `userId` | string | User ID for authentication |

### Optional Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `period` | string | Time period preset | `"week"` |
| `startDate` | string | Custom start date (ISO) | Calculated from period |
| `endDate` | string | Custom end date (ISO) | Current date |
| `modelId` | string | Filter to specific model | All models |
| `minRating` | number | Filter by min rating (1-5) | No filter |
| `maxRating` | number | Filter by max rating (1-5) | No filter |

### Period Options

- `"day"` - Last 24 hours
- `"week"` - Last 7 days
- `"month"` - Last 30 days
- `"quarter"` - Last 90 days
- `"year"` - Last 365 days
- `"all"` - All time
- Custom: Use `startDate` and `endDate`

---

## 🧪 Testing

### Prerequisites

1. Database has messages with `model_id` and `provider` columns populated
2. Messages have associated evaluations
3. Messages have token counts for cost calculation

### Test in Chat Interface

1. Start the development server
2. Send message: **"Compare AI model performance"**
3. Verify tool is called with `operation: model_comparison`
4. Check response contains model metrics
5. Verify recommendations make sense

### Test via API

```typescript
// Test script: test-model-comparison.ts
import { evaluationMetricsTool } from './lib/tools/evaluation-metrics';

async function testModelComparison() {
  try {
    console.log('Testing model comparison...\n');
    
    const result = await evaluationMetricsTool.execute({
      operation: 'model_comparison',
      userId: 'YOUR-USER-ID-HERE',
      period: 'month',
    });
    
    console.log('Success:', result.success);
    console.log('Models analyzed:', result.data.models.length);
    console.log('\nBest Models:');
    console.log('  Quality:', result.data.bestModel.byQuality);
    console.log('  Cost:', result.data.bestModel.byCost);
    console.log('  Value:', result.data.bestModel.byValue);
    console.log('\nRecommendations:');
    result.data.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
    
    console.log('\n✅ Test passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testModelComparison();
```

### Expected Console Logs

```
[EvaluationMetrics] Executing model comparison { userId: '...', options: {...} }
[MetricsService] Starting model comparison analysis
[MetricsService] Date range set
[MetricsService] Query returned evaluations { count: 77 }
[MetricsService] Processing model comparison data
[MetricsService] Grouped evaluations by model { modelCount: 3, models: [...] }
[MetricsService] Analyzing model: gpt-4o-mini { evaluationCount: 45 }
[MetricsService] Model performance calculated { modelId: 'gpt-4o-mini', ... }
[MetricsService] Analyzing model: claude-3-5-sonnet { evaluationCount: 32 }
[MetricsService] Model performance calculated { modelId: 'claude-3-5-sonnet', ... }
[MetricsService] Best models identified
[MetricsService] Generated recommendations { count: 4 }
[MetricsService] Model comparison complete { modelCount: 3 }
[EvaluationMetrics] Model comparison complete { modelCount: 3, bestModel: {...} }
```

---

## 🐛 Debugging

### Common Issues

#### 1. No Models Returned

**Symptom:** `models: []` in response

**Causes:**

- No messages have `model_id` populated
- Date range has no data
- User has no evaluations

**Solutions:**

- Check database: `SELECT COUNT(*) FROM messages WHERE model_id IS NOT NULL;`
- Verify date range includes recent activity
- Ensure Migration 007 was applied

#### 2. Missing Cost Data

**Symptom:** `averageCost: 0` for all models

**Causes:**

- Messages missing `input_tokens` or `output_tokens`
- Model ID not in pricing templates

**Solutions:**

- Check token columns populated
- Verify model ID matches pricing utility keys
- Check pricing.utils.ts for supported models

#### 3. All Trends Show "stable"

**Symptom:** `trend: "stable"` for all models

**Causes:**

- Insufficient data (<10 evaluations per model)
- Performance truly stable (<5% change)

**Solutions:**

- Increase date range to get more data
- Check if models genuinely stable
- Review `calculateModelTrend()` thresholds

### Debug Logging

Enable verbose logging by checking console output:

```typescript
// Look for these log patterns:
[MetricsService] Starting model comparison analysis
[MetricsService] Query returned evaluations { count: N }
[MetricsService] Grouped evaluations by model { modelCount: M }
[MetricsService] Analyzing model: <model-id>
[MetricsService] Model performance calculated
```

If logs stop at a certain point, that's where the issue is.

---

## 📝 Example Conversations

### Example 1: General Comparison

**User:** "Compare AI model performance this month"

**Assistant Response:**

```
I analyzed your AI model usage for the past month. Here's what I found:

**Models Analyzed:** 3 models (gpt-4o-mini, claude-3-5-sonnet, gemini-flash-1.5)

**Best by Quality:** claude-3-5-sonnet (4.45/5 rating)
**Best by Cost:** gpt-4o-mini ($0.000489 per message)
**Best Value:** gpt-4o-mini (8651.33 quality per dollar)

**Key Insights:**
- Claude Sonnet produces the highest quality responses but costs 2.5x more
- GPT-4o-mini offers excellent value - nearly as good quality at much lower cost
- All models showing stable or improving performance trends

**Recommendation:** For most use cases, stick with gpt-4o-mini. Only use Claude Sonnet for tasks requiring absolute best quality.
```

### Example 2: Cost Optimization

**User:** "Which model should I use to save money?"

**Assistant Response:**

```
Based on your usage data:

**Most Cost-Effective:** gpt-4o-mini at $0.000489 per message

**Comparison:**
- GPT-4o-mini: $0.000489 (baseline)
- Gemini Flash: $0.000234 (52% cheaper but 0.4 points lower quality)
- Claude Sonnet: $0.001234 (152% more expensive, 0.2 points higher quality)

**Recommendation:** 
For maximum savings, switch to Gemini Flash. You'll save ~$5.25 per 1000 messages with minimal quality impact (4.05 vs 4.23 rating).

If quality is important, keep using GPT-4o-mini - it's already the best value option.
```

### Example 3: Quality Focus

**User:** "What's the best quality AI model?"

**Assistant Response:**

```
**Highest Quality Model:** claude-3-5-sonnet

**Quality Metrics:**
- Average Rating: 4.45/5
- Success Rate: 97.8%
- Sample Size: 32 evaluations
- Trend: Stable performance

**Trade-offs:**
- Cost: $0.001234 per message (2.5x more than GPT-4o-mini)
- Quality Advantage: +0.22 points over GPT-4o-mini
- Value Score: 3605.67 quality per dollar

**When to Use:**
- Critical customer-facing responses
- Complex reasoning tasks
- When quality matters more than cost
```

---

## 🚀 Next Steps

After implementing model comparison, consider:

1. **Tool Impact Analysis** - Which tools improve model performance?
2. **Cost-Quality Optimization** - Automated recommendations for model switching
3. **Real-time Monitoring** - Alert when model performance degrades
4. **A/B Testing** - Compare model variants systematically

---

**Status:** ✅ Available in Production  
**Version:** 1.0.0  
**Last Updated:** October 17, 2025
