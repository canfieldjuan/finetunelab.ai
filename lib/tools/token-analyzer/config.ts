// Token Analyzer Tool - Configuration
// Date: October 13, 2025

export const tokenAnalyzerConfig = {
  enabled: true,

  // Model pricing (per 1M tokens) - Updated October 2025
  pricing: {
    'gpt-4': {
      input: 30.0, // $30 per 1M input tokens
      output: 60.0, // $60 per 1M output tokens
    },
    'gpt-4-turbo': {
      input: 10.0,
      output: 30.0,
    },
    'gpt-4o': {
      input: 5.0,
      output: 15.0,
    },
    'gpt-4o-mini': {
      input: 0.15,
      output: 0.6,
    },
    'gpt-3.5-turbo': {
      input: 0.5,
      output: 1.5,
    },
  },

  // Alert thresholds
  thresholds: {
    dailyCostWarning: 10.0, // $10/day
    monthlyCostWarning: 200.0, // $200/month
    tokensPerMessageWarning: 4000, // Warn if avg > 4k tokens
  },

  // Analysis settings
  defaultPeriod: 'week' as const,
  maxMessagesAnalyzed: 10000,
};
