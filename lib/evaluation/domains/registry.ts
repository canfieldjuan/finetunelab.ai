// Domain Registry
// Date: October 14, 2025
// Purpose: Map domains to their schemas and validators
//
// This registry defines which validators run for each domain.
// Each domain has a schema (from Zod) and a set of validators.
//
// Example domains:
// - company_expert: Company knowledge base queries with citations
// - pc_expert: PC building recommendations with parts/power

import {
  mustCiteIfClaims,
  citationExists,
  policyScopeAllowed,
  freshnessOk,
  formatOk,
  type ValidatorResult
} from '../validators/rule-validators';
import type { JsonValue } from '@/lib/types';

interface ExecutorParams {
  content: string;
  contentJson: JsonValue;
  userId: string;
  retrievedDocs?: Array<{ text: string }>;
}

/**
 * Domain Configuration Interface
 * Defines schema and validators for a domain
 */
export interface DomainConfig {
  name: string;
  schema: 'company_expert' | 'pc_expert';
  validators: Array<{
    name: string;
    criterion: string;
    executor: (params: ExecutorParams) => Promise<ValidatorResult>;
    gate: number; // Pass threshold (0-100)
  }>;
}

// Type alias for validators expecting citations
type ContentJsonWithCitations = { citations?: { doc_id: string }[] };
// Type alias for validators expecting policy scope
type ContentJsonWithPolicyScope = { policy_scope?: string };

/**
 * Domain Registry
 * Maps domain names to their configuration
 */
export const domainRegistry: Record<string, DomainConfig> = {
  company_expert: {
    name: 'Company Expert',
    schema: 'company_expert',
    validators: [
      {
        name: 'must_cite_if_claims',
        criterion: 'citation_required',
        executor: async ({ content, contentJson }) =>
          mustCiteIfClaims(content, (contentJson as ContentJsonWithCitations) || { citations: [] }),
        gate: 100 // Must pass
      },
      {
        name: 'citation_exists',
        criterion: 'citation_valid',
        executor: async ({ contentJson, userId }) =>
          citationExists((contentJson as ContentJsonWithCitations) || { citations: [] }, userId),
        gate: 100 // Must pass
      },
      {
        name: 'policy_scope_allowed',
        criterion: 'authorization',
        executor: async ({ contentJson, userId }) =>
          policyScopeAllowed((contentJson as ContentJsonWithPolicyScope) || {}, userId),
        gate: 100 // Must pass
      },
      {
        name: 'freshness_ok',
        criterion: 'document_freshness',
        executor: async ({ contentJson }) =>
          freshnessOk((contentJson as ContentJsonWithCitations) || { citations: [] }, 365),
        gate: 90 // 90% threshold
      },
      {
        name: 'format_ok',
        criterion: 'format_compliance',
        executor: async ({ content, contentJson }) => formatOk(content, contentJson),
        gate: 100 // Must pass
      }
    ]
  },
  pc_expert: {
    name: 'PC Expert',
    schema: 'pc_expert',
    validators: [
      {
        name: 'format_ok',
        criterion: 'format_compliance',
        executor: async ({ content, contentJson }) => formatOk(content, contentJson),
        gate: 100 // Must pass
      }
    ]
  }
};

/**
 * Execute all validators for a domain
 *
 * @param domain - Domain name (company_expert, pc_expert)
 * @param params - Validator parameters (content, contentJson, userId, retrievedDocs)
 * @returns Array of validation results with validator name, criterion, and gate
 */
export async function executeDomainValidation(
  domain: string,
  params: ExecutorParams
): Promise<Array<{ validator: string; criterion: string; result: ValidatorResult; gate: number }>> {
  const config = domainRegistry[domain];
  if (!config) {
    throw new Error(`Unknown domain: ${domain}. Valid domains: ${Object.keys(domainRegistry).join(', ')}`);
  }

  const results = [];
  for (const validator of config.validators) {
    const result = await validator.executor(params);
    results.push({
      validator: validator.name,
      criterion: validator.criterion,
      result,
      gate: validator.gate
    });
  }

  return results;
}

/**
 * Get list of all registered domains
 */
export function getRegisteredDomains(): string[] {
  return Object.keys(domainRegistry);
}

/**
 * Get configuration for a domain
 */
export function getDomainConfig(domain: string): DomainConfig | null {
  return domainRegistry[domain] || null;
}

/**
 * Check if a domain is registered
 */
export function isDomainRegistered(domain: string): boolean {
  return domain in domainRegistry;
}

/**
 * Example usage:
 *
 * // Execute all validators for company_expert domain
 * const results = await executeDomainValidation('company_expert', {
 *   content: 'According to company policy...',
 *   contentJson: {
 *     answer: 'According to company policy...',
 *     citations: [{ doc_id: '123e4567-...' }],
 *     policy_scope: 'internal',
 *     confidentiality: 'medium'
 *   },
 *   userId: 'user-id-123',
 *   retrievedDocs: [{ text: 'Company policy states...' }]
 * });
 *
 * // Check results
 * results.forEach(({ validator, criterion, result, gate }) => {
 *   console.log(`${validator} (${criterion}): ${result.passed ? 'PASS' : 'FAIL'}`);
 *   console.log(`  Score: ${result.score}, Gate: ${gate}`);
 *   console.log(`  Message: ${result.message}`);
 *   if (!result.passed) {
 *     console.error(`  Evidence:`, result.evidence);
 *   }
 * });
 *
 * // Filter failed validators
 * const failed = results.filter(r => !r.result.passed);
 * if (failed.length > 0) {
 *   console.error(`${failed.length} validators failed:`, failed.map(f => f.validator));
 * }
 */
