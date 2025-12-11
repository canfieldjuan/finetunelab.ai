/**
 * Conversation Validator
 *
 * Validates and sanitizes conversation data before rendering to prevent UI freezes.
 * Created: October 29, 2025
 * Purpose: Prevent corrupted conversation data from causing React errors
 */

import { log } from '@/lib/utils/logger';

// Validation rules
export const VALIDATION_RULES = {
  maxMessages: 500,
  maxContentLength: 100_000, // 100KB per message
  maxToolsCalled: 50,
  maxMetadataSize: 50_000, // 50KB
  requiredFields: ['id', 'user_id', 'created_at'] as const,
  jsonFields: ['metadata', 'content_json', 'tools_called'] as const,
} as const;

export interface ConversationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedData?: unknown;
  healthScore: number; // 0-100
}

export interface ConversationData {
  id: string;
  user_id?: string;
  created_at?: string;
  widget_session_id?: string;
  title?: string;
  messages?: MessageData[];
  [key: string]: unknown;
}

export interface MessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: unknown;
  content_json?: unknown;
  tools_called?: unknown;
  [key: string]: unknown;
}

/**
 * Validate a single conversation and its messages
 */
export function validateConversation(
  conversation: ConversationData
): ConversationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let healthScore = 100;

  // Check required fields
  for (const field of VALIDATION_RULES.requiredFields) {
    if (!conversation[field]) {
      errors.push(`Missing required field: ${field}`);
      healthScore -= 20;
    }
  }

  // Validate message count
  const messageCount = conversation.messages?.length || 0;
  if (messageCount > VALIDATION_RULES.maxMessages) {
    warnings.push(
      `Message count (${messageCount}) exceeds limit (${VALIDATION_RULES.maxMessages})`
    );
    healthScore -= 20;
  } else if (messageCount > 100) {
    warnings.push(`Large message count: ${messageCount} messages`);
    healthScore -= 10;
  }

  // Validate messages
  const sanitizedMessages: MessageData[] = [];
  if (conversation.messages) {
    for (const message of conversation.messages) {
      const messageResult = validateMessage(message);

      if (!messageResult.isValid) {
        errors.push(
          `Message ${message.id}: ${messageResult.errors.join(', ')}`
        );
        healthScore -= 10;
        continue; // Skip invalid messages
      }

      if (messageResult.warnings.length > 0) {
        warnings.push(
          `Message ${message.id}: ${messageResult.warnings.join(', ')}`
        );
        healthScore -= 5;
      }

      sanitizedMessages.push(messageResult.sanitizedData as MessageData);
    }
  }

  // Calculate total size
  const totalSize = JSON.stringify(conversation).length;
  if (totalSize > 1_000_000) {
    // 1MB
    warnings.push(
      `Conversation size (${(totalSize / 1024).toFixed(0)}KB) is very large`
    );
    healthScore -= 20;
  }

  // Ensure health score is in valid range
  healthScore = Math.max(0, Math.min(100, healthScore));

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    sanitizedData: isValid
      ? {
          ...conversation,
          messages: sanitizedMessages,
        }
      : undefined,
    healthScore,
  };
}

/**
 * Validate a single message
 */
export function validateMessage(
  message: MessageData
): ConversationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let healthScore = 100;

  // Check required fields
  if (!message.id) {
    errors.push('Missing message ID');
    healthScore -= 30;
  }

  if (!message.role || !['user', 'assistant'].includes(message.role)) {
    errors.push(`Invalid role: ${message.role}`);
    healthScore -= 30;
  }

  if (!message.content) {
    warnings.push('Empty content');
    healthScore -= 10;
  }

  // Validate content length
  if (message.content && message.content.length > VALIDATION_RULES.maxContentLength) {
    warnings.push(
      `Content length (${message.content.length}) exceeds limit (${VALIDATION_RULES.maxContentLength})`
    );
    healthScore -= 20;
    // Truncate content
    message.content = message.content.substring(0, VALIDATION_RULES.maxContentLength) + '... [TRUNCATED]';
  }

  // Validate JSON fields
  const sanitizedMessage = { ...message };

  for (const field of VALIDATION_RULES.jsonFields) {
    if (message[field]) {
      const jsonResult = validateJSON(message[field], field);

      if (!jsonResult.isValid) {
        errors.push(`Invalid JSON in ${field}: ${jsonResult.errors.join(', ')}`);
        healthScore -= 20;
        // Remove invalid JSON field
        delete sanitizedMessage[field];
      } else if (jsonResult.sanitizedData) {
        sanitizedMessage[field] = jsonResult.sanitizedData;
      }

      if (jsonResult.warnings.length > 0) {
        warnings.push(`${field}: ${jsonResult.warnings.join(', ')}`);
        healthScore -= 5;
      }
    }
  }

  // Validate tools_called array size
  if (sanitizedMessage.tools_called && Array.isArray(sanitizedMessage.tools_called)) {
    if (sanitizedMessage.tools_called.length > VALIDATION_RULES.maxToolsCalled) {
      warnings.push(
        `tools_called array (${sanitizedMessage.tools_called.length}) exceeds limit (${VALIDATION_RULES.maxToolsCalled})`
      );
      healthScore -= 10;
      // Truncate array
      sanitizedMessage.tools_called = sanitizedMessage.tools_called.slice(0, VALIDATION_RULES.maxToolsCalled);
    }
  }

  // Ensure health score is in valid range
  healthScore = Math.max(0, Math.min(100, healthScore));

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    sanitizedData: sanitizedMessage,
    healthScore,
  };
}

/**
 * Validate JSON field (can be string or object)
 */
function validateJSON(
  value: unknown,
  _fieldName: string // eslint-disable-line @typescript-eslint/no-unused-vars
): ConversationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let healthScore = 100;
  let sanitizedData = value;

  try {
    // If it's a string, try to parse it
    if (typeof value === 'string') {
      if (value.trim() === '') {
        warnings.push('Empty JSON string');
        healthScore -= 5;
        sanitizedData = null;
        return { isValid: true, errors, warnings, sanitizedData, healthScore };
      }

      try {
        sanitizedData = JSON.parse(value);
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        errors.push(`Failed to parse JSON: ${message}`);
        healthScore = 0;
        return { isValid: false, errors, warnings, sanitizedData: null, healthScore };
      }
    }

    // Check for circular references
    try {
      JSON.stringify(sanitizedData);
    } catch (_circularError) { // eslint-disable-line @typescript-eslint/no-unused-vars
      errors.push('Circular reference detected in JSON');
      healthScore = 0;
      return { isValid: false, errors, warnings, sanitizedData: null, healthScore };
    }

    // Check size
    const size = JSON.stringify(sanitizedData).length;
    if (size > VALIDATION_RULES.maxMetadataSize) {
      warnings.push(`JSON size (${size}) exceeds limit (${VALIDATION_RULES.maxMetadataSize})`);
      healthScore -= 20;
    }

    return {
      isValid: true,
      errors,
      warnings,
      sanitizedData,
      healthScore,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Unexpected error validating JSON: ${message}`);
    return {
      isValid: false,
      errors,
      warnings,
      sanitizedData: null,
      healthScore: 0,
    };
  }
}

/**
 * Batch validate multiple conversations
 */
export function validateConversations(
  conversations: ConversationData[]
): {
  valid: ConversationData[];
  invalid: { conversation: ConversationData; result: ConversationValidationResult }[];
  summary: {
    totalCount: number;
    validCount: number;
    invalidCount: number;
    averageHealthScore: number;
  };
} {
  const valid: ConversationData[] = [];
  const invalid: { conversation: ConversationData; result: ConversationValidationResult }[] = [];
  let totalHealthScore = 0;

  for (const conversation of conversations) {
    const result = validateConversation(conversation);
    totalHealthScore += result.healthScore;

    if (result.isValid && result.sanitizedData) {
      valid.push(result.sanitizedData as ConversationData);
    } else {
      invalid.push({ conversation, result });
      log.warn('Validation', 'Invalid conversation detected', {
        conversationId: conversation.id,
        errors: result.errors,
        warnings: result.warnings,
        healthScore: result.healthScore,
      });
    }
  }

  const averageHealthScore =
    conversations.length > 0 ? totalHealthScore / conversations.length : 100;

  return {
    valid,
    invalid,
    summary: {
      totalCount: conversations.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      averageHealthScore,
    },
  };
}

/**
 * Calculate health score for a conversation without full validation
 * (faster check for UI indicators)
 */
export function calculateHealthScore(conversation: ConversationData): number {
  let score = 100;

  // Quick checks
  const messageCount = conversation.messages?.length || 0;
  if (messageCount > VALIDATION_RULES.maxMessages) {
    score -= 30;
  } else if (messageCount > 100) {
    score -= 10;
  }

  // Check for required fields
  for (const field of VALIDATION_RULES.requiredFields) {
    if (!conversation[field]) {
      score -= 20;
    }
  }

  // Estimate size
  try {
    const size = JSON.stringify(conversation).length;
    if (size > 1_000_000) {
      score -= 20;
    }
  } catch {
    score -= 30; // Likely has circular references
  }

  return Math.max(0, Math.min(100, score));
}

