/**
 * Validation Utilities for Unified Export System
 * Phase 2: Data Loaders
 */

import type {
  DataSelector,
  ConversationDataSelector,
  AnalyticsDataSelector,
  TraceDataSelector,
  ValidationResult,
} from '../interfaces';
import { unifiedExportConfig } from '../config';

/**
 * Validate conversation data selector
 */
export function validateConversationSelector(
  selector: ConversationDataSelector
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate conversation IDs
  if (!selector.conversationIds || selector.conversationIds.length === 0) {
    errors.push('At least one conversation ID is required');
  }

  if (selector.conversationIds && selector.conversationIds.length > unifiedExportConfig.maxConversationsPerExport) {
    errors.push(
      `Too many conversations: ${selector.conversationIds.length}. Maximum: ${unifiedExportConfig.maxConversationsPerExport}`
    );
  }

  // Validate date range
  if (selector.dateRange) {
    const { start, end } = selector.dateRange;

    if (!(start instanceof Date) || !(end instanceof Date)) {
      errors.push('Date range start and end must be Date objects');
    } else {
      if (start > end) {
        errors.push('Date range start must be before end');
      }

      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        warnings.push(`Date range is very large: ${daysDiff} days. Export may be slow.`);
      }
    }
  }

  // Validate widget session filter
  if (selector.widgetSessionFilter) {
    const validFilters = ['all', 'widget', 'normal'];
    if (!validFilters.includes(selector.widgetSessionFilter)) {
      errors.push(`Invalid widget session filter: ${selector.widgetSessionFilter}`);
    }
  }

  // Validate message limit
  if (selector.messageLimit !== undefined) {
    if (selector.messageLimit < 1) {
      errors.push('Message limit must be at least 1');
    }
    if (selector.messageLimit > unifiedExportConfig.maxMessagesPerConversation) {
      warnings.push(
        `Message limit (${selector.messageLimit}) exceeds recommended maximum (${unifiedExportConfig.maxMessagesPerConversation})`
      );
    }
  }

  return {
    valid: errors.length === 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate analytics data selector
 */
export function validateAnalyticsSelector(
  selector: AnalyticsDataSelector
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate time range
  if (!selector.timeRange) {
    errors.push('Time range is required for analytics exports');
  } else {
    const { start, end } = selector.timeRange;

    if (!(start instanceof Date) || !(end instanceof Date)) {
      errors.push('Time range start and end must be Date objects');
    } else {
      if (start > end) {
        errors.push('Time range start must be before end');
      }

      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 90) {
        warnings.push(`Time range is very large: ${daysDiff} days. Export may contain many data points.`);
      }
    }
  }

  // Validate metrics
  if (!selector.metrics || selector.metrics.length === 0) {
    errors.push('At least one metric is required');
  }

  // Validate export subtype
  if (selector.exportSubType) {
    const validSubTypes = [
      'overview',
      'timeseries',
      'complete',
      'model_comparison',
      'tool_usage',
      'quality_trends',
    ];
    if (!validSubTypes.includes(selector.exportSubType)) {
      errors.push(`Invalid export subtype: ${selector.exportSubType}`);
    }
  }

  // Validate filters
  if (selector.filters) {
    const filters = selector.filters;

    // Validate status
    if (filters.status && !['all', 'success', 'failure'].includes(filters.status)) {
      errors.push(`Invalid status filter: ${filters.status}`);
    }

    // Validate minRating
    if (filters.minRating !== undefined) {
      if (filters.minRating < 1 || filters.minRating > 5) {
        errors.push('Min rating must be between 1 and 5');
      }
    }
  }

  return {
    valid: errors.length === 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate trace data selector
 */
export function validateTraceSelector(
  selector: TraceDataSelector
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate time range
  if (!selector.timeRange) {
    errors.push('Time range is required for trace exports');
  } else {
    const { start, end } = selector.timeRange;

    if (!(start instanceof Date) || !(end instanceof Date)) {
      errors.push('Time range start and end must be Date objects');
    } else {
      if (start > end) {
        errors.push('Time range start must be before end');
      }

      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 30) {
        warnings.push(`Time range is very large: ${daysDiff} days. Export may contain many traces.`);
      }
    }
  }

  // Validate trace IDs if provided
  if (selector.traceIds && selector.traceIds.length > unifiedExportConfig.maxTracesPerExport) {
    errors.push(
      `Too many trace IDs: ${selector.traceIds.length}. Maximum: ${unifiedExportConfig.maxTracesPerExport}`
    );
  }

  // Validate filters
  if (selector.filters) {
    const filters = selector.filters;

    // Validate status
    if (filters.status && !['all', 'success', 'failure'].includes(filters.status)) {
      errors.push(`Invalid status filter: ${filters.status}`);
    }

    // Validate duration range
    if (filters.minDuration !== undefined && filters.minDuration < 0) {
      errors.push('Min duration must be non-negative');
    }

    if (filters.maxDuration !== undefined && filters.maxDuration < 0) {
      errors.push('Max duration must be non-negative');
    }

    if (
      filters.minDuration !== undefined &&
      filters.maxDuration !== undefined &&
      filters.minDuration > filters.maxDuration
    ) {
      errors.push('Min duration must be less than max duration');
    }
  }

  return {
    valid: errors.length === 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate data selector based on type
 */
export function validateDataSelector(selector: DataSelector): ValidationResult {
  switch (selector.type) {
    case 'conversation':
      return validateConversationSelector(selector as ConversationDataSelector);
    case 'analytics':
      return validateAnalyticsSelector(selector as AnalyticsDataSelector);
    case 'trace':
      return validateTraceSelector(selector as TraceDataSelector);
    case 'custom':
      // Custom selectors have minimal validation
      return { valid: true };
    default:
      return {
        valid: false,
        error: `Unknown selector type: ${(selector as { type: string }).type}`,
      };
  }
}

/**
 * Validate user ID
 */
export function validateUserId(userId: string): ValidationResult {
  if (!userId || userId.trim() === '') {
    return {
      valid: false,
      error: 'User ID is required',
    };
  }

  // Basic UUID format validation (Supabase user IDs are UUIDs)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(userId)) {
    return {
      valid: false,
      error: 'Invalid user ID format (expected UUID)',
    };
  }

  return { valid: true };
}

/**
 * Estimate data size based on selector
 * Returns estimated size in bytes
 */
export function estimateDataSize(selector: DataSelector): number {
  switch (selector.type) {
    case 'conversation': {
      const convSelector = selector as ConversationDataSelector;
      const avgMessagesPerConv = 50;
      const avgBytesPerMessage = 500;
      const estimatedMessages = convSelector.conversationIds.length * avgMessagesPerConv;
      return estimatedMessages * avgBytesPerMessage;
    }

    case 'analytics': {
      const analyticsSelector = selector as AnalyticsDataSelector;
      const { start, end } = analyticsSelector.timeRange;
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const avgDataPointsPerDay = 100;
      const avgBytesPerDataPoint = 200;
      return daysDiff * avgDataPointsPerDay * avgBytesPerDataPoint;
    }

    case 'trace': {
      const traceSelector = selector as TraceDataSelector;
      if (traceSelector.traceIds) {
        // Specific traces
        const avgBytesPerTrace = 1000;
        return traceSelector.traceIds.length * avgBytesPerTrace;
      } else {
        // Time range
        const { start, end } = traceSelector.timeRange;
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const avgTracesPerDay = 1000;
        const avgBytesPerTrace = 1000;
        return daysDiff * avgTracesPerDay * avgBytesPerTrace;
      }
    }

    case 'custom':
      // Unknown size for custom exports
      return 1024 * 1024; // 1MB default estimate

    default:
      return 0;
  }
}
