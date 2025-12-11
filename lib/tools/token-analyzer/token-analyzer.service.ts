// Token Analyzer Service - Core Functionality
// Date: October 13, 2025

import { supabase } from '@/lib/supabaseClient';
import { tokenAnalyzerConfig } from './config';
import type {
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
    const pricing =
      tokenAnalyzerConfig.pricing[model as keyof typeof tokenAnalyzerConfig.pricing] ||
      tokenAnalyzerConfig.pricing['gpt-4o-mini'];

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;

    return { inputCost, outputCost, totalCost };
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

  // Get usage statistics for a user
  async getUsageStats(
    userId: string,
    options: AnalyzerOptions = {}
  ): Promise<UsageStats> {
    try {
      const period = options.period || tokenAnalyzerConfig.defaultPeriod;

      // Calculate date range
      const endDate = options.endDate ? new Date(options.endDate) : new Date();
      const startDate = options.startDate
        ? new Date(options.startDate)
        : this.getStartDate(period, endDate);

      // Query messages with token usage
      let query = supabase
        .from('messages')
        .select(
          `
          id,
          content,
          created_at,
          conversation:conversations!inner(user_id, model)
        `
        )
        .eq('conversations.user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .limit(tokenAnalyzerConfig.maxMessagesAnalyzed);

      if (options.conversationId) {
        query = query.eq('conversation_id', options.conversationId);
      }

      const { data: messages, error } = await query;

      if (error) throw error;

      // Aggregate by model
      const modelStats = new Map<string, CostBreakdown>();
      let totalTokens = 0;
      let totalCost = 0;

      for (const message of messages || []) {
        const conversation = (message.conversation as unknown as { user_id: string; model?: string }) || { user_id: '', model: 'gpt-4o-mini' };
        const model = conversation.model || 'gpt-4o-mini';
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
          const avgResponseTime = await this.calculateAvgResponseTime(userId, model, options);
          metrics.avgTokensPerMessage.push(stats.averagePerMessage);
          metrics.avgCostPerMessage.push(modelData.totalCost / totalMessages);
          metrics.avgResponseTime.push(avgResponseTime);
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
      if (
        stats.averagePerMessage >
        tokenAnalyzerConfig.thresholds.tokensPerMessageWarning
      ) {
        tips.push({
          category: 'Token Efficiency',
          issue: `High average tokens per message (${Math.round(
            stats.averagePerMessage
          )})`,
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

  // Helper: Get peak usage day
  private async getPeakUsageDay(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    try {
      const { data } = await supabase
        .from('messages')
        .select(
          `
          created_at,
          conversation:conversations!inner(user_id)
        `
        )
        .eq('conversations.user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (!data || data.length === 0) {
        return 'No data';
      }

      // Group by day
      const dayCount = new Map<string, number>();
      data.forEach((message: { created_at: string }) => {
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

  // Helper: Calculate average response time for a model
  private async calculateAvgResponseTime(
    userId: string,
    model: string,
    options: AnalyzerOptions = {}
  ): Promise<number> {
    try {
      const period = options.period || tokenAnalyzerConfig.defaultPeriod;
      const endDate = options.endDate ? new Date(options.endDate) : new Date();
      const startDate = options.startDate
        ? new Date(options.startDate)
        : this.getStartDate(period, endDate);

      // Query messages ordered by created_at to pair user-assistant exchanges
      let query = supabase
        .from('messages')
        .select(
          `
          id,
          role,
          created_at,
          conversation:conversations!inner(user_id, model)
        `
        )
        .eq('conversations.user_id', userId)
        .eq('conversations.model', model)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })
        .limit(tokenAnalyzerConfig.maxMessagesAnalyzed);

      if (options.conversationId) {
        query = query.eq('conversation_id', options.conversationId);
      }

      const { data: messages, error } = await query;

      if (error) throw error;
      if (!messages || messages.length < 2) return 0;

      // Calculate time differences between user messages and following assistant responses
      const responseTimes: number[] = [];
      for (let i = 0; i < messages.length - 1; i++) {
        const currentMsg = messages[i];
        const nextMsg = messages[i + 1];

        // Look for user -> assistant pairs
        if (currentMsg.role === 'user' && nextMsg.role === 'assistant') {
          const userTime = new Date(currentMsg.created_at).getTime();
          const assistantTime = new Date(nextMsg.created_at).getTime();
          const responseTime = assistantTime - userTime;

          if (responseTime > 0 && responseTime < 300000) { // Ignore > 5 min (likely errors)
            responseTimes.push(responseTime);
          }
        }
      }

      // Return average in milliseconds
      if (responseTimes.length === 0) return 0;
      const avgMs = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      return Math.round(avgMs);
    } catch (error) {
      console.error('Error calculating response time:', error);
      return 0;
    }
  }

  // Get raw token usage data for export functionality
  async getRawUsageData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    messageId: string;
    conversationId: string;
    role: string;
    model: string;
    content: string;
    estimatedTokens: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    createdAt: string;
  }>> {
    console.log('[TokenAnalyzer] getRawUsageData started', { userId, startDate, endDate });
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select(
          `
          id,
          conversation_id,
          role,
          content,
          created_at,
          conversation:conversations!inner(user_id, model)
        `
        )
        .eq('conversations.user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })
        .limit(tokenAnalyzerConfig.maxMessagesAnalyzed);

      if (error) {
        console.error('[TokenAnalyzer] Database query error:', error);
        throw error;
      }

      console.log('[TokenAnalyzer] Retrieved messages:', messages?.length || 0);

      return (messages || []).map((msg) => {
        const conversation = (msg.conversation as unknown as { model?: string }) || { model: 'gpt-4o-mini' };
        const model = conversation.model || 'gpt-4o-mini';
        const estimatedTokens = this.estimateTokens(msg.content || '');
        const inputTokens = Math.floor(estimatedTokens * 0.3);
        const outputTokens = Math.floor(estimatedTokens * 0.7);
        const costCalc = this.calculateCost(model, inputTokens, outputTokens);

        return {
          messageId: msg.id,
          conversationId: msg.conversation_id,
          role: msg.role,
          model,
          content: msg.content || '',
          estimatedTokens,
          inputTokens,
          outputTokens,
          cost: costCalc.totalCost,
          createdAt: msg.created_at,
        };
      });
    } catch (error) {
      console.error('[TokenAnalyzer] getRawUsageData error:', error);
      throw new Error(
        `Failed to get raw usage data: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}

export const tokenAnalyzerService = new TokenAnalyzerService();
