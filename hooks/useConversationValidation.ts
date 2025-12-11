/**
 * Conversation Validation Hook
 *
 * React hook for validating conversations before rendering.
 * Created: October 29, 2025
 * Purpose: Prevent corrupted conversation data from causing UI freezes
 */

import { useState, useCallback, useEffect } from 'react';
import {
  validateConversation,
  validateConversations,
  calculateHealthScore,
  type ConversationData,
  type ConversationValidationResult,
} from '@/lib/validation/conversation-validator';
import { log } from '@/lib/utils/logger';

export interface UseConversationValidationOptions {
  /**
   * Auto-validate on mount
   * @default true
   */
  autoValidate?: boolean;

  /**
   * Callback when validation finds issues
   */
  onValidationError?: (
    conversation: ConversationData,
    result: ConversationValidationResult
  ) => void;

  /**
   * Callback when validation completes
   */
  onValidationComplete?: (summary: {
    totalCount: number;
    validCount: number;
    invalidCount: number;
    averageHealthScore: number;
  }) => void;

  /**
   * Minimum health score to consider valid (0-100)
   * @default 50
   */
  minHealthScore?: number;
}

export interface UseConversationValidationReturn {
  /**
   * Validate a single conversation
   */
  validateSingle: (conversation: ConversationData) => ConversationValidationResult;

  /**
   * Validate multiple conversations
   */
  validateMultiple: (conversations: ConversationData[]) => {
    valid: ConversationData[];
    invalid: { conversation: ConversationData; result: ConversationValidationResult }[];
    summary: {
      totalCount: number;
      validCount: number;
      invalidCount: number;
      averageHealthScore: number;
    };
  };

  /**
   * Calculate health score quickly (without full validation)
   */
  getHealthScore: (conversation: ConversationData) => number;

  /**
   * Check if a conversation is healthy enough to render
   */
  isHealthy: (conversation: ConversationData) => boolean;

  /**
   * Validation statistics
   */
  stats: {
    totalValidated: number;
    totalInvalid: number;
    averageHealthScore: number;
  };

  /**
   * Reset validation statistics
   */
  resetStats: () => void;
}

/**
 * Hook for validating conversation data before rendering
 */
export function useConversationValidation(
  options: UseConversationValidationOptions = {}
): UseConversationValidationReturn {
  const {
    onValidationError,
    onValidationComplete,
    minHealthScore = 50,
  } = options;

  const [stats, setStats] = useState({
    totalValidated: 0,
    totalInvalid: 0,
    averageHealthScore: 100,
  });

  /**
   * Validate a single conversation
   */
  const validateSingle = useCallback(
    (conversation: ConversationData): ConversationValidationResult => {
      log.debug('Validation', 'Validating conversation', {
        conversationId: conversation.id,
      });

      const result = validateConversation(conversation);

      // Update stats
      setStats((prev) => {
        const totalValidated = prev.totalValidated + 1;
        const totalInvalid = result.isValid ? prev.totalInvalid : prev.totalInvalid + 1;
        const averageHealthScore =
          (prev.averageHealthScore * prev.totalValidated + result.healthScore) /
          totalValidated;

        return {
          totalValidated,
          totalInvalid,
          averageHealthScore,
        };
      });

      // Call error callback if validation failed
      if (!result.isValid && onValidationError) {
        onValidationError(conversation, result);
      }

      // Log validation result
      if (!result.isValid) {
        log.error('Validation', 'Validation failed', {
          conversationId: conversation.id,
          errors: result.errors,
          warnings: result.warnings,
          healthScore: result.healthScore,
        });
      } else if (result.warnings.length > 0) {
        log.warn('Validation', 'Validation warnings', {
          conversationId: conversation.id,
          warnings: result.warnings,
          healthScore: result.healthScore,
        });
      }

      return result;
    },
    [onValidationError]
  );

  /**
   * Validate multiple conversations
   */
  const validateMultiple = useCallback(
    (conversations: ConversationData[]) => {
      log.debug('Validation', 'Validating multiple conversations', {
        count: conversations.length,
      });

      const result = validateConversations(conversations);

      // Update stats
      setStats((prev) => {
        const totalValidated = prev.totalValidated + result.summary.totalCount;
        const totalInvalid = prev.totalInvalid + result.summary.invalidCount;
        const averageHealthScore =
          (prev.averageHealthScore * prev.totalValidated +
            result.summary.averageHealthScore * result.summary.totalCount) /
          totalValidated;

        return {
          totalValidated,
          totalInvalid,
          averageHealthScore,
        };
      });

      // Call error callback for each invalid conversation
      if (onValidationError) {
        for (const { conversation, result: validationResult } of result.invalid) {
          onValidationError(conversation, validationResult);
        }
      }

      // Call completion callback
      if (onValidationComplete) {
        onValidationComplete(result.summary);
      }

      // Log summary
      log.info('Validation', 'Batch validation complete', {
        ...result.summary,
      });

      return result;
    },
    [onValidationError, onValidationComplete]
  );

  /**
   * Calculate health score quickly
   */
  const getHealthScore = useCallback((conversation: ConversationData): number => {
    return calculateHealthScore(conversation);
  }, []);

  /**
   * Check if a conversation is healthy enough to render
   */
  const isHealthy = useCallback(
    (conversation: ConversationData): boolean => {
      const healthScore = calculateHealthScore(conversation);
      return healthScore >= minHealthScore;
    },
    [minHealthScore]
  );

  /**
   * Reset validation statistics
   */
  const resetStats = useCallback(() => {
    setStats({
      totalValidated: 0,
      totalInvalid: 0,
      averageHealthScore: 100,
    });
    log.debug('Validation', 'Stats reset');
  }, []);

  return {
    validateSingle,
    validateMultiple,
    getHealthScore,
    isHealthy,
    stats,
    resetStats,
  };
}

/**
 * Hook for validating a single conversation with React state
 */
export function useValidatedConversation(conversation: ConversationData | null) {
  const [validationResult, setValidationResult] =
    useState<ConversationValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const { validateSingle } = useConversationValidation();

  useEffect(() => {
    if (!conversation) {
      setValidationResult(null);
      return;
    }

    setIsValidating(true);

    // Validate in next tick to avoid blocking render
    const timeoutId = setTimeout(() => {
      const result = validateSingle(conversation);
      setValidationResult(result);
      setIsValidating(false);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [conversation, validateSingle]);

  return {
    validationResult,
    isValidating,
    isValid: validationResult?.isValid ?? false,
    sanitizedData: validationResult?.sanitizedData,
    healthScore: validationResult?.healthScore ?? 0,
  };
}

