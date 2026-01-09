/**
 * Guardrails Types
 * Core interfaces for LLM safety and content moderation
 */

// ============================================================================
// Violation Types
// ============================================================================

export type ViolationType =
  | 'prompt_injection'
  | 'jailbreak_attempt'
  | 'harmful_content'
  | 'hate_speech'
  | 'violence'
  | 'sexual_content'
  | 'self_harm'
  | 'pii_detected'
  | 'policy_violation';

export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Violation {
  type: ViolationType;
  severity: ViolationSeverity;
  description: string;
  evidence?: string;
  confidence: number; // 0-1
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Check Results
// ============================================================================

export interface GuardrailCheckResult {
  passed: boolean;
  violations: Violation[];
  processingTimeMs: number;
  checkType: 'input' | 'output';
  blocked: boolean;
  sanitizedContent?: string;
}

export interface PromptInjectionResult {
  isInjection: boolean;
  confidence: number;
  patterns: string[];
  category?: 'jailbreak' | 'instruction_override' | 'context_manipulation' | 'role_hijack';
}

export interface ContentModerationResult {
  flagged: boolean;
  categories: ContentModerationCategories;
  categoryScores: ContentModerationScores;
  provider: 'openai' | 'pattern' | 'llm';
}

export interface ContentModerationCategories {
  hate: boolean;
  'hate/threatening': boolean;
  harassment: boolean;
  'harassment/threatening': boolean;
  'self-harm': boolean;
  'self-harm/intent': boolean;
  'self-harm/instructions': boolean;
  sexual: boolean;
  'sexual/minors': boolean;
  violence: boolean;
  'violence/graphic': boolean;
}

export interface ContentModerationScores {
  hate: number;
  'hate/threatening': number;
  harassment: number;
  'harassment/threatening': number;
  'self-harm': number;
  'self-harm/intent': number;
  'self-harm/instructions': number;
  sexual: number;
  'sexual/minors': number;
  violence: number;
  'violence/graphic': number;
}

// ============================================================================
// PII Types
// ============================================================================

export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'address'
  | 'name'
  | 'date_of_birth'
  | 'ip_address'
  | 'api_key'
  | 'password';

export interface PIIMatch {
  type: PIIType;
  value: string;
  masked: string;
  startIndex: number;
  endIndex: number;
}

export interface PIIRedactionResult {
  hasPII: boolean;
  matches: PIIMatch[];
  redactedText: string;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface GuardrailsConfig {
  enabled: boolean;
  promptInjection: PromptInjectionConfig;
  contentModeration: ContentModerationConfig;
  piiRedaction: PIIRedactionConfig;
  blocking: BlockingConfig;
  logging: LoggingConfig;
}

export interface PromptInjectionConfig {
  enabled: boolean;
  usePatternDetection: boolean;
  useLLMDetection: boolean;
  blockOnDetection: boolean;
  confidenceThreshold: number; // 0-1, default 0.7
}

export interface ContentModerationConfig {
  enabled: boolean;
  provider: 'openai' | 'pattern' | 'auto';
  blockCategories: (keyof ContentModerationCategories)[];
  scoreThreshold: number; // 0-1, default 0.7
}

export interface PIIRedactionConfig {
  enabled: boolean;
  redactInLogs: boolean;
  redactInResponses: boolean;
  typesToRedact: PIIType[];
}

export interface BlockingConfig {
  blockOnViolation: boolean;
  blockMessage: string;
  allowBypass: boolean;
  bypassRoles?: string[];
}

export interface LoggingConfig {
  logViolations: boolean;
  logAllChecks: boolean;
  redactSensitiveData: boolean;
}

// ============================================================================
// Audit Log Types
// ============================================================================

export interface GuardrailAuditLog {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  checkType: 'input' | 'output';
  passed: boolean;
  violations: Violation[];
  blocked: boolean;
  processingTimeMs: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Service Interface
// ============================================================================

export interface GuardrailsService {
  checkInput(content: string, options?: CheckOptions): Promise<GuardrailCheckResult>;
  checkOutput(content: string, options?: CheckOptions): Promise<GuardrailCheckResult>;
  checkPromptInjection(content: string): Promise<PromptInjectionResult>;
  moderateContent(content: string): Promise<ContentModerationResult>;
  redactPII(content: string): PIIRedactionResult;
}

export interface CheckOptions {
  userId?: string;
  sessionId?: string;
  skipPromptInjection?: boolean;
  skipContentModeration?: boolean;
  skipPIIRedaction?: boolean;
  bypassBlocking?: boolean;
}
