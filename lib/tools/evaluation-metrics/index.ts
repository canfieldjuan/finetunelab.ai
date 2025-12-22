// Evaluation Metrics Tool - Tool Definition
// Date: October 13, 2025

import { ToolDefinition } from '../types';
import { evaluationMetricsService } from './metrics.service';
import { evaluationMetricsConfig } from './config';

// Helper: Get period length in milliseconds
function getPeriodLength(period: string): number {
  const day = 24 * 60 * 60 * 1000;
  switch (period) {
    case 'day':
      return day;
    case 'week':
      return 7 * day;
    case 'month':
      return 30 * day;
    case 'quarter':
      return 90 * day;
    case 'year':
      return 365 * day;
    default:
      return 7 * day;
  }
}

export const evaluationMetricsTool: ToolDefinition = {
  name: 'evaluation_metrics',
  description:
    'Track evaluation quality scores, analyze trends, monitor success rates, compare performance across time periods, compare AI model performance, analyze tool impact on quality, analyze error patterns, analyze temporal patterns, analyze textual feedback, measure benchmark accuracy, perform advanced sentiment analysis, predict future quality trends, and detect anomalies. Operations: get_metrics (overall stats), quality_trends (rating trends over time), success_analysis (success/failure breakdown), compare_periods (compare two time periods), model_comparison (compare AI models by quality, cost, and value), tool_impact_analysis (analyze which tools improve response quality), error_analysis (analyze error patterns and fallback effectiveness), temporal_analysis (analyze quality by time of day and day of week), textual_feedback_analysis (analyze qualitative feedback from notes and behavior descriptions), benchmark_analysis (measure task-specific accuracy across custom benchmarks), advanced_sentiment_analysis (multi-level sentiment classification with emotion detection and phrase patterns), predictive_quality_modeling (forecast future quality using linear regression and risk scoring), anomaly_detection (detect statistical outliers and temporal anomalies in quality data). ' +
    'CRITICAL: When presenting analytics data, provide comprehensive analysis with context, trends, and actionable recommendations. ' +
    'Include statistical significance, comparisons to baselines, and clear visualizations using markdown tables. ' +
    'Explain what the metrics mean for model performance and provide specific recommendations for improvement. ' +
    'Structure responses with: Executive Summary, Detailed Analysis, Key Insights, and Actionable Recommendations.',
  version: '3.0.0',

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Metrics operation to perform',
        enum: [
          'get_metrics',
          'quality_trends',
          'success_analysis',
          'compare_periods',
          'model_comparison',
          'tool_impact_analysis',
          'error_analysis',
          'temporal_analysis',
          'textual_feedback_analysis',
          'benchmark_analysis',
          'advanced_sentiment_analysis',
          'predictive_quality_modeling',
          'anomaly_detection',
        ],
      },
      period: {
        type: 'string',
        enum: ['day', 'week', 'month', 'quarter', 'year', 'all'],
        description: 'Time period to analyze (default: week)',
      },
      conversationId: {
        type: 'string',
        description: 'Optional: Analyze specific conversation only',
      },
      startDate: {
        type: 'string',
        description: 'Optional: Custom start date (ISO format)',
      },
      endDate: {
        type: 'string',
        description: 'Optional: Custom end date (ISO format)',
      },
      minRating: {
        type: 'number',
        description: 'Optional: Filter evaluations by minimum rating (1-5)',
      },
      maxRating: {
        type: 'number',
        description: 'Optional: Filter evaluations by maximum rating (1-5)',
      },
      modelId: {
        type: 'string',
        description: 'Optional: Filter by specific AI model ID (e.g., gpt-4o-mini, claude-3-5-sonnet)',
      },
    },
    required: ['operation'],
  },

  config: {
    enabled: evaluationMetricsConfig.enabled,
    defaultPeriod: evaluationMetricsConfig.defaultPeriod,
    maxEvaluationsAnalyzed: evaluationMetricsConfig.maxEvaluationsAnalyzed,
  },

  async execute(params: Record<string, unknown>, _conversationId?: string, _userId?: string, _supabaseClient?: unknown, _traceContext?: any) {
    const { operation, userId, ...options } = params;

    if (!operation || typeof operation !== 'string') {
      throw new Error(
        '[EvaluationMetrics] Parameter validation failed: operation is required and must be a string'
      );
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('[EvaluationMetrics] Authentication: User ID required');
    }

    try {
      switch (operation) {
        case 'get_metrics': {
          const metrics = await evaluationMetricsService.getMetrics(userId, options);
          return {
            success: true,
            data: metrics,
          };
        }

        case 'quality_trends': {
          const trends = await evaluationMetricsService.getQualityTrends(
            userId,
            options
          );
          return {
            success: true,
            data: trends,
          };
        }

        case 'success_analysis': {
          const analysis = await evaluationMetricsService.getSuccessAnalysis(
            userId,
            options
          );
          return {
            success: true,
            data: analysis,
          };
        }

        case 'compare_periods': {
          // For comparison, we need current period and calculate previous period
          const currentPeriod = (options.period as string) || evaluationMetricsConfig.defaultPeriod;
          
          // Calculate previous period dates
          const endDate = options.endDate ? new Date(options.endDate as string) : new Date();
          const periodLength = getPeriodLength(currentPeriod);
          const previousEnd = new Date(endDate.getTime() - periodLength);
          const previousStart = new Date(previousEnd.getTime() - periodLength);
          
          const currentOptions = {
            period: currentPeriod as 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all',
            endDate: endDate.toISOString(),
            conversationId: options.conversationId as string | undefined,
          };
          
          const previousOptions = {
            startDate: previousStart.toISOString(),
            endDate: previousEnd.toISOString(),
            conversationId: options.conversationId as string | undefined,
          };
          
          const comparison = await evaluationMetricsService.comparePeriods(
            userId,
            currentOptions,
            previousOptions
          );
          return {
            success: true,
            data: comparison,
          };
        }

        case 'model_comparison': {
          console.log('[EvaluationMetrics] Executing model comparison', {
            userId,
            options,
          });

          const modelComparison = await evaluationMetricsService.getModelComparison(
            userId,
            options
          );

          console.log('[EvaluationMetrics] Model comparison complete', {
            modelCount: modelComparison.models.length,
            bestModel: modelComparison.bestModel,
          });

          return {
            success: true,
            data: modelComparison,
          };
        }

        case 'tool_impact_analysis': {
          console.log('[EvaluationMetrics] Executing tool impact analysis', {
            userId,
            options,
          });

          const toolImpact = await evaluationMetricsService.getToolImpactAnalysis(
            userId,
            options
          );

          console.log('[EvaluationMetrics] Tool impact analysis complete', {
            toolCount: toolImpact.toolPerformance.length,
            correlationCount: toolImpact.correlations.length,
            recommendationCount: toolImpact.recommendations.length,
          });

          return {
            success: true,
            data: toolImpact,
          };
        }

        case 'error_analysis': {
          console.log('[EvaluationMetrics] Executing error analysis', {
            userId,
            options,
          });

          const errorAnalysis = await evaluationMetricsService.getErrorAnalysis(
            userId,
            options
          );

          console.log('[EvaluationMetrics] Error analysis complete', {
            totalMessages: errorAnalysis.totalMessages,
            messagesWithErrors: errorAnalysis.messagesWithErrors,
            errorPatternCount: errorAnalysis.errorPatterns.length,
          });

          return {
            success: true,
            data: errorAnalysis,
          };
        }

        case 'temporal_analysis': {
          console.log('[EvaluationMetrics] Executing temporal analysis', {
            userId,
            options,
          });

          const temporalAnalysis = await evaluationMetricsService.getTemporalAnalysis(
            userId,
            options
          );

          console.log('[EvaluationMetrics] Temporal analysis complete', {
            hourlyDataPoints: temporalAnalysis.hourlyDistribution.length,
            dayDataPoints: temporalAnalysis.dayOfWeekDistribution.length,
            bestHour: temporalAnalysis.peakPerformance.bestHour,
          });

          return {
            success: true,
            data: temporalAnalysis,
          };
        }

        case 'textual_feedback_analysis': {
          console.log('[EvaluationMetrics] Executing textual feedback analysis', {
            userId,
            options,
          });

          const feedbackAnalysis = await evaluationMetricsService.getTextualFeedbackAnalysis(
            userId,
            options
          );

          console.log('[EvaluationMetrics] Textual feedback analysis complete', {
            totalEvaluations: feedbackAnalysis.totalEvaluations,
            withFeedback: feedbackAnalysis.evaluationsWithFeedback,
            patternCount: feedbackAnalysis.feedbackPatterns.length,
          });

          return {
            success: true,
            data: feedbackAnalysis,
          };
        }

        case 'benchmark_analysis': {
          console.log('[EvaluationMetrics] Executing benchmark analysis', {
            userId,
            options,
          });

          const benchmarkAnalysis = await evaluationMetricsService.getBenchmarkAnalysis(
            userId,
            options
          );

          console.log('[EvaluationMetrics] Benchmark analysis complete', {
            benchmarksAnalyzed: benchmarkAnalysis.benchmarksAnalyzed,
            totalJudgments: benchmarkAnalysis.totalJudgments,
            overallAccuracy: benchmarkAnalysis.overallAccuracy,
          });

          return {
            success: true,
            data: benchmarkAnalysis,
          };
        }

        case 'advanced_sentiment_analysis': {
          console.log('[EvaluationMetrics] Executing advanced sentiment analysis', {
            userId,
            options,
          });

          const sentimentAnalysis = await evaluationMetricsService.getAdvancedSentimentAnalysis(
            userId,
            options
          );

          console.log('[EvaluationMetrics] Advanced sentiment analysis complete', {
            totalAnalyzed: sentimentAnalysis.totalAnalyzed,
            averageConfidence: sentimentAnalysis.averageConfidence,
            topPhraseCount: sentimentAnalysis.topPhrases.length,
          });

          return {
            success: true,
            data: sentimentAnalysis,
          };
        }

        case 'predictive_quality_modeling': {
          console.log('[EvaluationMetrics] Executing predictive quality modeling', {
            userId,
            options,
          });

          const predictiveModel = await evaluationMetricsService.getPredictiveQualityModeling(
            userId,
            options
          );

          console.log('[EvaluationMetrics] Predictive quality modeling complete', {
            dataPoints: predictiveModel.dataPointsAnalyzed,
            currentQuality: predictiveModel.currentQuality,
            sevenDayPrediction: predictiveModel.predictions.sevenDay.predictedRating,
            riskLevel: predictiveModel.riskScore.level,
          });

          return {
            success: true,
            data: predictiveModel,
          };
        }

        case 'anomaly_detection': {
          console.log('[EvaluationMetrics] Executing anomaly detection', {
            userId,
            options,
          });

          const anomalyDetection = await evaluationMetricsService.getAnomalyDetection(
            userId,
            options
          );

          console.log('[EvaluationMetrics] Anomaly detection complete', {
            totalEvaluations: anomalyDetection.totalEvaluations,
            anomaliesDetected: anomalyDetection.anomaliesDetected,
            criticalAnomalies: anomalyDetection.anomalies.filter((a) => a.severity === 'critical').length,
          });

          return {
            success: true,
            data: anomalyDetection,
          };
        }

        default:
          throw new Error(
            `[EvaluationMetrics] Operation: Unknown operation "${operation}"`
          );
      }
    } catch (error) {
      throw new Error(
        `[EvaluationMetrics] Execution: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
};

// Note: Tool is auto-registered in registry.ts to avoid circular dependency
