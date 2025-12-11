# Token Analyzer Tool - Quick Start Guide

**For developers who need to use the tool immediately.**

## What It Does

Track token usage, analyze costs, compare AI model efficiency, and get optimization recommendations to reduce spending.

## Import

```typescript
import { tokenAnalyzerTool } from '@/lib/tools/token-analyzer';
```

## 4 Operations

### 1. Usage Stats - Track Token Consumption

```typescript
const result = await tokenAnalyzerTool.execute({
  operation: 'usage_stats',
  userId: 'user-id',
  period: 'week'  // 'day', 'week', 'month', 'all'
});
// Returns: { totalTokens, inputTokens, outputTokens, messageCount, peakUsageDay, modelBreakdown, dailyStats }
```

### 2. Cost Analysis - Calculate Spending

```typescript
const result = await tokenAnalyzerTool.execute({
  operation: 'cost_analysis',
  userId: 'user-id',
  period: 'month'
});
// Returns: { totalCost, inputCost, outputCost, breakdown, dailyCosts, averageCostPerMessage }
```

### 3. Model Comparison - Compare Efficiency

```typescript
const result = await tokenAnalyzerTool.execute({
  operation: 'model_comparison',
  userId: 'user-id',
  period: 'month',
  modelIds: ['gpt-4', 'gpt-4o', 'gpt-4o-mini']  // Optional
});
// Returns: { models, comparison: { mostEfficient, mostCostEffective, fastest } }
```

### 4. Optimization Tips - Reduce Costs

```typescript
const result = await tokenAnalyzerTool.execute({
  operation: 'optimization_tips',
  userId: 'user-id',
  period: 'week'
});
// Returns: { currentUsage, tips, modelRecommendations, summary: { totalPotentialSavings } }
```

## Common Patterns

### Daily Cost Monitoring

```typescript
const userId = 'user-id';

// Check today's costs
const costs = await tokenAnalyzerTool.execute({
  operation: 'cost_analysis',
  userId,
  period: 'day'
});

// Alert if over budget
const DAILY_LIMIT = 5.0;
if (costs.data.totalCost > DAILY_LIMIT) {
  console.log('⚠️ Budget exceeded!');
  console.log('Spent:', `$${costs.data.totalCost.toFixed(2)}`);
}
```

### Weekly Usage Report

```typescript
const userId = 'user-id';

// Get usage stats
const usage = await tokenAnalyzerTool.execute({
  operation: 'usage_stats',
  userId,
  period: 'week'
});

// Get cost breakdown
const costs = await tokenAnalyzerTool.execute({
  operation: 'cost_analysis',
  userId,
  period: 'week'
});

console.log('=== Weekly Report ===');
console.log('Tokens:', usage.data.totalTokens.toLocaleString());
console.log('Cost:', `$${costs.data.totalCost.toFixed(2)}`);
console.log('Messages:', usage.data.messageCount);
console.log('Avg Cost/Message:', `$${costs.data.averageCostPerMessage.toFixed(4)}`);
```

### Model Optimization

```typescript
const userId = 'user-id';

// Compare all models
const comparison = await tokenAnalyzerTool.execute({
  operation: 'model_comparison',
  userId,
  period: 'month'
});

// Get optimization tips
const tips = await tokenAnalyzerTool.execute({
  operation: 'optimization_tips',
  userId,
  period: 'month'
});

console.log('Best Model (Cost):', comparison.data.comparison.mostCostEffective);
console.log('Best Model (Speed):', comparison.data.comparison.fastest);
console.log('Potential Savings:', `$${tips.data.summary.totalPotentialSavings.toFixed(2)}`);

// Show high-impact tips
tips.data.tips
  .filter(t => t.impact === 'high')
  .forEach(tip => {
    console.log(`\n🎯 ${tip.title}`);
    console.log(tip.description);
    console.log('Savings:', `$${tip.potentialSavings.cost?.toFixed(2) || 'N/A'}`);
  });
```

### Model Migration Analysis

```typescript
const userId = 'user-id';
const currentModel = 'gpt-4';
const targetModel = 'gpt-4o';

// Compare the two models
const comparison = await tokenAnalyzerTool.execute({
  operation: 'model_comparison',
  userId,
  modelIds: [currentModel, targetModel],
  period: 'month'
});

const current = comparison.data.models.find(m => m.modelId === currentModel);
const target = comparison.data.models.find(m => m.modelId === targetModel);

const monthlySavings = current.cost.total - target.cost.total;
const annualSavings = monthlySavings * 12;

console.log('=== Migration Analysis ===');
console.log(`Current: ${current.modelName}`);
console.log(`  Cost: $${current.cost.total.toFixed(2)}/month`);
console.log(`  Response Time: ${current.performance.averageResponseTime}ms`);

console.log(`\nTarget: ${target.modelName}`);
console.log(`  Cost: $${target.cost.total.toFixed(2)}/month`);
console.log(`  Response Time: ${target.performance.averageResponseTime}ms`);

console.log(`\nSavings:`);
console.log(`  Monthly: $${monthlySavings.toFixed(2)}`);
console.log(`  Annual: $${annualSavings.toFixed(2)}`);
```

### Conversation-Specific Analysis

```typescript
// Analyze specific conversation
const result = await tokenAnalyzerTool.execute({
  operation: 'usage_stats',
  userId: 'user-id',
  conversationId: 'conv-id'
});

console.log('Conversation Tokens:', result.data.totalTokens);
console.log('Messages:', result.data.messageCount);
console.log('Avg Tokens/Message:', result.data.averageTokensPerMessage);

// Get optimization tips for this conversation
const tips = await tokenAnalyzerTool.execute({
  operation: 'optimization_tips',
  userId: 'user-id',
  conversationId: 'conv-id'
});

console.log('\nOptimization Tips:');
tips.data.tips.forEach(tip => console.log(`- ${tip.title}`));
```

## Optional Parameters

All operations accept these filters:

```typescript
{
  operation: string,
  userId: string,              // Required
  period?: string,             // 'day', 'week', 'month', 'all' (default: varies by operation)
  modelId?: string,            // Filter specific model
  conversationId?: string,     // Filter specific conversation
  modelIds?: string[]          // Compare specific models (model_comparison only)
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

## Pricing Configuration

Model pricing is configured in `/lib/tools/token-analyzer/config.ts`:

```typescript
pricing: {
  'gpt-4': { input: 30.0, output: 60.0 },           // per 1M tokens
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-3-opus': { input: 15.0, output: 75.0 },
  'claude-3-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-haiku': { input: 0.25, output: 1.25 }
}
```

## Key Calculations

**Token Estimation:**
```typescript
estimatedTokens = Math.ceil(text.length / 4);
// ~1 token per 4 characters
```

**Cost Calculation:**
```typescript
cost = (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000;
// Prices are per 1M tokens
```

## Key Limits

- **Estimation Accuracy:** ±10% when actual counts unavailable
- **Historical Data:** Limited to stored message data
- **Query Performance:** 100-600ms depending on operation
- **Access:** READ-ONLY (no data mutations)

## Error Handling

```typescript
try {
  const result = await tokenAnalyzerTool.execute({
    operation: 'usage_stats',
    userId: 'user-id',
    period: 'week'
  });

  console.log('Success:', result.data);
} catch (error) {
  console.error('Error:', error.message);
  // Common errors:
  // - "User ID required"
  // - "Unknown operation"
  // - "No usage data found"
  // - "Model pricing not configured"
}
```

## Quick Tips

1. **Monitor Daily:** Run cost_analysis daily to catch budget overruns early
2. **Review Weekly:** Use optimization_tips weekly to find savings opportunities
3. **Compare Before Switching:** Use model_comparison before changing models
4. **Track Peak Usage:** Check peakUsageDay to understand usage patterns
5. **Cache Results:** Cache daily stats for 1 hour to improve performance
6. **Use Filters:** Apply conversationId or modelId filters for faster queries
7. **Update Pricing:** Keep model pricing current in config.ts
8. **Verify Token Counts:** Ensure actual token counts are stored in database

## Real-World Examples

### Example 1: Budget Alert System

```typescript
async function checkBudget(userId: string) {
  const monthlyLimit = 100.0;

  const costs = await tokenAnalyzerTool.execute({
    operation: 'cost_analysis',
    userId,
    period: 'month'
  });

  const percentUsed = (costs.data.totalCost / monthlyLimit) * 100;

  if (percentUsed > 90) {
    console.log('🚨 Critical: 90% of budget used!');
  } else if (percentUsed > 75) {
    console.log('⚠️ Warning: 75% of budget used');
  }

  console.log(`Budget: $${costs.data.totalCost.toFixed(2)} / $${monthlyLimit}`);
  console.log(`Remaining: $${(monthlyLimit - costs.data.totalCost).toFixed(2)}`);
}
```

### Example 2: Model Performance Dashboard

```typescript
async function modelDashboard(userId: string) {
  const comparison = await tokenAnalyzerTool.execute({
    operation: 'model_comparison',
    userId,
    period: 'week'
  });

  console.log('=== Model Performance ===\n');

  comparison.data.models
    .sort((a, b) => a.efficiency.costPerToken - b.efficiency.costPerToken)
    .forEach((model, index) => {
      console.log(`${index + 1}. ${model.modelName}`);
      console.log(`   Cost: $${model.cost.total.toFixed(2)}`);
      console.log(`   Per Token: $${model.efficiency.costPerToken.toFixed(6)}`);
      console.log(`   Speed: ${model.performance.averageResponseTime}ms`);
      console.log(`   Messages: ${model.usage.messageCount}`);
      console.log('');
    });

  console.log('Recommendations:');
  console.log(`  Most Cost-Effective: ${comparison.data.comparison.mostCostEffective}`);
  console.log(`  Fastest: ${comparison.data.comparison.fastest}`);
  console.log(`  Most Efficient: ${comparison.data.comparison.mostEfficient}`);
}
```

### Example 3: Automated Optimization Report

```typescript
async function optimizationReport(userId: string) {
  // Get current stats
  const usage = await tokenAnalyzerTool.execute({
    operation: 'usage_stats',
    userId,
    period: 'month'
  });

  const costs = await tokenAnalyzerTool.execute({
    operation: 'cost_analysis',
    userId,
    period: 'month'
  });

  const tips = await tokenAnalyzerTool.execute({
    operation: 'optimization_tips',
    userId,
    period: 'month'
  });

  console.log('=== Monthly Optimization Report ===\n');

  console.log('Current Usage:');
  console.log(`  Tokens: ${usage.data.totalTokens.toLocaleString()}`);
  console.log(`  Cost: $${costs.data.totalCost.toFixed(2)}`);
  console.log(`  Messages: ${usage.data.messageCount}`);
  console.log(`  Peak Day: ${usage.data.peakUsageDay.date}`);

  console.log('\nOptimization Opportunities:');
  console.log(`  Potential Savings: $${tips.data.summary.totalPotentialSavings.toFixed(2)}/month`);
  console.log(`  High-Impact Tips: ${tips.data.summary.highImpactTips}`);

  console.log('\nTop Recommendations:');
  tips.data.tips
    .filter(t => t.impact === 'high')
    .slice(0, 3)
    .forEach((tip, index) => {
      console.log(`\n${index + 1}. ${tip.title}`);
      console.log(`   Impact: ${tip.impact}`);
      console.log(`   Savings: $${tip.potentialSavings.cost?.toFixed(2) || 'N/A'}`);
      console.log(`   Actions:`);
      tip.actionItems.forEach(action => console.log(`     - ${action}`));
    });

  if (tips.data.modelRecommendations) {
    console.log('\nModel Recommendation:');
    console.log(`  Current: ${tips.data.modelRecommendations.current}`);
    console.log(`  Suggested: ${tips.data.modelRecommendations.suggested}`);
    console.log(`  Reason: ${tips.data.modelRecommendations.reason}`);
    console.log(`  Est. Savings: $${tips.data.modelRecommendations.estimatedSavings.toFixed(2)}/month`);
  }
}
```

## Need More Details?

See full documentation: `/lib/tools/token-analyzer/README.md`

## Test It

```bash
# Create test script
cat > test-analyzer.ts << 'EOF'
import { tokenAnalyzerTool } from './index';

async function test() {
  const userId = 'your-user-id';

  console.log('Testing Token Analyzer...\n');

  // Test usage stats
  const usage = await tokenAnalyzerTool.execute({
    operation: 'usage_stats',
    userId,
    period: 'week'
  });
  console.log('✓ Usage Stats:', usage.data.totalTokens, 'tokens');

  // Test cost analysis
  const costs = await tokenAnalyzerTool.execute({
    operation: 'cost_analysis',
    userId,
    period: 'month'
  });
  console.log('✓ Cost Analysis: $' + costs.data.totalCost.toFixed(2));

  // Test model comparison
  const comparison = await tokenAnalyzerTool.execute({
    operation: 'model_comparison',
    userId,
    period: 'week'
  });
  console.log('✓ Model Comparison:', comparison.data.models.length, 'models');

  // Test optimization tips
  const tips = await tokenAnalyzerTool.execute({
    operation: 'optimization_tips',
    userId,
    period: 'week'
  });
  console.log('✓ Optimization Tips:', tips.data.tips.length, 'tips');

  console.log('\nAll tests passed! ✓');
}

test().catch(console.error);
EOF

# Run test
npx tsx test-analyzer.ts
```
