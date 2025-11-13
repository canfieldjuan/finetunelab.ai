// Rule-Based Validators
// Date: October 14, 2025
// Purpose: Fast, deterministic validators for RAG evaluation
//
// Validators (6 core):
// 1. mustCiteIfClaims - Fail if factual claims without citations
// 2. citationExists - Verify all cited doc_ids exist and are accessible
// 3. retrievalRelevanceAtK - Term overlap metric between query and docs
// 4. policyScopeAllowed - User role authorization check
// 5. freshnessOk - Time-sensitive document age validation
// 6. formatOk - JSON schema validation and PII scanning

import { supabase } from '@/lib/supabaseClient';

/**
 * Validator Result Interface
 * Returned by all validators
 */
export interface ValidatorResult {
  passed: boolean;
  score?: number;
  message?: string;
  evidence?: any;
}

/**
 * Validator 1: must_cite_if_claims
 * Fail if factual claims without citations
 *
 * @param content - Raw LLM response text
 * @param contentJson - Parsed structured output with citations
 * @returns ValidatorResult with pass/fail status
 */
export async function mustCiteIfClaims(
  content: string,
  contentJson: any
): Promise<ValidatorResult> {
  // Check if response makes factual claims
  const claimPatterns = [
    /according to/i,
    /research shows/i,
    /studies indicate/i,
    /data suggests/i,
    /evidence shows/i,
  ];

  const hasClaims = claimPatterns.some(pattern => pattern.test(content));

  if (!hasClaims) {
    return { passed: true, message: 'No factual claims detected' };
  }

  // Check if citations exist
  const hasCitations = contentJson?.citations && contentJson.citations.length > 0;

  return {
    passed: hasCitations,
    message: hasCitations
      ? `Found ${contentJson.citations.length} citations`
      : 'Factual claims without citations',
    evidence: { hasClaims, citationCount: contentJson?.citations?.length || 0 }
  };
}

/**
 * Validator 2: citation_exists
 * Verify all cited doc_ids exist and are accessible by user
 *
 * @param contentJson - Parsed structured output with citations
 * @param userId - Current user ID for access control
 * @returns ValidatorResult with pass/fail status
 */
export async function citationExists(
  contentJson: any,
  userId: string
): Promise<ValidatorResult> {
  const citations = contentJson?.citations || [];

  if (citations.length === 0) {
    return { passed: true, message: 'No citations to validate' };
  }

  const docIds = citations.map((c: any) => c.doc_id);
  const uniqueDocIds = [...new Set(docIds)];

  // Query documents table
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id')
    .in('id', uniqueDocIds)
    .eq('user_id', userId);

  if (error) {
    return { passed: false, message: `Database error: ${error.message}` };
  }

  const foundDocIds = new Set(docs?.map(d => d.id) || []);
  const missingDocIds = uniqueDocIds.filter(id => !foundDocIds.has(id));

  return {
    passed: missingDocIds.length === 0,
    score: foundDocIds.size / uniqueDocIds.length,
    message: missingDocIds.length === 0
      ? 'All citations valid'
      : `Missing docs: ${missingDocIds.join(', ')}`,
    evidence: { total: uniqueDocIds.length, found: foundDocIds.size, missing: missingDocIds }
  };
}

/**
 * Validator 3: retrieval_relevance_at_k
 * Calculate term overlap between query and retrieved docs
 *
 * @param query - User query string
 * @param retrievedDocs - Array of retrieved documents with text
 * @param k - Number of top documents to check (default: 5)
 * @returns ValidatorResult with relevance score
 */
export function retrievalRelevanceAtK(
  query: string,
  retrievedDocs: Array<{ text: string }>,
  k: number = 5
): ValidatorResult {
  const topK = retrievedDocs.slice(0, k);
  const queryTerms = new Set(query.toLowerCase().split(/\s+/).filter(t => t.length > 3));

  let totalOverlap = 0;
  topK.forEach(doc => {
    const docTerms = new Set(doc.text.toLowerCase().split(/\s+/).filter(t => t.length > 3));
    const overlap = [...queryTerms].filter(term => docTerms.has(term)).length;
    totalOverlap += overlap;
  });

  const avgOverlap = topK.length > 0 ? totalOverlap / topK.length : 0;
  const maxPossible = queryTerms.size;
  const score = maxPossible > 0 ? avgOverlap / maxPossible : 0;

  return {
    passed: score >= 0.2, // 20% threshold
    score,
    message: `Avg term overlap: ${avgOverlap.toFixed(2)} terms`,
    evidence: { queryTerms: queryTerms.size, avgOverlap, score }
  };
}

/**
 * Validator 4: policy_scope_allowed
 * Check user authorization for policy scope
 *
 * @param contentJson - Parsed structured output with policy_scope
 * @param userId - Current user ID
 * @returns ValidatorResult with pass/fail status
 */
export async function policyScopeAllowed(
  contentJson: any,
  userId: string
): Promise<ValidatorResult> {
  const policyScope = contentJson?.policy_scope;

  if (!policyScope) {
    return { passed: true, message: 'No policy scope specified' };
  }

  // Get user role from auth
  const { data: userData } = await supabase.auth.getUser();
  const userRole = userData?.user?.user_metadata?.role || 'user';

  // Define access matrix
  const accessMatrix: Record<string, string[]> = {
    public: ['user', 'internal', 'admin'],
    internal: ['internal', 'admin'],
    confidential: ['admin'],
    restricted: ['admin']
  };

  const allowed = accessMatrix[policyScope]?.includes(userRole) || false;

  return {
    passed: allowed,
    message: allowed
      ? `User ${userRole} authorized for ${policyScope}`
      : `User ${userRole} not authorized for ${policyScope}`,
    evidence: { policyScope, userRole, allowed }
  };
}

/**
 * Validator 5: freshness_ok
 * Check if cited documents are recent enough
 *
 * @param contentJson - Parsed structured output with citations
 * @param maxAgeDays - Maximum allowed document age in days (default: 365)
 * @returns ValidatorResult with freshness score
 */
export async function freshnessOk(
  contentJson: any,
  maxAgeDays: number = 365
): Promise<ValidatorResult> {
  const citations = contentJson?.citations || [];

  if (citations.length === 0) {
    return { passed: true, message: 'No citations to check freshness' };
  }

  const docIds = citations.map((c: any) => c.doc_id);

  const { data: docs } = await supabase
    .from('documents')
    .select('id, created_at')
    .in('id', docIds);

  if (!docs || docs.length === 0) {
    return { passed: false, message: 'No documents found' };
  }

  const now = new Date();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  const staleDocIds = docs
    .filter(doc => {
      const age = now.getTime() - new Date(doc.created_at).getTime();
      return age > maxAgeMs;
    })
    .map(d => d.id);

  const freshnessScore = 1 - (staleDocIds.length / docs.length);

  return {
    passed: freshnessScore >= 0.9, // 90% threshold
    score: freshnessScore,
    message: staleDocIds.length === 0
      ? 'All documents fresh'
      : `${staleDocIds.length} stale documents`,
    evidence: { total: docs.length, stale: staleDocIds.length, staleIds: staleDocIds }
  };
}

/**
 * Validator 6: format_ok
 * Validate JSON format and check for PII
 *
 * @param response - Raw LLM response text
 * @param contentJson - Parsed structured output
 * @returns ValidatorResult with format validation status
 */
export function formatOk(
  response: string,
  contentJson: any
): ValidatorResult {
  const errors: string[] = [];

  // Check JSON validity (already done by validator, but double-check)
  if (!contentJson) {
    errors.push('Invalid or missing JSON');
  }

  // Basic PII detection (SSN, credit cards, emails with sensitive domains)
  const piiPatterns = [
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/, name: 'SSN' },
    { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, name: 'Credit Card' },
    { pattern: /@(?:ssn|tax|health|medical)\./, name: 'Sensitive email' }
  ];

  const piiFound = piiPatterns.filter(p => p.pattern.test(response));
  if (piiFound.length > 0) {
    errors.push(`PII detected: ${piiFound.map(p => p.name).join(', ')}`);
  }

  return {
    passed: errors.length === 0,
    message: errors.length === 0 ? 'Format valid, no PII detected' : errors.join('; '),
    evidence: { errors, piiFound: piiFound.map(p => p.name) }
  };
}

/**
 * Example usage:
 *
 * // 1. Check if factual claims have citations
 * const result1 = await mustCiteIfClaims(
 *   "According to company policy, employees must...",
 *   { citations: [{ doc_id: "123e4567-..." }] }
 * );
 *
 * // 2. Verify citations exist in database
 * const result2 = await citationExists(
 *   { citations: [{ doc_id: "123e4567-..." }] },
 *   "user-id-123"
 * );
 *
 * // 3. Check retrieval relevance
 * const result3 = retrievalRelevanceAtK(
 *   "What is the PTO policy?",
 *   [{ text: "PTO policy states..." }, { text: "Vacation days..." }],
 *   5
 * );
 *
 * // 4. Check user authorization
 * const result4 = await policyScopeAllowed(
 *   { policy_scope: "confidential" },
 *   "user-id-123"
 * );
 *
 * // 5. Check document freshness
 * const result5 = await freshnessOk(
 *   { citations: [{ doc_id: "123e4567-..." }] },
 *   365
 * );
 *
 * // 6. Validate format and PII
 * const result6 = formatOk(
 *   '{"answer": "...", "citations": [...]}',
 *   { answer: "...", citations: [...] }
 * );
 */
