/**
 * Centralized Validator Registry
 * Date: December 3, 2025
 * Purpose: Single source of truth for validator metadata across UI and execution
 */

export interface ValidatorMetadata {
  id: string;
  name: string;
  description: string;
  category: 'accuracy' | 'formatting' | 'policy' | 'freshness' | 'relevance';
  requiresContext?: boolean;
  configurable?: boolean;
}

export const VALIDATOR_REGISTRY: Record<string, ValidatorMetadata> = {
  'must_cite_if_claims': {
    id: 'must_cite_if_claims',
    name: 'Must Cite If Claims',
    description: 'Ensures responses cite sources when making factual claims',
    category: 'accuracy',
    requiresContext: true,
  },
  'format_ok': {
    id: 'format_ok',
    name: 'Format OK',
    description: 'Validates response follows expected format (JSON, Markdown, etc.)',
    category: 'formatting',
    requiresContext: false,
  },
  'citation_exists': {
    id: 'citation_exists',
    name: 'Citation Exists',
    description: 'Verifies all cited document IDs exist in the knowledge base',
    category: 'accuracy',
    requiresContext: true,
  },
  'retrieval_relevance_at_k': {
    id: 'retrieval_relevance_at_k',
    name: 'Retrieval Relevance@K',
    description: 'Measures term overlap between query and retrieved documents',
    category: 'relevance',
    requiresContext: true,
    configurable: true,
  },
  'policy_scope_allowed': {
    id: 'policy_scope_allowed',
    name: 'Policy Scope Allowed',
    description: 'Checks user authorization for requested policy domain',
    category: 'policy',
    requiresContext: true,
    configurable: true,
  },
  'freshness_ok': {
    id: 'freshness_ok',
    name: 'Freshness OK',
    description: 'Validates document timestamps are within acceptable age limits',
    category: 'freshness',
    requiresContext: true,
    configurable: true,
  },
};

/**
 * Get list of all available validator IDs
 */
export function getAvailableValidatorIds(): string[] {
  return Object.keys(VALIDATOR_REGISTRY);
}

/**
 * Get validator metadata by ID
 */
export function getValidatorMetadata(validatorId: string): ValidatorMetadata | undefined {
  return VALIDATOR_REGISTRY[validatorId];
}

/**
 * Check if validator ID is valid
 */
export function isValidValidatorId(validatorId: string): boolean {
  return validatorId in VALIDATOR_REGISTRY;
}

/**
 * Get validators by category
 */
export function getValidatorsByCategory(category: ValidatorMetadata['category']): ValidatorMetadata[] {
  return Object.values(VALIDATOR_REGISTRY).filter(v => v.category === category);
}
