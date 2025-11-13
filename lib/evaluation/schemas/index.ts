// Evaluation Schemas - Index
// Date: October 14, 2025
// Purpose: Central export for all domain-specific Zod schemas

import {
  CompanyExpertSchema,
  CitationSchema,
  validateCompanyExpertOutput,
  type CompanyExpertOutput,
  type Citation,
} from './company-expert.schema';

import {
  PCExpertSchema,
  PCPartSchema,
  PowerCalculationSchema,
  validatePCExpertOutput,
  type PCExpertOutput,
  type PCPart,
  type PowerCalculation,
} from './pc-expert.schema';

// Re-export everything
export {
  CompanyExpertSchema,
  CitationSchema,
  validateCompanyExpertOutput,
  type CompanyExpertOutput,
  type Citation,
};

export {
  PCExpertSchema,
  PCPartSchema,
  PowerCalculationSchema,
  validatePCExpertOutput,
  type PCExpertOutput,
  type PCPart,
  type PowerCalculation,
};

/**
 * Domain type for registry
 */
export type DomainType = 'company_expert' | 'pc_expert';

/**
 * Map domain names to their schemas
 */
export const DomainSchemas = {
  company_expert: CompanyExpertSchema,
  pc_expert: PCExpertSchema,
} as const;
