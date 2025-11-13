// Error categorization utility for batch testing and evaluation
export type ErrorCategory =
  | 'timeout'
  | 'rate_limit'
  | 'invalid_response'
  | 'authentication'
  | 'network'
  | 'model_error'
  | 'validation_error'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export function categorizeError(error: Error | unknown): {
  category: ErrorCategory;
  severity: ErrorSeverity;
} {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes('timeout') || message.includes('timed out')) {
    return { category: 'timeout', severity: 'medium' };
  }
  if (message.includes('rate limit') || message.includes('429')) {
    return { category: 'rate_limit', severity: 'high' };
  }
  if (message.includes('invalid') || message.includes('malformed')) {
    return { category: 'invalid_response', severity: 'medium' };
  }
  if (message.includes('unauthorized') || message.includes('401')) {
    return { category: 'authentication', severity: 'critical' };
  }
  if (message.includes('network') || message.includes('econnrefused')) {
    return { category: 'network', severity: 'high' };
  }
  if (message.includes('model') || message.includes('not found')) {
    return { category: 'model_error', severity: 'high' };
  }

  return { category: 'unknown', severity: 'medium' };
}
