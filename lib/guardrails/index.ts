/**
 * Guardrails Module
 * LLM safety and content moderation
 */

// Main service
export { guardrailsService, GuardrailsService } from './guardrails.service';

// Individual components
export { promptInjectionDetector, PromptInjectionDetector } from './prompt-injection-detector';
export { contentModerator, ContentModerator } from './content-moderator';
export { piiRedactor, PIIRedactor } from './pii-redactor';

// Configuration
export { guardrailsConfig, validateGuardrailsConfig } from './config';

// Types
export type {
  // Core types
  ViolationType,
  ViolationSeverity,
  Violation,
  GuardrailCheckResult,
  CheckOptions,

  // Detection results
  PromptInjectionResult,
  ContentModerationResult,
  ContentModerationCategories,
  ContentModerationScores,

  // PII types
  PIIType,
  PIIMatch,
  PIIRedactionResult,

  // Configuration types
  GuardrailsConfig,
  PromptInjectionConfig,
  ContentModerationConfig,
  PIIRedactionConfig,
  BlockingConfig,
  LoggingConfig,

  // Audit types
  GuardrailAuditLog,

  // Service interface
  GuardrailsService as IGuardrailsService,
} from './types';
