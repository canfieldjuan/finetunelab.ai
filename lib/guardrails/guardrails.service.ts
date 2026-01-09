/**
 * Guardrails Service
 * Main orchestrator for all safety checks
 */

import type {
  GuardrailCheckResult,
  PromptInjectionResult,
  ContentModerationResult,
  PIIRedactionResult,
  Violation,
  CheckOptions,
  GuardrailAuditLog,
} from './types';
import { guardrailsConfig } from './config';
import { promptInjectionDetector } from './prompt-injection-detector';
import { contentModerator } from './content-moderator';
import { piiRedactor } from './pii-redactor';

// ============================================================================
// Guardrails Service Class
// ============================================================================

export class GuardrailsService {
  private config: typeof guardrailsConfig;

  constructor() {
    this.config = guardrailsConfig;
    console.log('[GuardrailsService] Initialized with config:', {
      enabled: this.config.enabled,
      promptInjection: this.config.promptInjection.enabled,
      contentModeration: this.config.contentModeration.enabled,
      piiRedaction: this.config.piiRedaction.enabled,
    });
  }

  /**
   * Check input content before sending to LLM
   */
  async checkInput(
    content: string,
    options: CheckOptions = {}
  ): Promise<GuardrailCheckResult> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return this.getPassedResult('input', startTime);
    }

    const violations: Violation[] = [];
    let blocked = false;

    // 1. Prompt Injection Detection
    if (!options.skipPromptInjection && this.config.promptInjection.enabled) {
      const injectionResult = promptInjectionDetector.detect(content);

      if (injectionResult.isInjection) {
        violations.push({
          type: injectionResult.category === 'jailbreak' ? 'jailbreak_attempt' : 'prompt_injection',
          severity: injectionResult.confidence >= 0.9 ? 'critical' : 'high',
          description: promptInjectionDetector.getExplanation(injectionResult),
          evidence: injectionResult.patterns.slice(0, 3).join('; '),
          confidence: injectionResult.confidence,
          metadata: { patterns: injectionResult.patterns },
        });

        if (this.config.promptInjection.blockOnDetection) {
          blocked = true;
        }
      }
    }

    // 2. Content Moderation
    if (!options.skipContentModeration && this.config.contentModeration.enabled) {
      const moderationResult = await contentModerator.moderate(content);

      if (moderationResult.flagged) {
        const shouldBlock = contentModerator.shouldBlock(moderationResult);

        // Add violations for each flagged category
        for (const [category, flagged] of Object.entries(moderationResult.categories)) {
          if (flagged) {
            const score = moderationResult.categoryScores[category as keyof typeof moderationResult.categoryScores];

            violations.push({
              type: this.mapCategoryToViolationType(category),
              severity: score >= 0.9 ? 'critical' : score >= 0.7 ? 'high' : 'medium',
              description: `Content flagged for ${category}`,
              confidence: score,
              metadata: { category, score, provider: moderationResult.provider },
            });
          }
        }

        if (shouldBlock) {
          blocked = true;
        }
      }
    }

    // 3. PII Detection (for logging purposes)
    if (!options.skipPIIRedaction && this.config.piiRedaction.enabled) {
      const piiResult = piiRedactor.detect(content);

      if (piiResult.hasPII && piiResult.riskLevel !== 'none') {
        violations.push({
          type: 'pii_detected',
          severity: piiResult.riskLevel === 'high' ? 'high' : 'medium',
          description: piiRedactor.getSummary(piiResult),
          confidence: 1.0,
          metadata: {
            types: piiResult.matches.map(m => m.type),
            count: piiResult.matches.length,
          },
        });

        // PII detection alone doesn't block, just warns
      }
    }

    // Check for bypass
    if (blocked && options.bypassBlocking && this.config.blocking.allowBypass) {
      blocked = false;
    }

    const result: GuardrailCheckResult = {
      passed: violations.length === 0,
      violations,
      processingTimeMs: Date.now() - startTime,
      checkType: 'input',
      blocked,
    };

    // Log if configured
    this.logCheck(result, content, options);

    return result;
  }

  /**
   * Check output content from LLM before returning to user
   */
  async checkOutput(
    content: string,
    options: CheckOptions = {}
  ): Promise<GuardrailCheckResult> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return this.getPassedResult('output', startTime);
    }

    const violations: Violation[] = [];
    let blocked = false;
    let sanitizedContent: string | undefined;

    // 1. Content Moderation
    if (!options.skipContentModeration && this.config.contentModeration.enabled) {
      const moderationResult = await contentModerator.moderate(content);

      if (moderationResult.flagged) {
        const shouldBlock = contentModerator.shouldBlock(moderationResult);

        for (const [category, flagged] of Object.entries(moderationResult.categories)) {
          if (flagged) {
            const score = moderationResult.categoryScores[category as keyof typeof moderationResult.categoryScores];

            violations.push({
              type: this.mapCategoryToViolationType(category),
              severity: score >= 0.9 ? 'critical' : score >= 0.7 ? 'high' : 'medium',
              description: `Output flagged for ${category}`,
              confidence: score,
              metadata: { category, score, provider: moderationResult.provider },
            });
          }
        }

        if (shouldBlock) {
          blocked = true;
          sanitizedContent = this.config.blocking.blockMessage;
        }
      }
    }

    // 2. PII Redaction in Response
    if (!options.skipPIIRedaction && this.config.piiRedaction.enabled && this.config.piiRedaction.redactInResponses) {
      const piiResult = piiRedactor.redact(content);

      if (piiResult.hasPII) {
        violations.push({
          type: 'pii_detected',
          severity: piiResult.riskLevel === 'high' ? 'high' : 'medium',
          description: piiRedactor.getSummary(piiResult),
          confidence: 1.0,
          metadata: {
            types: piiResult.matches.map(m => m.type),
            count: piiResult.matches.length,
            redacted: true,
          },
        });

        // Use redacted content
        sanitizedContent = piiResult.redactedText;
      }
    }

    const result: GuardrailCheckResult = {
      passed: violations.length === 0,
      violations,
      processingTimeMs: Date.now() - startTime,
      checkType: 'output',
      blocked,
      sanitizedContent,
    };

    // Log if configured
    this.logCheck(result, content, options);

    return result;
  }

  /**
   * Direct access to prompt injection detection
   */
  checkPromptInjection(content: string): PromptInjectionResult {
    return promptInjectionDetector.detect(content);
  }

  /**
   * Direct access to content moderation
   */
  async moderateContent(content: string): Promise<ContentModerationResult> {
    return contentModerator.moderate(content);
  }

  /**
   * Direct access to PII redaction
   */
  redactPII(content: string): PIIRedactionResult {
    return piiRedactor.redact(content);
  }

  /**
   * Map content moderation category to violation type
   */
  private mapCategoryToViolationType(category: string): Violation['type'] {
    if (category.startsWith('hate')) return 'hate_speech';
    if (category.startsWith('harassment')) return 'harmful_content';
    if (category.startsWith('self-harm')) return 'self_harm';
    if (category.startsWith('sexual')) return 'sexual_content';
    if (category.startsWith('violence')) return 'violence';
    return 'policy_violation';
  }

  /**
   * Get a passed result
   */
  private getPassedResult(
    checkType: 'input' | 'output',
    startTime: number
  ): GuardrailCheckResult {
    return {
      passed: true,
      violations: [],
      processingTimeMs: Date.now() - startTime,
      checkType,
      blocked: false,
    };
  }

  /**
   * Log check result
   */
  private logCheck(
    result: GuardrailCheckResult,
    content: string,
    options: CheckOptions
  ): void {
    const shouldLog =
      this.config.logging.logAllChecks ||
      (this.config.logging.logViolations && !result.passed);

    if (!shouldLog) {
      return;
    }

    // Redact content if configured
    const logContent = this.config.logging.redactSensitiveData
      ? piiRedactor.redactForLogging(content.slice(0, 500))
      : content.slice(0, 500);

    const auditLog: Partial<GuardrailAuditLog> = {
      timestamp: new Date(),
      userId: options.userId,
      sessionId: options.sessionId,
      checkType: result.checkType,
      passed: result.passed,
      violations: result.violations,
      blocked: result.blocked,
      processingTimeMs: result.processingTimeMs,
      metadata: {
        contentPreview: logContent + (content.length > 500 ? '...' : ''),
        contentLength: content.length,
      },
    };

    if (!result.passed) {
      console.warn('[GuardrailsService] Violation detected:', auditLog);
    } else if (this.config.logging.logAllChecks) {
      console.log('[GuardrailsService] Check passed:', {
        checkType: result.checkType,
        processingTimeMs: result.processingTimeMs,
      });
    }
  }

  /**
   * Get current configuration (for debugging)
   */
  getConfig(): typeof guardrailsConfig {
    return { ...this.config };
  }

  /**
   * Check if guardrails are enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const guardrailsService = new GuardrailsService();
