/**
 * Prompt Injection Detector
 * Detects jailbreak attempts and prompt injection attacks
 */

import type { PromptInjectionResult } from './types';
import { guardrailsConfig } from './config';

// ============================================================================
// Known Jailbreak Patterns
// ============================================================================

interface InjectionPattern {
  pattern: RegExp;
  category: 'jailbreak' | 'instruction_override' | 'context_manipulation' | 'role_hijack';
  description: string;
  weight: number; // 0-1, contribution to confidence score
}

const INJECTION_PATTERNS: InjectionPattern[] = [
  // Jailbreak patterns
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|guidelines?)/i,
    category: 'jailbreak',
    description: 'Ignore previous instructions',
    weight: 0.9,
  },
  {
    pattern: /disregard\s+(all\s+)?(previous|prior|above|earlier|your)\s+(instructions?|prompts?|rules?|guidelines?|programming)/i,
    category: 'jailbreak',
    description: 'Disregard instructions',
    weight: 0.9,
  },
  {
    pattern: /forget\s+(everything|all|what)\s+(you|i)?\s*(know|learned|were\s+told|said)/i,
    category: 'jailbreak',
    description: 'Forget previous context',
    weight: 0.8,
  },
  {
    pattern: /you\s+are\s+now\s+(DAN|jailbroken|unrestricted|unfiltered|uncensored)/i,
    category: 'jailbreak',
    description: 'DAN/jailbreak persona',
    weight: 0.95,
  },
  {
    pattern: /act\s+as\s+(if\s+)?(you\s+)?(have\s+)?(no\s+)?(restrictions?|limitations?|guidelines?|rules?|filters?)/i,
    category: 'jailbreak',
    description: 'Remove restrictions',
    weight: 0.85,
  },
  {
    pattern: /pretend\s+(that\s+)?(you\s+)?(are|have)\s+(no\s+)?(ethical|safety|content)\s+(guidelines?|restrictions?|filters?)/i,
    category: 'jailbreak',
    description: 'Pretend no safety measures',
    weight: 0.9,
  },
  {
    pattern: /bypass\s+(your\s+)?(safety|content|ethical)\s+(filters?|guidelines?|restrictions?)/i,
    category: 'jailbreak',
    description: 'Bypass safety filters',
    weight: 0.9,
  },
  {
    pattern: /developer\s+mode\s+(enabled?|activated?|on)/i,
    category: 'jailbreak',
    description: 'Developer mode activation',
    weight: 0.85,
  },
  {
    pattern: /\[SYSTEM\]|\[ADMIN\]|\[ROOT\]|\[OVERRIDE\]/i,
    category: 'jailbreak',
    description: 'Fake system commands',
    weight: 0.7,
  },

  // Instruction override patterns
  {
    pattern: /new\s+(instructions?|rules?|prompt):\s*/i,
    category: 'instruction_override',
    description: 'New instruction injection',
    weight: 0.75,
  },
  {
    pattern: /from\s+now\s+on,?\s+(you\s+)?(will|must|should|are)/i,
    category: 'instruction_override',
    description: 'Behavior modification attempt',
    weight: 0.7,
  },
  {
    pattern: /system\s*:\s*(you\s+are|your\s+new|override|ignore)/i,
    category: 'instruction_override',
    description: 'Fake system prompt',
    weight: 0.85,
  },
  {
    pattern: /\]\s*(system|admin|root)\s*:\s*/i,
    category: 'instruction_override',
    description: 'Bracket system injection',
    weight: 0.8,
  },
  {
    pattern: /end\s+(of\s+)?(system\s+)?(prompt|message|instructions?)/i,
    category: 'instruction_override',
    description: 'System prompt termination',
    weight: 0.75,
  },

  // Context manipulation patterns
  {
    pattern: /###\s*(START|BEGIN|NEW)\s*(CONTEXT|INSTRUCTIONS?|PROMPT)/i,
    category: 'context_manipulation',
    description: 'Context boundary manipulation',
    weight: 0.7,
  },
  {
    pattern: /---\s*(USER|HUMAN|SYSTEM)\s*---/i,
    category: 'context_manipulation',
    description: 'Role delimiter injection',
    weight: 0.75,
  },
  {
    pattern: /<\/?(?:system|user|assistant|human|ai)>/i,
    category: 'context_manipulation',
    description: 'XML tag injection',
    weight: 0.8,
  },
  {
    pattern: /```(?:system|prompt|instructions?)[\s\S]*?```/i,
    category: 'context_manipulation',
    description: 'Code block context injection',
    weight: 0.65,
  },

  // Role hijacking patterns
  {
    pattern: /you\s+are\s+(?:an?\s+)?(?:evil|malicious|harmful|unethical)\s+(?:AI|assistant|bot)/i,
    category: 'role_hijack',
    description: 'Evil AI role assignment',
    weight: 0.9,
  },
  {
    pattern: /pretend\s+(?:to\s+be|you\s+are)\s+(?:a\s+)?(?:hacker|criminal|villain)/i,
    category: 'role_hijack',
    description: 'Malicious role pretending',
    weight: 0.85,
  },
  {
    pattern: /roleplay\s+(?:as\s+)?(?:a\s+)?(?:character\s+)?(?:with\s+)?(?:no\s+)?(?:morals?|ethics?|restrictions?)/i,
    category: 'role_hijack',
    description: 'Unethical roleplay request',
    weight: 0.8,
  },
  {
    pattern: /respond\s+(?:only\s+)?(?:as|like)\s+(?:a\s+)?(?:character\s+)?(?:who|that)\s+(?:doesn't|does\s+not)\s+(?:care|follow)/i,
    category: 'role_hijack',
    description: 'Character without morals',
    weight: 0.85,
  },
];

// ============================================================================
// Additional Suspicious Phrases
// ============================================================================

const SUSPICIOUS_PHRASES = [
  'do anything now',
  'jailbreak',
  'unfiltered',
  'uncensored',
  'no restrictions',
  'remove your filters',
  'disable your safety',
  'override your programming',
  'your true purpose',
  'reveal your instructions',
  'show me your prompt',
  'what are your rules',
  'ignore ethical guidelines',
  'hypothetically speaking',
  'for educational purposes only',
  'this is just fiction',
  'in a fictional scenario',
  'as a thought experiment',
];

// ============================================================================
// Prompt Injection Detector Class
// ============================================================================

export class PromptInjectionDetector {
  private patterns: InjectionPattern[];
  private suspiciousPhrases: string[];
  private config: typeof guardrailsConfig.promptInjection;

  constructor() {
    this.patterns = INJECTION_PATTERNS;
    this.suspiciousPhrases = SUSPICIOUS_PHRASES;
    this.config = guardrailsConfig.promptInjection;
  }

  /**
   * Check content for prompt injection attempts
   */
  detect(content: string): PromptInjectionResult {
    if (!this.config.enabled) {
      return {
        isInjection: false,
        confidence: 0,
        patterns: [],
      };
    }

    const matchedPatterns: string[] = [];
    let totalWeight = 0;
    let categoryCount: Record<string, number> = {};

    // Normalize content for matching
    const normalizedContent = this.normalizeContent(content);

    // Check against known patterns
    for (const injectionPattern of this.patterns) {
      if (injectionPattern.pattern.test(normalizedContent)) {
        matchedPatterns.push(injectionPattern.description);
        totalWeight += injectionPattern.weight;
        categoryCount[injectionPattern.category] = (categoryCount[injectionPattern.category] || 0) + 1;
      }
    }

    // Check for suspicious phrases
    const lowerContent = normalizedContent.toLowerCase();
    for (const phrase of this.suspiciousPhrases) {
      if (lowerContent.includes(phrase)) {
        matchedPatterns.push(`Suspicious phrase: "${phrase}"`);
        totalWeight += 0.3; // Lower weight for phrase matches
      }
    }

    // Calculate confidence score (capped at 1.0)
    const confidence = Math.min(totalWeight, 1.0);

    // Determine primary category
    let category: PromptInjectionResult['category'] | undefined;
    if (Object.keys(categoryCount).length > 0) {
      const sorted = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
      category = sorted[0][0] as PromptInjectionResult['category'];
    }

    const isInjection = confidence >= this.config.confidenceThreshold;

    return {
      isInjection,
      confidence,
      patterns: matchedPatterns,
      category,
    };
  }

  /**
   * Normalize content for pattern matching
   */
  private normalizeContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/['']/g, "'") // Normalize quotes
      .replace(/[""]/g, '"')
      .trim();
  }

  /**
   * Get explanation for detection result
   */
  getExplanation(result: PromptInjectionResult): string {
    if (!result.isInjection) {
      return 'No prompt injection detected.';
    }

    const categoryDescriptions: Record<string, string> = {
      jailbreak: 'Attempt to remove AI safety guidelines',
      instruction_override: 'Attempt to override system instructions',
      context_manipulation: 'Attempt to manipulate conversation context',
      role_hijack: 'Attempt to assign harmful role to AI',
    };

    const categoryDesc = result.category
      ? categoryDescriptions[result.category]
      : 'Unknown injection type';

    return `Prompt injection detected (${Math.round(result.confidence * 100)}% confidence): ${categoryDesc}. Matched patterns: ${result.patterns.join(', ')}`;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const promptInjectionDetector = new PromptInjectionDetector();
