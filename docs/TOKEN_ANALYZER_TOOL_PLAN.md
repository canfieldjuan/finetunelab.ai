# Token Analysis Tool - Implementation Plan

**Date:** October 13, 2025  
**Tool #:** 5 of 7 in LLM Evaluation Platform  
**Priority:** HIGH - Cost tracking and optimization  

---

## 🎯 OBJECTIVE

Build a Token Analysis Tool that tracks token usage, calculates costs, identifies optimization opportunities, and compares model efficiency across the platform.

---

## 📋 REQUIREMENTS

### Core Operations

1. **usage_stats** - Get token usage statistics for a user/conversation
2. **cost_analysis** - Calculate costs by model and time period
3. **model_comparison** - Compare token efficiency across models
4. **optimization_tips** - Identify cost-saving opportunities

### Integration Points

- **OpenAI LLMUsage** - Track input/output tokens from LLM responses
- **Supabase Messages** - Query message history for analysis
- **GraphRAG Episodes** - Analyze document processing costs
- **Tool Calls** - Track token usage from tool interactions

---

## 🗂️ FILE STRUCTURE

```
lib/tools/token-analyzer/
├── index.ts                 # Tool definition and operations
├── token-analyzer.service.ts # Core analysis logic
├── types.ts                 # TypeScript interfaces
├── config.ts                # Configuration settings
└── test.ts                  # Basic tests
```

---

## 📐 TYPE DEFINITIONS

### types.ts

```typescript
export interface TokenUsage {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  conversationId?: string;
  model: string;
  timestamp: string;
}

export interface CostBreakdown {
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface UsageStats {
  userId: string;
  period: string;
  totalTokens: number;
  totalCost: number;
  byModel: CostBreakdown[];
  averagePerMessage: number;
  peakUsageDay: string;
}

export interface ModelComparison {
  models: string[];
  metrics: {
    avgTokensPerMessage: number[];
    avgCostPerMessage: number[];
    avgResponseTime: number[];
    totalMessages: number[];
  };
  recommendation: string;
}

export interface OptimizationTip {
  category: string;
  issue: string;
  suggestion: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
}

export interface OptimizationReport {
  currentCost: number;
  potentialSavings: number;
  tips: OptimizationTip[];
}

export interface AnalyzerOptions {
  period?: 'day' | 'week' | 'month' | 'all';
  startDate?: string;
  endDate?: string;
  conversationId?: string;
  model?: string;
}
```

---

## ⚙️ CONFIGURATION

### config.ts

```typescript
export const tokenAnalyzerConfig = {
  enabled: true,
  
  // Model pricing (per 1M tokens)
  pricing: {
    'gpt-4': {
      input: 30.00,   // $30 per 1M input tokens
      output: 60.00,  // $60 per 1M output tokens
    },
    'gpt-4-turbo': {
      input: 10.00,
      output: 30.00,
    },
    'gpt-4o': {
      input: 5.00,
      output: 15.00,
    },
    'gpt-4o-mini': {
      input: 0.150,
      output: 0.600,
    },
    'gpt-3.5-turbo': {
      input: 0.50,
      output: 1.50,
    },
  },
  
  // Alert thresholds
  thresholds: {
    dailyCostWarning: 10.00,    // $10/day
    monthlyCostWarning: 200.00, // $200/month
    tokensPerMessageWarning: 4000, // Warn if avg > 4k tokens
  },
  
  // Analysis settings
  defaultPeriod: 'week' as const,
  maxMessagesAnalyzed: 10000,
};
```

---

## 🔧 SERVICE IMPLEMENTATION

### token-analyzer.service.ts

```typescript
import { createClient } from '@/lib/supabase/server';
import { tokenAnalyzerConfig } from './config';
import type {
  TokenUsage,
  CostBreakdown,
  UsageStats,
  ModelComparison,
  OptimizationTip,
  OptimizationReport,
  AnalyzerOptions,
} from './types';

class TokenAnalyzerService {
  // Calculate cost from token counts
  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): { inputCost: number; outputCost: number; totalCost: number } {
    const pricing = tokenAnalyzerConfig.pricing[model] || tokenAnalyzerConfig.pricing['gpt-4o-mini'];
    
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;
    
    return { inputCost, outputCost, totalCost };
  }
  
  // Get usage statistics for a user
  async getUsageStats(
    userId: string,
    options: AnalyzerOptions = {}
  ): Promise<UsageStats> {
    try {
      const supabase = await createClient();
      const period = options.period || tokenAnalyzerConfig.defaultPeriod;
      
      // Calculate date range
      const endDate = options.endDate ? new Date(options.endDate) : new Date();
      const startDate = options.startDate
        ? new Date(options.startDate)
        : this.getStartDate(period, endDate);
      
      // Query messages with token usage
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          conversation:conversations!inner(user_id, model)
        `)
        .eq('conversations.user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .limit(tokenAnalyzerConfig.maxMessagesAnalyzed);
      
      if (error) throw error;
      
      // Aggregate by model
      const modelStats = new Map<string, CostBreakdown>();
      let totalTokens = 0;
      let totalCost = 0;
      
      for (const message of messages || []) {
        const model = message.conversation?.model || 'gpt-4o-mini';
        const tokens = this.estimateTokens(message.content || '');
        const inputTokens = Math.floor(tokens * 0.3); // Rough estimate
        const outputTokens = Math.floor(tokens * 0.7);
        
        const cost = this.calculateCost(model, inputTokens, outputTokens);
        
        if (!modelStats.has(model)) {
          modelStats.set(model, {
            model,
            inputTokens: 0,
            outputTokens: 0,
            inputCost: 0,
            outputCost: 0,
            totalCost: 0,
          });
        }
        
        const stats = modelStats.get(model)!;
        stats.inputTokens += inputTokens;
        stats.outputTokens += outputTokens;
        stats.inputCost += cost.inputCost;
        stats.outputCost += cost.outputCost;
        stats.totalCost += cost.totalCost;
        
        totalTokens += tokens;
        totalCost += cost.totalCost;
      }
      
      return {
        userId,
        period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        totalTokens,
        totalCost,
        byModel: Array.from(modelStats.values()),
        averagePerMessage: messages?.length ? totalTokens / messages.length : 0,
        peakUsageDay: await this.getPeakUsageDay(userId, startDate, endDate),
      };
    } catch (error) {
      throw new Error(
        `Failed to get usage stats: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
  
  // Compare model efficiency
  async compareModels(
    userId: string,
    models: string[],
    options: AnalyzerOptions = {}
  ): Promise<ModelComparison> {
    try {
      const metrics = {
        avgTokensPerMessage: [] as number[],
        avgCostPerMessage: [] as number[],
        avgResponseTime: [] as number[],
        totalMessages: [] as number[],
      };
      
      for (const model of models) {
        const stats = await this.getUsageStats(userId, { ...options, model });
        const modelData = stats.byModel.find((m) => m.model === model);
        
        if (modelData) {
          const totalMessages = stats.totalTokens / stats.averagePerMessage || 1;
          metrics.avgTokensPerMessage.push(stats.averagePerMessage);
          metrics.avgCostPerMessage.push(modelData.totalCost / totalMessages);
          metrics.avgResponseTime.push(0); // TODO: Add response time tracking
          metrics.totalMessages.push(totalMessages);
        } else {
          metrics.avgTokensPerMessage.push(0);
          metrics.avgCostPerMessage.push(0);
          metrics.avgResponseTime.push(0);
          metrics.totalMessages.push(0);
        }
      }
      
      // Determine best model
      const bestIndex = metrics.avgCostPerMessage.indexOf(
        Math.min(...metrics.avgCostPerMessage.filter((c) => c > 0))
      );
      
      return {
        models,
        metrics,
        recommendation: `${models[bestIndex]} offers the best cost/performance ratio`,
      };
    } catch (error) {
      throw new Error(
        `Failed to compare models: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
  
  // Generate optimization tips
  async getOptimizationTips(
    userId: string,
    options: AnalyzerOptions = {}
  ): Promise<OptimizationReport> {
    try {
      const stats = await this.getUsageStats(userId, options);
      const tips: OptimizationTip[] = [];
      
      // Check if using expensive models unnecessarily
      const gpt4Usage = stats.byModel.find((m) => m.model === 'gpt-4');
      if (gpt4Usage && gpt4Usage.totalCost > 10) {
        const savings = gpt4Usage.totalCost * 0.7; // 70% savings with gpt-4o-mini
        tips.push({
          category: 'Model Selection',
          issue: 'Using GPT-4 for simple tasks',
          suggestion: 'Consider using gpt-4o-mini for straightforward conversations',
          potentialSavings: savings,
          priority: 'high',
        });
      }
      
      // Check for high token usage per message
      if (stats.averagePerMessage > tokenAnalyzerConfig.thresholds.tokensPerMessageWarning) {
        tips.push({
          category: 'Token Efficiency',
          issue: `High average tokens per message (${Math.round(stats.averagePerMessage)})`,
          suggestion: 'Reduce prompt length and use more concise system messages',
          potentialSavings: stats.totalCost * 0.3,
          priority: 'medium',
        });
      }
      
      // Check if hitting cost thresholds
      if (stats.totalCost > tokenAnalyzerConfig.thresholds.monthlyCostWarning) {
        tips.push({
          category: 'Cost Alert',
          issue: `Monthly costs exceeding $${stats.totalCost.toFixed(2)}`,
          suggestion: 'Review conversation patterns and consider implementing caching',
          potentialSavings: stats.totalCost * 0.2,
          priority: 'high',
        });
      }
      
      const potentialSavings = tips.reduce((sum, tip) => sum + tip.potentialSavings, 0);
      
      return {
        currentCost: stats.totalCost,
        potentialSavings,
        tips,
      };
    } catch (error) {
      throw new Error(
        `Failed to generate optimization tips: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
  
  // Helper: Estimate tokens from text
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
  
  // Helper: Get start date based on period
  private getStartDate(period: string, endDate: Date): Date {
    const start = new Date(endDate);
    
    switch (period) {
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'all':
        start.setFullYear(2020); // Far back
        break;
    }
    
    return start;
  }
  
  // Helper: Get peak usage day
  private async getPeakUsageDay(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    try {
      const supabase = await createClient();
      
      const { data } = await supabase
        .from('messages')
        .select(`
          created_at,
          conversation:conversations!inner(user_id)
        `)
        .eq('conversations.user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      
      if (!data || data.length === 0) {
        return 'No data';
      }
      
      // Group by day
      const dayCount = new Map<string, number>();
      data.forEach((message) => {
        const day = new Date(message.created_at).toISOString().split('T')[0];
        dayCount.set(day, (dayCount.get(day) || 0) + 1);
      });
      
      // Find max
      let maxDay = '';
      let maxCount = 0;
      dayCount.forEach((count, day) => {
        if (count > maxCount) {
          maxCount = count;
          maxDay = day;
        }
      });
      
      return maxDay || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }
}

export const tokenAnalyzerService = new TokenAnalyzerService();
```

---

## 🎯 TOOL DEFINITION

### index.ts

```typescript
import type { ToolDefinition } from '@/types/tool';
import { tokenAnalyzerService } from './token-analyzer.service';

export const tokenAnalyzerTool: ToolDefinition = {
  name: 'token_analyzer',
  description: 'Track token usage, costs, and optimization opportunities',
  category: 'analytics',
  
  operations: [
    {
      name: 'usage_stats',
      description: 'Get token usage statistics',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['day', 'week', 'month', 'all'],
            description: 'Time period to analyze',
          },
          conversationId: {
            type: 'string',
            description: 'Optional: Analyze specific conversation',
          },
        },
      },
    },
    {
      name: 'cost_analysis',
      description: 'Calculate costs by model and period',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['day', 'week', 'month', 'all'],
          },
          model: {
            type: 'string',
            description: 'Optional: Filter by specific model',
          },
        },
      },
    },
    {
      name: 'model_comparison',
      description: 'Compare token efficiency across models',
      parameters: {
        type: 'object',
        properties: {
          models: {
            type: 'array',
            items: { type: 'string' },
            description: 'Models to compare (e.g., ["gpt-4", "gpt-4o-mini"])',
          },
          period: {
            type: 'string',
            enum: ['day', 'week', 'month', 'all'],
          },
        },
        required: ['models'],
      },
    },
    {
      name: 'optimization_tips',
      description: 'Get cost-saving recommendations',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['day', 'week', 'month', 'all'],
          },
        },
      },
    },
  ],
  
  execute: async (operation, parameters, context) => {
    try {
      const userId = context.userId;
      
      if (!userId) {
        return {
          error: '[TokenAnalyzer] Authentication: User ID required',
        };
      }
      
      switch (operation) {
        case 'usage_stats': {
          const stats = await tokenAnalyzerService.getUsageStats(userId, parameters);
          return {
            success: true,
            data: stats,
          };
        }
        
        case 'cost_analysis': {
          const stats = await tokenAnalyzerService.getUsageStats(userId, parameters);
          return {
            success: true,
            data: {
              period: stats.period,
              totalCost: stats.totalCost,
              byModel: stats.byModel,
            },
          };
        }
        
        case 'model_comparison': {
          const comparison = await tokenAnalyzerService.compareModels(
            userId,
            parameters.models,
            parameters
          );
          return {
            success: true,
            data: comparison,
          };
        }
        
        case 'optimization_tips': {
          const report = await tokenAnalyzerService.getOptimizationTips(userId, parameters);
          return {
            success: true,
            data: report,
          };
        }
        
        default:
          return {
            error: `[TokenAnalyzer] Operation: Unknown operation "${operation}"`,
          };
      }
    } catch (error) {
      return {
        error: `[TokenAnalyzer] Execution: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  },
};
```

---

## 🧪 TESTING APPROACH

### test.ts

```typescript
import { tokenAnalyzerService } from './token-analyzer.service';

async function testTokenAnalyzer() {
  console.log('🧪 Testing Token Analyzer Tool...\n');
  
  const testUserId = 'test-user-123';
  
  // Test 1: Get usage stats
  console.log('Test 1: Get usage stats');
  try {
    const stats = await tokenAnalyzerService.getUsageStats(testUserId, {
      period: 'week',
    });
    console.log('✅ Usage stats:', JSON.stringify(stats, null, 2));
  } catch (error) {
    console.log('❌ Error:', error);
  }
  
  // Test 2: Model comparison
  console.log('\nTest 2: Model comparison');
  try {
    const comparison = await tokenAnalyzerService.compareModels(
      testUserId,
      ['gpt-4', 'gpt-4o-mini'],
      { period: 'week' }
    );
    console.log('✅ Comparison:', JSON.stringify(comparison, null, 2));
  } catch (error) {
    console.log('❌ Error:', error);
  }
  
  // Test 3: Optimization tips
  console.log('\nTest 3: Optimization tips');
  try {
    const tips = await tokenAnalyzerService.getOptimizationTips(testUserId, {
      period: 'month',
    });
    console.log('✅ Tips:', JSON.stringify(tips, null, 2));
  } catch (error) {
    console.log('❌ Error:', error);
  }
}

testTokenAnalyzer();
```

---

## 📋 IMPLEMENTATION CHECKLIST

- [ ] Create types.ts with all interfaces
- [ ] Create config.ts with pricing and thresholds
- [ ] Implement token-analyzer.service.ts
- [ ] Create index.ts tool definition
- [ ] Register tool in lib/tools/registry.ts
- [ ] Create test.ts and validate
- [ ] Update PROGRESS_LOG.md
- [ ] Create completion document

---

## 🎯 SUCCESS CRITERIA

- ✅ TypeScript compiles with zero errors
- ✅ Tool auto-registers successfully
- ✅ Usage stats calculation working
- ✅ Cost analysis accurate with current pricing
- ✅ Model comparison provides recommendations
- ✅ Optimization tips are actionable
- ✅ Error handling follows platform patterns

---

**Next Steps:** Begin implementation with types.ts
