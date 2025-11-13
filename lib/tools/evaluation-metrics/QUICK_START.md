# Evaluation Metrics Tool - Quick Start Guide

**For developers who need to use the tool immediately.**

## What It Does

Comprehensive analytics for message evaluation data: quality tracking, model comparison, predictive modeling, anomaly detection, and 10 more operations.

## Import

```typescript
import { evaluationMetricsTool } from '@/lib/tools/evaluation-metrics';
```

## 13 Operations

### 1. Get Metrics - Overall Statistics

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'get_metrics',
  userId: 'user-id',
  period: 'week'  // 'day', 'week', 'month', 'quarter', 'year', 'all'
});
// Returns: { averageRating, successRate, qualityDistribution, breakdown }
```

### 2. Quality Trends - Rating Over Time

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'quality_trends',
  userId: 'user-id',
  period: 'month'
});
// Returns: { dataPoints, trend: 'improving'|'declining'|'stable', changePercentage }
```

### 3. Success Analysis - Success/Failure Patterns

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'success_analysis',
  userId: 'user-id',
  period: 'week'
});
// Returns: { successRate, failureRate, insights, commonFailureTags }
```

### 4. Compare Periods - Current vs Previous

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'compare_periods',
  userId: 'user-id',
  period: 'week'
});
// Returns: { currentPeriod, previousPeriod, changes, summary }
```

### 5. Model Comparison - AI Model Performance

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'model_comparison',
  userId: 'user-id',
  period: 'month'
});
// Returns: { models, bestModel: { byQuality, byCost, byValue }, recommendations }
```

### 6. Tool Impact Analysis - Tool Effectiveness

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'tool_impact_analysis',
  userId: 'user-id',
  period: 'week'
});
// Returns: { toolPerformance, correlations, recommendations }
```

### 7. Error Analysis - Error Patterns

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'error_analysis',
  userId: 'user-id',
  period: 'day'
});
// Returns: { errorPatterns, fallbackImpact, insights }
```

### 8. Temporal Analysis - Quality by Time

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'temporal_analysis',
  userId: 'user-id',
  period: 'week'
});
// Returns: { hourlyDistribution, dayOfWeekDistribution, peakPerformance }
```

### 9. Textual Feedback Analysis - Feedback Themes

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'textual_feedback_analysis',
  userId: 'user-id',
  period: 'month'
});
// Returns: { feedbackPatterns, categories, commonThemes, insights }
```

### 10. Benchmark Analysis - Task Accuracy

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'benchmark_analysis',
  userId: 'user-id',
  period: 'month'
});
// Returns: { benchmarkResults, taskTypePerformance, overallAccuracy }
```

### 11. Advanced Sentiment Analysis - Emotion Detection

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'advanced_sentiment_analysis',
  userId: 'user-id',
  period: 'week'
});
// Returns: { sentimentDistribution, emotionDetection, topPhrases }
```

### 12. Predictive Quality Modeling - Forecast Quality

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'predictive_quality_modeling',
  userId: 'user-id',
  period: 'month'
});
// Returns: { predictions: { sevenDay, thirtyDay }, riskScore, insights }
```

### 13. Anomaly Detection - Detect Outliers

```typescript
const result = await evaluationMetricsTool.execute({
  operation: 'anomaly_detection',
  userId: 'user-id',
  period: 'week'
});
// Returns: { anomalies, statistics, insights }
```

## Common Patterns

### Weekly Quality Report

```typescript
const userId = 'user-id';

// Get current metrics
const metrics = await evaluationMetricsTool.execute({
  operation: 'get_metrics',
  userId,
  period: 'week'
});

// Get trends
const trends = await evaluationMetricsTool.execute({
  operation: 'quality_trends',
  userId,
  period: 'week'
});

// Check anomalies
const anomalies = await evaluationMetricsTool.execute({
  operation: 'anomaly_detection',
  userId,
  period: 'week'
});

console.log('Weekly Report:');
console.log('- Average Rating:', metrics.data.averageRating);
console.log('- Trend:', trends.data.trend);
console.log('- Anomalies:', anomalies.data.anomaliesDetected);
```

### Model Optimization

```typescript
const userId = 'user-id';

// Compare models
const models = await evaluationMetricsTool.execute({
  operation: 'model_comparison',
  userId,
  period: 'month'
});

// Get tool impact
const tools = await evaluationMetricsTool.execute({
  operation: 'tool_impact_analysis',
  userId,
  period: 'month'
});

console.log('Best Model (Quality):', models.data.bestModel.byQuality);
console.log('Best Model (Value):', models.data.bestModel.byValue);
console.log('Top Tool:', tools.data.toolPerformance[0].toolName);
```

### Predictive Monitoring

```typescript
const userId = 'user-id';

// Get prediction
const prediction = await evaluationMetricsTool.execute({
  operation: 'predictive_quality_modeling',
  userId,
  period: 'month'
});

// Check risk
if (prediction.data.riskScore.level === 'high' || prediction.data.riskScore.level === 'critical') {
  console.log('⚠️ Quality risk detected!');
  console.log('7-day forecast:', prediction.data.predictions.sevenDay.predictedRating);
  console.log('Recommendations:', prediction.data.riskScore.recommendations);
}
```

## Optional Parameters

All operations accept these optional filters:

```typescript
{
  operation: string,
  userId: string,              // Required
  period?: string,             // 'day', 'week', 'month', 'quarter', 'year', 'all'
  startDate?: string,          // ISO 8601 (overrides period)
  endDate?: string,            // ISO 8601 (overrides period)
  conversationId?: string,     // Filter specific conversation
  minRating?: number,          // 1-5
  maxRating?: number,          // 1-5
  modelId?: string            // Filter specific model
}
```

## Response Format

All operations return:

```typescript
{
  success: true,
  data: {
    // Operation-specific data
  }
}
```

## Key Limits

- **Max Evaluations:** 10,000 per query
- **Max Trend Points:** 100 data points
- **Query Performance:** 1-5 seconds for complex operations
- **Access:** READ-ONLY (no data mutations)

## Error Handling

```typescript
try {
  const result = await evaluationMetricsTool.execute({
    operation: 'get_metrics',
    userId: 'user-id',
    period: 'week'
  });

  console.log('Success:', result.data);
} catch (error) {
  console.error('Error:', error.message);
  // Common errors:
  // - "User ID required"
  // - "Unknown operation"
  // - "Failed to fetch data"
}
```

## Quick Tips

1. **Start Simple**: Use `get_metrics` and `quality_trends` first
2. **Use Appropriate Periods**: Week for monitoring, month for trends
3. **Filter When Possible**: Use conversationId or modelId to speed up queries
4. **Check Predictions**: Run `predictive_quality_modeling` weekly
5. **Monitor Anomalies**: Run `anomaly_detection` daily for critical apps

## Need More Details?

See full documentation: `/lib/tools/evaluation-metrics/README.md`

## Run Tests

```bash
cd lib/tools/evaluation-metrics/__tests__
./run-tests.sh
```
