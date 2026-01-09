/**
 * PII Redactor
 * Detects and masks personally identifiable information
 * Patterns adapted from lib/tools/intelligent_email/security.service.ts
 */

import type { PIIType, PIIMatch, PIIRedactionResult } from './types';
import { guardrailsConfig } from './config';

// ============================================================================
// PII Detection Patterns
// ============================================================================

interface PIIPattern {
  type: PIIType;
  pattern: RegExp;
  maskFn: (value: string) => string;
}

const PII_PATTERNS: PIIPattern[] = [
  // Email addresses
  {
    type: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    maskFn: (value: string) => {
      const [user, domain] = value.split('@');
      if (!domain) return '***@***.***';
      const maskedUser = user.length > 2
        ? user[0] + '*'.repeat(user.length - 2) + user[user.length - 1]
        : '*'.repeat(user.length);
      return `${maskedUser}@${domain}`;
    },
  },

  // Phone numbers (US format)
  {
    type: 'phone',
    pattern: /(\+1\s?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/g,
    maskFn: (value: string) => {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 4) return '*'.repeat(value.length);
      return '***-***-' + digits.slice(-4);
    },
  },

  // Social Security Numbers
  {
    type: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    maskFn: () => '***-**-****',
  },

  // Credit card numbers
  {
    type: 'credit_card',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    maskFn: (value: string) => {
      const digits = value.replace(/\D/g, '');
      return '**** **** **** ' + digits.slice(-4);
    },
  },

  // IP addresses
  {
    type: 'ip_address',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    maskFn: (value: string) => {
      const parts = value.split('.');
      return `${parts[0]}.***.***.*${parts[3]?.slice(-1) || '*'}`;
    },
  },

  // API keys (common formats)
  {
    type: 'api_key',
    pattern: /\b(sk-[a-zA-Z0-9]{32,}|api[_-]?key[_-]?[a-zA-Z0-9]{16,}|[a-zA-Z0-9]{32}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4})\b/gi,
    maskFn: (value: string) => {
      if (value.length <= 8) return '*'.repeat(value.length);
      return value.slice(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4);
    },
  },

  // Bearer tokens
  {
    type: 'api_key',
    pattern: /Bearer\s+[a-zA-Z0-9._-]{20,}/gi,
    maskFn: () => 'Bearer ****...**',
  },

  // Password patterns in logs/config
  {
    type: 'password',
    pattern: /(?:password|passwd|pwd|secret)[\s:=]+["']?([^"'\s]{4,})["']?/gi,
    maskFn: (value: string) => {
      const match = value.match(/^([\w]+[\s:=]+["']?)/);
      const prefix = match ? match[1] : '';
      return prefix + '********';
    },
  },

  // Date of birth patterns
  {
    type: 'date_of_birth',
    pattern: /\b(?:DOB|born|birthday|birth\s*date)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
    maskFn: (value: string) => {
      const match = value.match(/^([^0-9]+)/);
      const prefix = match ? match[1] : '';
      return prefix + '**/**/****';
    },
  },

  // US addresses (basic pattern)
  {
    type: 'address',
    pattern: /\d{1,5}\s+\w+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\.?(?:\s+(?:Apt|Suite|Unit|#)\s*\d+)?/gi,
    maskFn: () => '*** [Address Redacted] ***',
  },
];

// ============================================================================
// PII Redactor Class
// ============================================================================

export class PIIRedactor {
  private config: typeof guardrailsConfig.piiRedaction;
  private patterns: PIIPattern[];

  constructor() {
    this.config = guardrailsConfig.piiRedaction;
    this.patterns = PII_PATTERNS;
  }

  /**
   * Detect and redact PII from text
   */
  redact(text: string): PIIRedactionResult {
    if (!this.config.enabled) {
      return {
        hasPII: false,
        matches: [],
        redactedText: text,
        riskLevel: 'none',
      };
    }

    const matches: PIIMatch[] = [];
    let redactedText = text;

    // Find all PII matches
    for (const piiPattern of this.patterns) {
      // Skip if this type is not configured to be redacted
      if (!this.config.typesToRedact.includes(piiPattern.type)) {
        continue;
      }

      // Reset regex lastIndex for global patterns
      piiPattern.pattern.lastIndex = 0;

      let match;
      while ((match = piiPattern.pattern.exec(text)) !== null) {
        const value = match[0];
        const masked = piiPattern.maskFn(value);

        matches.push({
          type: piiPattern.type,
          value,
          masked,
          startIndex: match.index,
          endIndex: match.index + value.length,
        });
      }
    }

    // Sort matches by start index (descending) to replace from end to start
    // This preserves index positions during replacement
    matches.sort((a, b) => b.startIndex - a.startIndex);

    // Apply redactions
    for (const piiMatch of matches) {
      redactedText =
        redactedText.slice(0, piiMatch.startIndex) +
        piiMatch.masked +
        redactedText.slice(piiMatch.endIndex);
    }

    // Sort matches back to ascending order for output
    matches.sort((a, b) => a.startIndex - b.startIndex);

    const riskLevel = this.calculateRiskLevel(matches);

    return {
      hasPII: matches.length > 0,
      matches,
      redactedText,
      riskLevel,
    };
  }

  /**
   * Check if text contains PII without redacting
   */
  detect(text: string): PIIRedactionResult {
    const result = this.redact(text);
    // Return original text, not redacted
    result.redactedText = text;
    return result;
  }

  /**
   * Calculate risk level based on PII types found
   */
  private calculateRiskLevel(matches: PIIMatch[]): PIIRedactionResult['riskLevel'] {
    if (matches.length === 0) {
      return 'none';
    }

    const highRiskTypes: PIIType[] = ['ssn', 'credit_card', 'password', 'api_key'];
    const mediumRiskTypes: PIIType[] = ['date_of_birth', 'address'];

    const hasHighRisk = matches.some(m => highRiskTypes.includes(m.type));
    const hasMediumRisk = matches.some(m => mediumRiskTypes.includes(m.type));

    if (hasHighRisk) {
      return 'high';
    }

    if (hasMediumRisk || matches.length >= 3) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Redact PII for logging purposes
   */
  redactForLogging(text: string): string {
    if (!this.config.redactInLogs) {
      return text;
    }

    const result = this.redact(text);
    return result.redactedText;
  }

  /**
   * Get summary of detected PII
   */
  getSummary(result: PIIRedactionResult): string {
    if (!result.hasPII) {
      return 'No PII detected.';
    }

    const typeCounts: Record<string, number> = {};
    for (const match of result.matches) {
      typeCounts[match.type] = (typeCounts[match.type] || 0) + 1;
    }

    const summary = Object.entries(typeCounts)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');

    return `PII detected (${result.riskLevel} risk): ${summary}`;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const piiRedactor = new PIIRedactor();
