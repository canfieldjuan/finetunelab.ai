// Structured Output Validator
// Date: October 14, 2025
// Purpose: Extract and validate JSON output from LLM responses
//
// Handles:
// - JSON extraction from markdown code blocks
// - JSON extraction from plain text
// - Schema validation using Zod
// - Detailed error reporting

import { DomainSchemas, type DomainType } from '../schemas';
import type { ZodIssue } from 'zod';

/**
 * Validation Result
 */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors?: string[];
  rawJson?: string;
}

/**
 * Structured Output Validator
 * Extracts JSON from LLM responses and validates against domain schemas
 */
export class StructuredOutputValidator {
  /**
   * Extract JSON from LLM response
   * Handles markdown code blocks and plain JSON
   */
  private extractJSON(response: string): string | null {
    // Try markdown code block first (```json ... ```)
    const markdownMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (markdownMatch) {
      return markdownMatch[1].trim();
    }

    // Try generic code block (``` ... ```)
    const codeBlockMatch = response.match(/```\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      const content = codeBlockMatch[1].trim();
      // Check if it looks like JSON
      if (content.startsWith('{') || content.startsWith('[')) {
        return content;
      }
    }

    // Try to find JSON object in text ({...})
    const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      return jsonObjectMatch[0];
    }

    // Try to find JSON array in text ([...])
    const jsonArrayMatch = response.match(/\[[\s\S]*\]/);
    if (jsonArrayMatch) {
      return jsonArrayMatch[0];
    }

    return null;
  }

  /**
   * Validate LLM response against domain schema
   * @param response - Raw LLM response text
   * @param domain - Domain type (company_expert, pc_expert)
   * @returns Validation result with parsed data or errors
   */
  validate<T = unknown>(
    response: string,
    domain: DomainType
  ): ValidationResult<T> {
    // Get schema for domain
    const schema = DomainSchemas[domain];
    if (!schema) {
      return {
        valid: false,
        errors: [`Unknown domain: ${domain}. Valid domains: ${Object.keys(DomainSchemas).join(', ')}`],
      };
    }

    // Extract JSON from response
    const jsonStr = this.extractJSON(response);
    if (!jsonStr) {
      return {
        valid: false,
        errors: ['No JSON found in response. Expected JSON in markdown code block or plain text.'],
      };
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (error) {
      return {
        valid: false,
        errors: [
          'Invalid JSON syntax',
          error instanceof Error ? error.message : 'Unknown parse error',
        ],
        rawJson: jsonStr,
      };
    }

    // Validate against schema
    const result = schema.safeParse(parsed);

    if (result.success) {
      return {
        valid: true,
        data: result.data as T,
        rawJson: jsonStr,
      };
    } else {
      // Format Zod errors
      const errors = result.error.issues.map((err: ZodIssue) => {
        const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
        return `${path}${err.message}`;
      });

      return {
        valid: false,
        errors,
        rawJson: jsonStr,
      };
    }
  }

  /**
   * Validate and throw on error
   * Useful when you want exceptions instead of error objects
   */
  validateOrThrow<T = unknown>(response: string, domain: DomainType): T {
    const result = this.validate<T>(response, domain);
    if (!result.valid) {
      throw new Error(
        `Validation failed for domain ${domain}:\n${result.errors?.join('\n')}`
      );
    }
    return result.data!;
  }

  /**
   * Check if response contains valid JSON
   * Quick check without full validation
   */
  hasValidJSON(response: string): boolean {
    const jsonStr = this.extractJSON(response);
    if (!jsonStr) return false;

    try {
      JSON.parse(jsonStr);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get list of supported domains
   */
  getSupportedDomains(): DomainType[] {
    return Object.keys(DomainSchemas) as DomainType[];
  }
}

/**
 * Singleton instance for convenience
 */
export const structuredOutputValidator = new StructuredOutputValidator();

/**
 * Convenience function for quick validation
 */
export function validateStructuredOutput<T = unknown>(
  response: string,
  domain: DomainType
): ValidationResult<T> {
  return structuredOutputValidator.validate<T>(response, domain);
}

/**
 * Example usage:
 *
 * // Validate company expert response
 * const llmResponse = `
 * Here's the answer:
 * \`\`\`json
 * {
 *   "answer": "Company policy states...",
 *   "citations": [
 *     { "doc_id": "123e4567-e89b-12d3-a456-426614174000" }
 *   ],
 *   "policy_scope": "internal",
 *   "confidentiality": "medium"
 * }
 * \`\`\`
 * `;
 *
 * const result = validateStructuredOutput(llmResponse, 'company_expert');
 * if (result.valid) {
 *   console.log('Valid output:', result.data);
 *   // Type-safe access:
 *   console.log('Answer:', result.data.answer);
 *   console.log('Citations:', result.data.citations);
 * } else {
 *   console.error('Validation errors:', result.errors);
 * }
 */
