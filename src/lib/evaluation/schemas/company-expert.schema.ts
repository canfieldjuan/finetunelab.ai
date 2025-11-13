// Company Expert Domain - Zod Schema
// Date: October 14, 2025
// Purpose: Validate structured JSON output from LLM for company-expert domain
//
// This schema enforces that LLM responses include:
// - answer: The main response text
// - citations: Array of document references
// - policy_scope: Access control level
// - confidentiality: Data sensitivity level

import { z } from 'zod';

/**
 * Citation Schema
 * Links parts of the answer to specific documents
 */
export const CitationSchema = z.object({
  doc_id: z.string().uuid('Document ID must be a valid UUID'),
  span_start: z.number().int().nonnegative().optional(),
  span_end: z.number().int().nonnegative().optional(),
  quote: z.string().optional(),
});

/**
 * Company Expert Output Schema
 * Enforces structured output for company knowledge base queries
 */
export const CompanyExpertSchema = z.object({
  answer: z.string().min(1, 'Answer is required and cannot be empty'),

  citations: z.array(CitationSchema).default([]),

  policy_scope: z.enum(['public', 'internal', 'confidential', 'restricted']),

  confidentiality: z.enum(['low', 'medium', 'high', 'critical']),

  reasoning: z.string().optional(),
});

/**
 * Type inference from schema
 */
export type CompanyExpertOutput = z.infer<typeof CompanyExpertSchema>;
export type Citation = z.infer<typeof CitationSchema>;

/**
 * Validation helper
 * Returns { success: true, data } or { success: false, error }
 */
export function validateCompanyExpertOutput(data: unknown) {
  return CompanyExpertSchema.safeParse(data);
}

/**
 * Example usage:
 *
 * const llmOutput = {
 *   answer: "Company policy states...",
 *   citations: [
 *     { doc_id: "123e4567-e89b-12d3-a456-426614174000", quote: "..." }
 *   ],
 *   policy_scope: "internal",
 *   confidentiality: "medium"
 * };
 *
 * const result = validateCompanyExpertOutput(llmOutput);
 * if (result.success) {
 *   console.log("Valid output:", result.data);
 * } else {
 *   console.error("Validation errors:", result.error.errors);
 * }
 */
