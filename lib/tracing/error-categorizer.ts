/**
 * Error categorization for trace analytics and retry logic
 * Categorizes errors based on HTTP status codes and error messages
 */

export type ErrorCategory =
  | 'rate_limit'
  | 'timeout'
  | 'auth'
  | 'validation'
  | 'api_error'
  | 'network_error'
  | 'quota_exceeded'
  | 'model_overloaded'
  | 'unknown';

export interface CategorizedError {
  category: ErrorCategory;
  isRetryable: boolean;
  suggestedRetryDelayMs?: number;
}

/**
 * Extract HTTP status code from error message if present
 */
function extractStatusCode(errorMessage: string): number | undefined {
  const statusMatch = errorMessage.match(/status[:\s]+(\d{3})/i) ||
                     errorMessage.match(/\b(\d{3})\b/);
  return statusMatch ? parseInt(statusMatch[1], 10) : undefined;
}

/**
 * Categorize error based on HTTP status code and error message
 * Returns category and whether the error is retryable
 */
export function categorizeError(
  statusCode?: number,
  errorMessage?: string,
  errorType?: string
): CategorizedError {
  const msg = (errorMessage || '').toLowerCase();
  const code = statusCode || extractStatusCode(msg);

  // Rate limit errors (429)
  if (code === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return {
      category: 'rate_limit',
      isRetryable: true,
      suggestedRetryDelayMs: 60000,
    };
  }

  // Model overloaded (529)
  if (code === 529 || msg.includes('overloaded') || msg.includes('capacity')) {
    return {
      category: 'model_overloaded',
      isRetryable: true,
      suggestedRetryDelayMs: 30000,
    };
  }
  // Timeout errors (408)
  if (code === 408 || msg.includes('timeout') || msg.includes('timed out')) {
    return {
      category: 'timeout',
      isRetryable: true,
      suggestedRetryDelayMs: 5000,
    };
  }

  // Auth errors (401, 403)
  if (code === 401 || code === 403 || msg.includes('unauthorized') || msg.includes('forbidden')) {
    return {
      category: 'auth',
      isRetryable: false,
    };
  }

  // Validation errors (400)
  if (code === 400 || msg.includes('invalid') || msg.includes('bad request')) {
    return {
      category: 'validation',
      isRetryable: false,
    };
  }

  // Quota exceeded
  if (msg.includes('quota') || msg.includes('insufficient') || msg.includes('limit exceeded')) {
    return {
      category: 'quota_exceeded',
      isRetryable: false,
    };
  }

  // API errors (5xx)
  if (code && code >= 500 && code < 600) {
    return {
      category: 'api_error',
      isRetryable: true,
      suggestedRetryDelayMs: 10000,
    };
  }

  // Network errors
  if (msg.includes('network') || msg.includes('connection') || msg.includes('econnrefused')) {
    return {
      category: 'network_error',
      isRetryable: true,
      suggestedRetryDelayMs: 5000,
    };
  }

  // Unknown
  return {
    category: 'unknown',
    isRetryable: false,
  };
}
/**
 * Error pattern for analytics
 */
export interface ErrorPattern {
  category: ErrorCategory;
  count: number;
  percentage: number;
  avgDurationMs?: number;
  affectedProviders: string[];
  suggestedAction?: string;
}

/**
 * Analyze error patterns from traces
 * Returns insights for analytics dashboard
 */
export function detectErrorPatterns(traces: Array<{
  error_category?: string | null;
  error_message?: string | null;
  model_provider?: string | null;
  duration_ms?: number | null;
}>): ErrorPattern[] {
  const categoryCounts = new Map<ErrorCategory, {
    count: number;
    totalDuration: number;
    providers: Set<string>;
  }>();

  const failedTraces = traces.filter(t => t.error_category);
  if (failedTraces.length === 0) {
    return [];
  }

  // Count errors by category
  for (const trace of failedTraces) {
    const category = trace.error_category as ErrorCategory;
    if (!categoryCounts.has(category)) {
      categoryCounts.set(category, {
        count: 0,
        totalDuration: 0,
        providers: new Set(),
      });
    }

    const data = categoryCounts.get(category)!;
    data.count++;
    if (trace.duration_ms) {
      data.totalDuration += trace.duration_ms;
    }
    if (trace.model_provider) {
      data.providers.add(trace.model_provider);
    }
  }

  // Build error patterns
  const patterns: ErrorPattern[] = [];
  for (const [category, data] of Array.from(categoryCounts.entries())) {
    const percentage = (data.count / failedTraces.length) * 100;
    const avgDurationMs = data.count > 0 ? data.totalDuration / data.count : undefined;

    patterns.push({
      category,
      count: data.count,
      percentage,
      avgDurationMs,
      affectedProviders: Array.from(data.providers),
      suggestedAction: getSuggestedAction(category),
    });
  }

  return patterns.sort((a, b) => b.count - a.count);
}

/**
 * Get suggested action based on error category
 */
function getSuggestedAction(category: ErrorCategory): string | undefined {
  switch (category) {
    case 'rate_limit':
      return 'Implement exponential backoff or reduce request rate';
    case 'timeout':
      return 'Increase timeout values or optimize prompts';
    case 'auth':
      return 'Check API keys and authentication credentials';
    case 'validation':
      return 'Review input format and parameter validation';
    case 'api_error':
      return 'Monitor provider status and implement retry logic';
    case 'network_error':
      return 'Check network connectivity and DNS resolution';
    case 'quota_exceeded':
      return 'Upgrade plan or optimize token usage';
    case 'model_overloaded':
      return 'Retry with backoff or switch to alternative model';
    default:
      return undefined;
  }
}
