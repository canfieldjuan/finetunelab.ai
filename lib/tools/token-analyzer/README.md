# Token Analyzer Tool

**Version:** 1.0.0
**Location:** `/lib/tools/token-analyzer`
**Type:** Analytics & Optimization
**Access:** READ-ONLY

---

## Overview

The **Token Analyzer Tool** provides comprehensive token usage tracking, cost analysis, model comparison, and optimization recommendations for AI applications. It helps developers understand token consumption patterns, optimize costs, and make informed decisions about model selection.

### Key Features

- **Usage Tracking:** Monitor token consumption across conversations and models
- **Cost Analysis:** Calculate actual costs based on real-time pricing
- **Model Comparison:** Compare efficiency and cost-effectiveness across models
- **Optimization Tips:** Get actionable recommendations to reduce token usage
- **Peak Usage Tracking:** Identify high-usage days and patterns
- **Response Time Analysis:** Correlate token usage with performance

---

## What It Does

### 4 Core Operations

1. **usage_stats** - Track token consumption patterns and trends
2. **cost_analysis** - Calculate costs and spending breakdowns
3. **model_comparison** - Compare model efficiency and cost-effectiveness
4. **optimization_tips** - Get recommendations to reduce token usage

---

## Architecture

### File Structure

```
token-analyzer/
├── index.ts                      # Tool definition and registration
├── types.ts                      # TypeScript interfaces
├── config.ts                     # Model pricing configuration
├── token-analyzer.service.ts     # Core service implementation
└── README.md                     # This file
```

### Dependencies

- **Supabase Client:** Database queries for message/conversation data
- **Database Tables:**
  - `messages` - Message content and token counts
  - `conversations` - Conversation metadata
  - `llm_models` - Model information and pricing

### Key Algorithms

**Token Estimation:**
```typescript
// Approximate token count from text
estimatedTokens = Math.ceil(text.length / 4);
// Based on industry standard: ~1 token per 4 characters
```

**Cost Calculation:**
```typescript
cost = (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000;
// Prices are per 1M tokens
```

---

## Operations

### 1. Usage Stats

Track token consumption patterns over time.

#### Input Schema

```typescript
{
  operation: 'usage_stats',
  userId: string,              // Required
  period?: string,             // 'day' | 'week' | 'month' | 'all' (default: 'week')
  modelId?: string,            // Filter specific model
  conversationId?: string      // Filter specific conversation
}
```

#### Output Schema

```typescript
{
  success: true,
  data: {
    totalTokens: number,
    inputTokens: number,
    outputTokens: number,
    messageCount: number,
    conversationCount: number,
    averageTokensPerMessage: number,
    averageTokensPerConversation: number,
    peakUsageDay: {
      date: string,
      tokens: number
    },
    modelBreakdown: Array<{
      modelId: string,
      modelName: string,
      tokens: number,
      percentage: number
    }>,
    dailyStats: Array<{
      date: string,
      tokens: number,
      messages: number
    }>,
    period: string,
    dateRange: {
      start: string,
      end: string
    }
  }
}
```

#### Example Usage

```typescript
import { tokenAnalyzerTool } from '@/lib/tools/token-analyzer';

// Get weekly usage stats
const result = await tokenAnalyzerTool.execute({
  operation: 'usage_stats',
  userId: 'user-123',
  period: 'week'
});

console.log('Total Tokens:', result.data.totalTokens);
console.log('Peak Day:', result.data.peakUsageDay.date);
console.log('Avg per Message:', result.data.averageTokensPerMessage);

// Output:
// Total Tokens: 145230
// Peak Day: 2025-10-20
// Avg per Message: 423
```

#### Use Cases

1. **Monitor Usage Patterns:**
   ```typescript
   // Track daily usage
   const daily = await tokenAnalyzerTool.execute({
     operation: 'usage_stats',
     userId: 'user-123',
     period: 'day'
   });

   if (daily.data.totalTokens > 100000) {
     console.log('High usage detected today!');
   }
   ```

2. **Model-Specific Tracking:**
   ```typescript
   // Track GPT-4 usage
   const gpt4Usage = await tokenAnalyzerTool.execute({
     operation: 'usage_stats',
     userId: 'user-123',
     modelId: 'gpt-4',
     period: 'month'
   });

   console.log('GPT-4 Tokens:', gpt4Usage.data.totalTokens);
   ```

3. **Conversation Analysis:**
   ```typescript
   // Analyze specific conversation
   const convStats = await tokenAnalyzerTool.execute({
     operation: 'usage_stats',
     userId: 'user-123',
     conversationId: 'conv-456'
   });

   console.log('Tokens in Conversation:', convStats.data.totalTokens);
   ```

---

### 2. Cost Analysis

Calculate actual costs based on model pricing.

#### Input Schema

```typescript
{
  operation: 'cost_analysis',
  userId: string,              // Required
  period?: string,             // 'day' | 'week' | 'month' | 'all' (default: 'month')
  modelId?: string,            // Filter specific model
  conversationId?: string      // Filter specific conversation
}
```

#### Output Schema

```typescript
{
  success: true,
  data: {
    totalCost: number,
    inputCost: number,
    outputCost: number,
    totalTokens: number,
    breakdown: Array<{
      modelId: string,
      modelName: string,
      cost: number,
      tokens: number,
      percentage: number,
      pricing: {
        input: number,    // per 1M tokens
        output: number    // per 1M tokens
      }
    }>,
    dailyCosts: Array<{
      date: string,
      cost: number,
      tokens: number
    }>,
    averageCostPerMessage: number,
    averageCostPerConversation: number,
    period: string,
    dateRange: {
      start: string,
      end: string
    }
  }
}
```

#### Example Usage

```typescript
// Get monthly cost analysis
const result = await tokenAnalyzerTool.execute({
  operation: 'cost_analysis',
  userId: 'user-123',
  period: 'month'
});

console.log('Total Cost:', `$${result.data.totalCost.toFixed(2)}`);
console.log('Avg per Message:', `$${result.data.averageCostPerMessage.toFixed(4)}`);
console.log('Most Expensive Model:', result.data.breakdown[0].modelName);

// Output:
// Total Cost: $12.45
// Avg per Message: $0.0362
// Most Expensive Model: gpt-4
```

#### Use Cases

1. **Budget Monitoring:**
   ```typescript
   // Check monthly spending
   const costs = await tokenAnalyzerTool.execute({
     operation: 'cost_analysis',
     userId: 'user-123',
     period: 'month'
   });

   const BUDGET_LIMIT = 50.0;
   if (costs.data.totalCost > BUDGET_LIMIT) {
     console.log('⚠️ Budget exceeded!');
   }
   ```

2. **Model Cost Comparison:**
   ```typescript
   // Compare costs across models
   const analysis = await tokenAnalyzerTool.execute({
     operation: 'cost_analysis',
     userId: 'user-123',
     period: 'week'
   });

   analysis.data.breakdown.forEach(model => {
     console.log(`${model.modelName}: $${model.cost.toFixed(2)} (${model.percentage}%)`);
   });
   ```

3. **Daily Cost Tracking:**
   ```typescript
   // Track daily costs
   const daily = await tokenAnalyzerTool.execute({
     operation: 'cost_analysis',
     userId: 'user-123',
     period: 'week'
   });

   const highCostDays = daily.data.dailyCosts.filter(d => d.cost > 2.0);
   console.log('High cost days:', highCostDays.length);
   ```

---

### 3. Model Comparison

Compare efficiency and cost-effectiveness across different AI models.

#### Input Schema

```typescript
{
  operation: 'model_comparison',
  userId: string,              // Required
  period?: string,             // 'day' | 'week' | 'month' | 'all' (default: 'month')
  modelIds?: string[]          // Optional: specific models to compare
}
```

#### Output Schema

```typescript
{
  success: true,
  data: {
    models: Array<{
      modelId: string,
      modelName: string,
      usage: {
        totalTokens: number,
        inputTokens: number,
        outputTokens: number,
        messageCount: number,
        conversationCount: number
      },
      cost: {
        total: number,
        input: number,
        output: number,
        perMessage: number,
        perConversation: number
      },
      efficiency: {
        tokensPerMessage: number,
        tokensPerConversation: number,
        costPerToken: number,
        inputOutputRatio: number
      },
      performance: {
        averageResponseTime: number,  // milliseconds
        responseCount: number
      },
      pricing: {
        input: number,    // per 1M tokens
        output: number    // per 1M tokens
      }
    }>,
    comparison: {
      mostEfficient: string,      // Model ID
      mostCostEffective: string,  // Model ID
      fastest: string,            // Model ID
      totalCost: number,
      totalTokens: number
    },
    period: string,
    dateRange: {
      start: string,
      end: string
    }
  }
}
```

#### Example Usage

```typescript
// Compare all models
const result = await tokenAnalyzerTool.execute({
  operation: 'model_comparison',
  userId: 'user-123',
  period: 'month'
});

console.log('Most Efficient:', result.data.comparison.mostEfficient);
console.log('Most Cost-Effective:', result.data.comparison.mostCostEffective);
console.log('Fastest:', result.data.comparison.fastest);

// Compare specific models
const specific = await tokenAnalyzerTool.execute({
  operation: 'model_comparison',
  userId: 'user-123',
  modelIds: ['gpt-4', 'gpt-4o', 'gpt-4o-mini'],
  period: 'week'
});

specific.data.models.forEach(model => {
  console.log(`${model.modelName}:`);
  console.log(`  Cost: $${model.cost.total.toFixed(2)}`);
  console.log(`  Per Token: $${model.efficiency.costPerToken.toFixed(6)}`);
  console.log(`  Response Time: ${model.performance.averageResponseTime}ms`);
});
```

#### Use Cases

1. **Model Selection:**
   ```typescript
   // Find most cost-effective model
   const comparison = await tokenAnalyzerTool.execute({
     operation: 'model_comparison',
     userId: 'user-123',
     period: 'month'
   });

   const recommended = comparison.data.comparison.mostCostEffective;
   console.log('Recommended Model:', recommended);
   ```

2. **Performance vs Cost Analysis:**
   ```typescript
   // Compare performance and cost
   const result = await tokenAnalyzerTool.execute({
     operation: 'model_comparison',
     userId: 'user-123',
     period: 'week'
   });

   result.data.models.forEach(model => {
     const value = model.performance.averageResponseTime / model.cost.total;
     console.log(`${model.modelName} Value Score: ${value.toFixed(2)}`);
   });
   ```

3. **Migration Planning:**
   ```typescript
   // Evaluate switching models
   const current = 'gpt-4';
   const alternative = 'gpt-4o';

   const comparison = await tokenAnalyzerTool.execute({
     operation: 'model_comparison',
     userId: 'user-123',
     modelIds: [current, alternative],
     period: 'month'
   });

   const currentModel = comparison.data.models.find(m => m.modelId === current);
   const altModel = comparison.data.models.find(m => m.modelId === alternative);

   const savings = currentModel.cost.total - altModel.cost.total;
   console.log(`Potential Monthly Savings: $${savings.toFixed(2)}`);
   ```

---

### 4. Optimization Tips

Get actionable recommendations to reduce token usage and costs.

#### Input Schema

```typescript
{
  operation: 'optimization_tips',
  userId: string,              // Required
  period?: string,             // 'day' | 'week' | 'month' | 'all' (default: 'week')
  conversationId?: string      // Analyze specific conversation
}
```

#### Output Schema

```typescript
{
  success: true,
  data: {
    currentUsage: {
      totalTokens: number,
      totalCost: number,
      averageTokensPerMessage: number,
      period: string
    },
    tips: Array<{
      category: string,        // 'model_selection' | 'message_optimization' | 'cost_reduction' | 'efficiency'
      title: string,
      description: string,
      impact: 'high' | 'medium' | 'low',
      potentialSavings: {
        tokens?: number,
        cost?: number,
        percentage?: number
      },
      actionItems: string[]
    }>,
    modelRecommendations: {
      current: string,
      suggested: string,
      reason: string,
      estimatedSavings: number
    },
    summary: {
      totalPotentialSavings: number,
      highImpactTips: number,
      implementationPriority: string[]
    }
  }
}
```

#### Example Usage

```typescript
// Get optimization recommendations
const result = await tokenAnalyzerTool.execute({
  operation: 'optimization_tips',
  userId: 'user-123',
  period: 'week'
});

console.log('Current Cost:', `$${result.data.currentUsage.totalCost.toFixed(2)}`);
console.log('Potential Savings:', `$${result.data.summary.totalPotentialSavings.toFixed(2)}`);

result.data.tips.forEach(tip => {
  if (tip.impact === 'high') {
    console.log(`\n🎯 ${tip.title}`);
    console.log(tip.description);
    console.log('Actions:');
    tip.actionItems.forEach(action => console.log(`  - ${action}`));
  }
});
```

#### Use Cases

1. **Regular Optimization Review:**
   ```typescript
   // Weekly optimization check
   const tips = await tokenAnalyzerTool.execute({
     operation: 'optimization_tips',
     userId: 'user-123',
     period: 'week'
   });

   const highImpact = tips.data.tips.filter(t => t.impact === 'high');
   console.log(`${highImpact.length} high-impact optimizations available`);
   ```

2. **Conversation-Specific Optimization:**
   ```typescript
   // Optimize specific conversation
   const convTips = await tokenAnalyzerTool.execute({
     operation: 'optimization_tips',
     userId: 'user-123',
     conversationId: 'conv-456'
   });

   console.log('Conversation Optimization Tips:');
   convTips.data.tips.forEach(tip => console.log(`- ${tip.title}`));
   ```

3. **Model Migration Guidance:**
   ```typescript
   // Get model recommendations
   const result = await tokenAnalyzerTool.execute({
     operation: 'optimization_tips',
     userId: 'user-123',
     period: 'month'
   });

   const { modelRecommendations } = result.data;
   console.log(`Current: ${modelRecommendations.current}`);
   console.log(`Suggested: ${modelRecommendations.suggested}`);
   console.log(`Reason: ${modelRecommendations.reason}`);
   console.log(`Savings: $${modelRecommendations.estimatedSavings.toFixed(2)}/month`);
   ```

---

## When to Use

### ✅ Use Token Analyzer When:

1. **Cost Monitoring**
   - Track monthly/weekly spending
   - Monitor budget compliance
   - Identify cost spikes

2. **Model Selection**
   - Compare model efficiency
   - Evaluate cost vs performance
   - Plan model migrations

3. **Usage Optimization**
   - Reduce token consumption
   - Optimize message patterns
   - Improve cost-effectiveness

4. **Capacity Planning**
   - Forecast token usage
   - Plan for scaling
   - Budget for growth

5. **Performance Analysis**
   - Correlate tokens with response times
   - Identify inefficient patterns
   - Optimize conversation flows

---

## When NOT to Use

### ❌ Do NOT Use Token Analyzer When:

1. **Real-Time Token Counting Required**
   - **Limitation:** Queries historical data, not real-time
   - **Alternative:** Use model's native token counting API
   - **Why:** Token counts are stored after message completion

2. **Exact Token Counts Needed**
   - **Limitation:** Uses estimation (~4 chars/token) when actual count unavailable
   - **Alternative:** Use tiktoken or model-specific tokenizers
   - **Why:** Estimation may vary ±10% from actual

3. **Token-Level Debugging**
   - **Limitation:** High-level analytics, not token-by-token analysis
   - **Alternative:** Use tokenizer visualization tools
   - **Why:** Doesn't show individual token breakdowns

4. **Modifying Token Usage**
   - **Limitation:** READ-ONLY analytics tool
   - **Alternative:** Modify application logic directly
   - **Why:** Cannot change message content or model behavior

5. **Non-Message Token Usage**
   - **Limitation:** Only tracks message tokens
   - **Alternative:** Track embeddings/fine-tuning separately
   - **Why:** Focuses on conversation messages only

---

## Configuration

### Model Pricing

Configuration is in `/lib/tools/token-analyzer/config.ts`:

```typescript
export const tokenAnalyzerConfig = {
  enabled: true,

  // Pricing per 1M tokens (USD)
  pricing: {
    'gpt-4': {
      input: 30.0,
      output: 60.0
    },
    'gpt-4-32k': {
      input: 60.0,
      output: 120.0
    },
    'gpt-4o': {
      input: 5.0,
      output: 15.0
    },
    'gpt-4o-mini': {
      input: 0.15,
      output: 0.6
    },
    'gpt-3.5-turbo': {
      input: 0.5,
      output: 1.5
    },
    'gpt-3.5-turbo-16k': {
      input: 3.0,
      output: 4.0
    },
    'claude-3-opus': {
      input: 15.0,
      output: 75.0
    },
    'claude-3-sonnet': {
      input: 3.0,
      output: 15.0
    },
    'claude-3-haiku': {
      input: 0.25,
      output: 1.25
    }
  },

  // Token estimation
  estimation: {
    charsPerToken: 4  // ~1 token per 4 characters
  },

  // Thresholds for optimization tips
  thresholds: {
    highUsageTokens: 100000,      // Tokens per week
    highCostPerMessage: 0.05,      // USD
    lowEfficiency: 500             // Tokens per message
  }
};
```

### Updating Pricing

To update model pricing:

```typescript
// In config.ts
pricing: {
  'new-model': {
    input: 10.0,   // per 1M tokens
    output: 30.0   // per 1M tokens
  }
}
```

---

## Database Schema

### Required Tables

**messages:**
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  content TEXT,
  role VARCHAR(50),
  model_id VARCHAR(100),
  token_count INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**conversations:**
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  model_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**llm_models:**
```sql
CREATE TABLE llm_models (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200),
  provider VARCHAR(100),
  input_price_per_million DECIMAL,
  output_price_per_million DECIMAL
);
```

---

## How to Use

### Basic Usage

```typescript
import { tokenAnalyzerTool } from '@/lib/tools/token-analyzer';

// 1. Check current usage
const usage = await tokenAnalyzerTool.execute({
  operation: 'usage_stats',
  userId: 'user-123',
  period: 'day'
});

console.log('Today:', usage.data.totalTokens, 'tokens');

// 2. Calculate costs
const costs = await tokenAnalyzerTool.execute({
  operation: 'cost_analysis',
  userId: 'user-123',
  period: 'month'
});

console.log('Monthly Cost:', `$${costs.data.totalCost.toFixed(2)}`);

// 3. Compare models
const comparison = await tokenAnalyzerTool.execute({
  operation: 'model_comparison',
  userId: 'user-123',
  period: 'week'
});

console.log('Best Model:', comparison.data.comparison.mostCostEffective);

// 4. Get optimization tips
const tips = await tokenAnalyzerTool.execute({
  operation: 'optimization_tips',
  userId: 'user-123'
});

console.log('Potential Savings:', `$${tips.data.summary.totalPotentialSavings.toFixed(2)}`);
```

### Common Workflows

#### 1. Daily Cost Monitoring

```typescript
async function dailyCostCheck(userId: string) {
  // Get today's costs
  const costs = await tokenAnalyzerTool.execute({
    operation: 'cost_analysis',
    userId,
    period: 'day'
  });

  // Alert if over budget
  const DAILY_LIMIT = 5.0;
  if (costs.data.totalCost > DAILY_LIMIT) {
    console.log('⚠️ Daily budget exceeded!');
    console.log(`Spent: $${costs.data.totalCost.toFixed(2)}`);

    // Get optimization tips
    const tips = await tokenAnalyzerTool.execute({
      operation: 'optimization_tips',
      userId,
      period: 'day'
    });

    console.log('Suggestions:');
    tips.data.tips.forEach(tip => {
      console.log(`- ${tip.title}`);
    });
  }
}
```

#### 2. Weekly Optimization Review

```typescript
async function weeklyReview(userId: string) {
  // Get usage stats
  const usage = await tokenAnalyzerTool.execute({
    operation: 'usage_stats',
    userId,
    period: 'week'
  });

  // Get cost analysis
  const costs = await tokenAnalyzerTool.execute({
    operation: 'cost_analysis',
    userId,
    period: 'week'
  });

  // Compare models
  const comparison = await tokenAnalyzerTool.execute({
    operation: 'model_comparison',
    userId,
    period: 'week'
  });

  // Get optimization tips
  const tips = await tokenAnalyzerTool.execute({
    operation: 'optimization_tips',
    userId,
    period: 'week'
  });

  console.log('=== Weekly Report ===');
  console.log('Total Tokens:', usage.data.totalTokens.toLocaleString());
  console.log('Total Cost:', `$${costs.data.totalCost.toFixed(2)}`);
  console.log('Best Model:', comparison.data.comparison.mostCostEffective);
  console.log('Potential Savings:', `$${tips.data.summary.totalPotentialSavings.toFixed(2)}`);
  console.log('\nTop Recommendations:');
  tips.data.tips.filter(t => t.impact === 'high').forEach(tip => {
    console.log(`- ${tip.title}: Save $${tip.potentialSavings.cost?.toFixed(2) || 'N/A'}`);
  });
}
```

#### 3. Model Migration Decision

```typescript
async function evaluateModelMigration(userId: string, currentModel: string, targetModel: string) {
  // Compare the two models
  const comparison = await tokenAnalyzerTool.execute({
    operation: 'model_comparison',
    userId,
    modelIds: [currentModel, targetModel],
    period: 'month'
  });

  const current = comparison.data.models.find(m => m.modelId === currentModel);
  const target = comparison.data.models.find(m => m.modelId === targetModel);

  if (!current || !target) {
    console.log('Models not found in data');
    return;
  }

  const costSavings = current.cost.total - target.cost.total;
  const performanceChange = target.performance.averageResponseTime - current.performance.averageResponseTime;

  console.log('=== Migration Analysis ===');
  console.log(`Current: ${current.modelName}`);
  console.log(`  Cost: $${current.cost.total.toFixed(2)}/month`);
  console.log(`  Response Time: ${current.performance.averageResponseTime}ms`);
  console.log(`  Cost per Token: $${current.efficiency.costPerToken.toFixed(6)}`);

  console.log(`\nTarget: ${target.modelName}`);
  console.log(`  Cost: $${target.cost.total.toFixed(2)}/month`);
  console.log(`  Response Time: ${target.performance.averageResponseTime}ms`);
  console.log(`  Cost per Token: $${target.efficiency.costPerToken.toFixed(6)}`);

  console.log(`\nImpact:`);
  console.log(`  Monthly Savings: $${costSavings.toFixed(2)}`);
  console.log(`  Performance Change: ${performanceChange > 0 ? '+' : ''}${performanceChange}ms`);
  console.log(`  Annual Savings: $${(costSavings * 12).toFixed(2)}`);

  if (costSavings > 0 && performanceChange < 100) {
    console.log(`\n✅ Recommendation: Migrate to ${targetModel}`);
  } else if (costSavings < 0) {
    console.log(`\n⚠️ Warning: Migration will increase costs`);
  }
}
```

---

## Troubleshooting

### Issue: "No usage data found"

**Cause:** User has no messages in the selected period

**Solution:**
```typescript
// Check if data exists before analyzing
const usage = await tokenAnalyzerTool.execute({
  operation: 'usage_stats',
  userId: 'user-123',
  period: 'all'
});

if (usage.data.messageCount === 0) {
  console.log('No messages found for this user');
}
```

---

### Issue: "Estimated token counts seem incorrect"

**Cause:** Token estimation is approximate (~4 chars/token)

**Solution:** Ensure actual token counts are stored in database
```sql
-- Verify token counts are populated
SELECT id, token_count, input_tokens, output_tokens
FROM messages
WHERE user_id = 'user-123'
LIMIT 10;

-- If NULL, token estimation is being used
-- Store actual counts from model responses
```

---

### Issue: "Model pricing not found"

**Cause:** Model not in pricing configuration

**Solution:** Add model pricing to config.ts
```typescript
// In config.ts
pricing: {
  'your-model-id': {
    input: 10.0,   // per 1M tokens
    output: 30.0   // per 1M tokens
  }
}
```

---

### Issue: "Cost calculations seem too high/low"

**Cause:** Outdated pricing or incorrect token counts

**Solution:**
1. Verify pricing is current:
   ```typescript
   // Check configured pricing
   import { tokenAnalyzerConfig } from '@/lib/tools/token-analyzer/config';
   console.log(tokenAnalyzerConfig.pricing);
   ```

2. Compare with actual usage:
   ```sql
   SELECT
     model_id,
     SUM(input_tokens) as total_input,
     SUM(output_tokens) as total_output
   FROM messages
   WHERE user_id = 'user-123'
   GROUP BY model_id;
   ```

---

## Testing

### Running Tests

```bash
# Navigate to tool directory
cd /lib/tools/token-analyzer

# Run tests (if available)
npm test

# Manual testing
npx tsx test-analyzer.ts
```

### Test Script

Create `test-analyzer.ts`:

```typescript
import { tokenAnalyzerTool } from './index';

async function testTokenAnalyzer() {
  const userId = 'test-user-id';

  console.log('Testing Token Analyzer Tool\n');

  // Test 1: Usage Stats
  console.log('1. Usage Stats:');
  const usage = await tokenAnalyzerTool.execute({
    operation: 'usage_stats',
    userId,
    period: 'week'
  });
  console.log('  Total Tokens:', usage.data.totalTokens);
  console.log('  Messages:', usage.data.messageCount);
  console.log('  ✓ Passed\n');

  // Test 2: Cost Analysis
  console.log('2. Cost Analysis:');
  const costs = await tokenAnalyzerTool.execute({
    operation: 'cost_analysis',
    userId,
    period: 'month'
  });
  console.log('  Total Cost:', `$${costs.data.totalCost.toFixed(2)}`);
  console.log('  ✓ Passed\n');

  // Test 3: Model Comparison
  console.log('3. Model Comparison:');
  const comparison = await tokenAnalyzerTool.execute({
    operation: 'model_comparison',
    userId,
    period: 'week'
  });
  console.log('  Models Compared:', comparison.data.models.length);
  console.log('  ✓ Passed\n');

  // Test 4: Optimization Tips
  console.log('4. Optimization Tips:');
  const tips = await tokenAnalyzerTool.execute({
    operation: 'optimization_tips',
    userId,
    period: 'week'
  });
  console.log('  Tips Generated:', tips.data.tips.length);
  console.log('  ✓ Passed\n');

  console.log('All tests passed! ✓');
}

testTokenAnalyzer().catch(console.error);
```

---

## Performance

### Query Performance

| Operation | Typical Time | Notes |
|-----------|--------------|-------|
| usage_stats | 100-300ms | Depends on message count |
| cost_analysis | 150-400ms | Includes calculations |
| model_comparison | 200-500ms | Multiple aggregations |
| optimization_tips | 300-600ms | Most complex operation |

### Optimization Tips

1. **Use Specific Filters:**
   ```typescript
   // Faster: Filter by conversation
   const result = await tokenAnalyzerTool.execute({
     operation: 'usage_stats',
     userId: 'user-123',
     conversationId: 'conv-456'
   });

   // Slower: All conversations
   const all = await tokenAnalyzerTool.execute({
     operation: 'usage_stats',
     userId: 'user-123',
     period: 'all'
   });
   ```

2. **Use Appropriate Periods:**
   ```typescript
   // Fast: Recent data
   { period: 'day' }    // ~100ms
   { period: 'week' }   // ~200ms

   // Slower: Long history
   { period: 'month' }  // ~400ms
   { period: 'all' }    // ~800ms
   ```

3. **Cache Results:**
   ```typescript
   // Cache daily stats
   let cachedStats = null;
   let cacheTime = 0;
   const CACHE_TTL = 3600000; // 1 hour

   async function getCachedStats(userId: string) {
     if (cachedStats && Date.now() - cacheTime < CACHE_TTL) {
       return cachedStats;
     }

     cachedStats = await tokenAnalyzerTool.execute({
       operation: 'usage_stats',
       userId,
       period: 'day'
     });
     cacheTime = Date.now();

     return cachedStats;
   }
   ```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Oct 22, 2025 | Initial implementation |

---

## Support

**Documentation:**
- Full Documentation: This file
- Quick Start: `/lib/tools/token-analyzer/QUICK_START.md`
- Types Reference: `/lib/tools/token-analyzer/types.ts`
- Configuration: `/lib/tools/token-analyzer/config.ts`

**Related Tools:**
- Evaluation Metrics: `/lib/tools/evaluation-metrics`
- System Monitor: `/lib/tools/system-monitor`
- Dataset Manager: `/lib/tools/dataset-manager`

---

**Last Updated:** October 22, 2025
**Maintained By:** FineTune Lab Development Team
