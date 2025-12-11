// Analytics Insights Service - Aggregates insights from analytics tools
// Phase 12: Analytics Tools Integration
// Date: October 13, 2025

import { executeTool } from '../tools/toolExecutor';

export interface InsightData {
  id: string;
  category: 'Cost' | 'Quality' | 'Patterns';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  learnMoreUrl?: string;
  priority: number;
}

/**
 * Generate all analytics insights for a user
 */
export async function generateInsights(
  userId: string,
  timeRange: string
): Promise<InsightData[]> {
  const insights: InsightData[] = [];
  let insightIdCounter = 1;

  // 1. Get Token Analyzer insights (cost optimization)
  try {
    console.log('[InsightsService] Calling token_analyzer with:', { userId, timeRange });
    const tokenResult = await executeTool(
      'token_analyzer',
      'optimization_tips',
      { period: timeRange },
      userId
    );

    console.log('[InsightsService] Token analyzer result:', {
      success: tokenResult.success,
      hasData: !!tokenResult.data,
      error: tokenResult.error,
      dataKeys: tokenResult.data ? Object.keys(tokenResult.data) : []
    });

    if (tokenResult.success && tokenResult.data) {
      const data = tokenResult.data as {
        data?: { tips?: Array<{ category: string; suggestion: string; potentialSavings?: number; priority: string }> };
      };

      console.log('[InsightsService] Token analyzer tips:', {
        hasTips: !!data.data?.tips,
        tipsCount: data.data?.tips?.length || 0
      });

      if (data.data?.tips) {
        data.data.tips.slice(0, 3).forEach((tip) => {
          insights.push({
            id: `insight-${insightIdCounter++}`,
            category: 'Cost',
            severity: tip.priority === 'high' ? 'warning' : 'info',
            title: tip.category,
            message: tip.suggestion + (tip.potentialSavings ? ` - Save ~$${tip.potentialSavings.toFixed(2)}/month` : ''),
            priority: tip.priority === 'high' ? 1 : 2,
          });
        });
      }
    } else if (!tokenResult.success) {
      console.warn('[InsightsService] Token analyzer failed:', tokenResult.error);
    }
  } catch (error) {
    console.error('[InsightsService] Error getting token analyzer insights:', error);
  }

  // 2. Get Evaluation Metrics insights (quality trends)
  try {
    console.log('[InsightsService] Calling evaluation_metrics with:', { userId, timeRange });
    const metricsResult = await executeTool(
      'evaluation_metrics',
      'success_analysis',
      { period: timeRange },
      userId
    );

    console.log('[InsightsService] Evaluation metrics result:', {
      success: metricsResult.success,
      hasData: !!metricsResult.data,
      error: metricsResult.error,
      dataKeys: metricsResult.data ? Object.keys(metricsResult.data) : []
    });

    if (metricsResult.success && metricsResult.data) {
      const data = metricsResult.data as {
        data?: {
          insights?: Array<{ type: string; message: string; severity: string }>;
          successRate?: number;
        };
      };

      console.log('[InsightsService] Evaluation metrics details:', {
        hasInsights: !!data.data?.insights,
        insightsCount: data.data?.insights?.length || 0,
        successRate: data.data?.successRate
      });

      if (data.data?.insights) {
        data.data.insights.slice(0, 3).forEach((insight) => {
          insights.push({
            id: `insight-${insightIdCounter++}`,
            category: 'Quality',
            severity: insight.severity as 'info' | 'warning' | 'critical',
            title: insight.type,
            message: insight.message,
            priority: insight.severity === 'critical' ? 1 : insight.severity === 'warning' ? 2 : 3,
          });
        });
      } else if (data.data?.successRate !== undefined) {
        // Generate insight from success rate if no specific insights
        const rate = data.data.successRate;
        console.log('[InsightsService] Generating insight from success rate:', rate);
        if (rate < 0.7) {
          insights.push({
            id: `insight-${insightIdCounter++}`,
            category: 'Quality',
            severity: 'warning',
            title: 'Low Success Rate',
            message: `Current success rate is ${(rate * 100).toFixed(1)}%. Review recent responses for quality issues.`,
            priority: 1,
          });
        } else if (rate > 0.9) {
          insights.push({
            id: `insight-${insightIdCounter++}`,
            category: 'Quality',
            severity: 'info',
            title: 'Excellent Performance',
            message: `Success rate is ${(rate * 100).toFixed(1)}%. Keep up the good work!`,
            priority: 3,
          });
        }
      }
    } else if (!metricsResult.success) {
      console.warn('[InsightsService] Evaluation metrics failed:', metricsResult.error);
    }
  } catch (error) {
    console.error('[InsightsService] Error getting evaluation metrics insights:', error);
  }

  // 3. Get Prompt Tester insights (pattern library)
  try {
    console.log('[InsightsService] Calling prompt_tester with:', { userId });
    const promptResult = await executeTool(
      'prompt_tester',
      'search_patterns',
      { query: 'high performing patterns' },
      userId
    );

    console.log('[InsightsService] Prompt tester result:', {
      success: promptResult.success,
      hasData: !!promptResult.data,
      error: promptResult.error,
      dataKeys: promptResult.data ? Object.keys(promptResult.data) : []
    });

    if (promptResult.success && promptResult.data) {
      const data = promptResult.data as {
        data?: Array<{ name: string; success_rate?: number; use_case?: string }>;
      };

      console.log('[InsightsService] Prompt tester patterns:', {
        hasPatterns: !!data.data,
        isArray: Array.isArray(data.data),
        patternsCount: Array.isArray(data.data) ? data.data.length : 0
      });

      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const patternCount = data.data.length;
        const avgSuccessRate = data.data.reduce((sum, p) => sum + (p.success_rate || 0), 0) / patternCount;

        insights.push({
          id: `insight-${insightIdCounter++}`,
          category: 'Patterns',
          severity: 'info',
          title: 'Prompt Pattern Library',
          message: `${patternCount} reusable prompt pattern${patternCount > 1 ? 's' : ''} available with ${(avgSuccessRate * 100).toFixed(0)}% avg success rate.`,
          priority: 2,
        });
      }
    } else if (!promptResult.success) {
      console.warn('[InsightsService] Prompt tester failed:', promptResult.error);
    }
  } catch (error) {
    console.error('[InsightsService] Error getting prompt tester insights:', error);
  }

  // Sort by priority (1 = highest)
  insights.sort((a, b) => a.priority - b.priority);

  console.log('[InsightsService] Final insights generated:', {
    totalCount: insights.length,
    categories: insights.map(i => i.category)
  });

  // If no insights generated, add a default message
  if (insights.length === 0) {
    console.warn('[InsightsService] No insights generated from any tool - returning insufficient data message');
    insights.push({
      id: 'insight-default',
      category: 'Quality',
      severity: 'info',
      title: 'Insufficient Data',
      message: 'Not enough data to generate insights. Continue using the platform to see recommendations.',
      priority: 3,
    });
  }

  return insights;
}
