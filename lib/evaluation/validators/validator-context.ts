/**
 * Validator Context
 * Date: 2025-12-03
 * Purpose: Provide comprehensive context to validators for evaluation
 *
 * This centralizes all data validators might need, making it easy to add
 * new context without changing validator signatures.
 */

/**
 * Context provided to all validators during execution
 */
export interface ValidatorContext {
  // Required: Always provided
  responseContent: string;           // Raw LLM response text
  contentJson: unknown;                  // Parsed JSON (if available)
  userId: string;                    // User ID for database queries
  messageId: string;                 // Message being evaluated

  // Optional: May be provided depending on use case
  benchmarkId?: string;              // Benchmark configuration ID
  userPrompt?: string;               // Original user question/prompt
  expectedAnswer?: string;           // Ground truth answer (if available)
  retrievedDocuments?: Array<{      // RAG documents (if applicable)
    doc_id: string;
    text: string;
    metadata?: unknown;
  }>;

  // Configuration: Validator-specific settings from benchmark
  validatorConfig?: Record<string, unknown>;  // e.g., { maxAgeDays: 365, k: 5 }
}

/**
 * Helper to extract validator config for a specific validator
 */
export function getValidatorConfig<T = unknown>(
  context: ValidatorContext,
  validatorId: string,
  defaultConfig?: T
): T {
  const config = context.validatorConfig?.[validatorId];
return config || defaultConfig ? { ...defaultConfig, ...config } : undefined;
}
