// Intelligent Email Tool - Security Service
// Phase 4.1: PII detection, spam/phishing detection, security analysis
// Date: October 24, 2025

import { getOpenAIResponse } from '@/lib/llm/openai';
import type { EmailMessage } from './types';

/**
 * PII (Personally Identifiable Information) detection result
 */
export interface PIIDetectionResult {
  hasPII: boolean;
  piiTypes: PIIType[];
  detectedItems: PIIItem[];
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  recommendations: string[];
}

/**
 * Types of PII that can be detected
 */
export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'address'
  | 'name'
  | 'date_of_birth'
  | 'medical'
  | 'financial';

/**
 * Detected PII item
 */
export interface PIIItem {
  type: PIIType;
  value: string;
  masked: string;
  location: 'subject' | 'body';
}

/**
 * Spam/Phishing detection result
 */
export interface SpamPhishingResult {
  isSpam: boolean;
  isPhishing: boolean;
  confidenceScore: number;
  indicators: string[];
  riskLevel: 'safe' | 'suspicious' | 'dangerous';
  recommendations: string[];
}

/**
 * Enhanced sentiment analysis result
 */
export interface SentimentAnalysisResult {
  sentiment: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  tone: 'professional' | 'casual' | 'formal' | 'urgent' | 'aggressive' | 'friendly';
  emotions: string[];
  confidenceScore: number;
  keyPhrases: string[];
}

/**
 * Security service configuration
 */
interface SecurityConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  enablePIIDetection: boolean;
  enableSpamDetection: boolean;
}

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  model: process.env.EMAIL_SECURITY_MODEL || 'gpt-4o-mini',
  temperature: 0.2,
  maxTokens: 1500,
  enablePIIDetection: process.env.EMAIL_PII_DETECTION !== 'false',
  enableSpamDetection: process.env.EMAIL_SPAM_DETECTION !== 'false',
};

export class EmailSecurityService {
  private config: SecurityConfig;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    console.log('[EmailSecurity] Initialized:', this.config);
  }

  /**
   * Detect PII in email content
   */
  async detectPII(email: EmailMessage): Promise<PIIDetectionResult> {
    console.log('[EmailSecurity] Detecting PII in email:', email.subject);

    if (!this.config.enablePIIDetection) {
      return this.getEmptyPIIResult();
    }

    try {
      // First, use regex patterns for quick detection
      const regexResults = this.detectPIIWithRegex(email);

      // Then, use LLM for contextual analysis
      const llmResults = await this.detectPIIWithLLM(email);

      // Merge results
      const merged = this.mergePIIResults(regexResults, llmResults);

      console.log('[EmailSecurity] PII detection complete:', {
        hasPII: merged.hasPII,
        types: merged.piiTypes.length,
        riskLevel: merged.riskLevel,
      });

      return merged;
    } catch (error) {
      console.error('[EmailSecurity] PII detection error:', error);
      return this.getEmptyPIIResult();
    }
  }

  /**
   * Detect spam and phishing attempts
   */
  async detectSpamPhishing(email: EmailMessage): Promise<SpamPhishingResult> {
    console.log('[EmailSecurity] Analyzing for spam/phishing:', email.subject);

    if (!this.config.enableSpamDetection) {
      return this.getSafeSpamResult();
    }

    try {
      const prompt = this.buildSpamPhishingPrompt(email);
      const response = await this.callLLM(prompt);
      const parsed = this.parseSpamPhishingResponse(response);

      console.log('[EmailSecurity] Spam/phishing analysis complete:', {
        isSpam: parsed.isSpam,
        isPhishing: parsed.isPhishing,
        riskLevel: parsed.riskLevel,
      });

      return parsed;
    } catch (error) {
      console.error('[EmailSecurity] Spam detection error:', error);
      return this.getSafeSpamResult();
    }
  }

  /**
   * Enhanced sentiment analysis
   */
  async analyzeSentiment(email: EmailMessage): Promise<SentimentAnalysisResult> {
    console.log('[EmailSecurity] Analyzing sentiment:', email.subject);

    try {
      const prompt = this.buildSentimentPrompt(email);
      const response = await this.callLLM(prompt);
      const parsed = this.parseSentimentResponse(response);

      console.log('[EmailSecurity] Sentiment analysis complete:', {
        sentiment: parsed.sentiment,
        tone: parsed.tone,
      });

      return parsed;
    } catch (error) {
      console.error('[EmailSecurity] Sentiment analysis error:', error);
      return this.getNeutralSentiment();
    }
  }

  /**
   * Build spam/phishing detection prompt
   */
  private buildSpamPhishingPrompt(email: EmailMessage): string {
    return `Analyze this email for spam and phishing indicators.

From: ${email.from}
${email.to ? `To: ${email.to.join(', ')}` : ''}
Subject: ${email.subject}
Body:
${email.body}

Check for:
- Suspicious sender addresses
- Urgent or threatening language
- Requests for personal information
- Unusual links or attachments
- Poor grammar/spelling
- Too good to be true offers
- Impersonation attempts
- Mismatched URLs

Respond in JSON format:
{
  "isSpam": boolean,
  "isPhishing": boolean,
  "confidenceScore": 0-100,
  "indicators": ["list of specific indicators found"],
  "riskLevel": "safe|suspicious|dangerous",
  "recommendations": ["specific actions to take"]
}`;
  }

  /**
   * Build sentiment analysis prompt
   */
  private buildSentimentPrompt(email: EmailMessage): string {
    return `Perform detailed sentiment and tone analysis on this email.

From: ${email.from}
Subject: ${email.subject}
Body:
${email.body}

Analyze:
- Overall sentiment (very_positive, positive, neutral, negative, very_negative)
- Professional tone (professional, casual, formal, urgent, aggressive, friendly)
- Emotional undertones
- Key phrases that reveal sentiment

Respond in JSON format:
{
  "sentiment": "very_positive|positive|neutral|negative|very_negative",
  "tone": "professional|casual|formal|urgent|aggressive|friendly",
  "emotions": ["happy", "frustrated", "concerned", ...],
  "confidenceScore": 0-100,
  "keyPhrases": ["phrases that reveal sentiment"]
}`;
  }

  /**
   * Call LLM for analysis
   */
  private async callLLM(prompt: string): Promise<string> {
    try {
      const response = await getOpenAIResponse(
        [{ role: 'user', content: prompt }],
        this.config.model,
        this.config.temperature,
        this.config.maxTokens
      );
      return response;
    } catch (error) {
      console.error('[EmailSecurity] LLM call failed:', error);
      throw error;
    }
  }

  /**
   * Detect PII using regex patterns (fast but less accurate)
   */
  private detectPIIWithRegex(email: EmailMessage): PIIDetectionResult {
    const detectedItems: PIIItem[] = [];
    const text = `${email.subject} ${email.body}`;

    // Email pattern
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailRegex) || [];
    emails.forEach(e => {
      detectedItems.push({
        type: 'email',
        value: e,
        masked: this.maskEmail(e),
        location: email.body.includes(e) ? 'body' : 'subject',
      });
    });

    // Phone pattern (US format)
    const phoneRegex = /(\+1\s?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/g;
    const phones = text.match(phoneRegex) || [];
    phones.forEach(p => {
      detectedItems.push({
        type: 'phone',
        value: p,
        masked: this.maskPhone(p),
        location: email.body.includes(p) ? 'body' : 'subject',
      });
    });

    // SSN pattern
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    const ssns = text.match(ssnRegex) || [];
    ssns.forEach(s => {
      detectedItems.push({
        type: 'ssn',
        value: s,
        masked: '***-**-****',
        location: email.body.includes(s) ? 'body' : 'subject',
      });
    });

    // Credit card pattern (basic)
    const ccRegex = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
    const cards = text.match(ccRegex) || [];
    cards.forEach(c => {
      detectedItems.push({
        type: 'credit_card',
        value: c,
        masked: '**** **** **** ****',
        location: email.body.includes(c) ? 'body' : 'subject',
      });
    });

    const piiTypes = [...new Set(detectedItems.map(item => item.type))];
    const riskLevel = this.calculatePIIRiskLevel(detectedItems);

    return {
      hasPII: detectedItems.length > 0,
      piiTypes,
      detectedItems,
      riskLevel,
      recommendations: this.generatePIIRecommendations(detectedItems),
    };
  }

  /**
   * Detect PII using LLM for contextual understanding
   */
  private async detectPIIWithLLM(email: EmailMessage): Promise<PIIDetectionResult> {
    const prompt = `Analyze this email for personally identifiable information (PII).

From: ${email.from}
Subject: ${email.subject}
Body: ${email.body}

Identify any PII such as:
- Names
- Email addresses
- Phone numbers
- Social Security Numbers
- Credit card numbers
- Physical addresses
- Dates of birth
- Medical information
- Financial information

Respond in JSON format:
{
  "hasPII": true/false,
  "piiTypes": ["email", "phone", "name", ...],
  "detectedItems": [
    {"type": "email", "value": "example@email.com", "location": "body"},
    ...
  ],
  "riskLevel": "none|low|medium|high"
}`;

    try {
      const response = await this.callLLM(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getEmptyPIIResult();
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const detectedItems: PIIItem[] = (parsed.detectedItems || []).map((item: { type: PIIType; value: string; location: 'subject' | 'body' }) => ({
        type: item.type,
        value: item.value,
        masked: this.maskValueByType(item.type, item.value),
        location: item.location,
      }));

      return {
        hasPII: parsed.hasPII || false,
        piiTypes: parsed.piiTypes || [],
        detectedItems,
        riskLevel: parsed.riskLevel || 'none',
        recommendations: this.generatePIIRecommendations(detectedItems),
      };
    } catch (error) {
      console.error('[EmailSecurity] LLM PII detection failed:', error);
      return this.getEmptyPIIResult();
    }
  }

  /**
   * Parse spam/phishing detection response
   */
  private parseSpamPhishingResponse(response: string): SpamPhishingResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getSafeSpamResult();
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isSpam: parsed.isSpam ?? false,
        isPhishing: parsed.isPhishing ?? false,
        confidenceScore: parsed.confidenceScore ?? 0,
        indicators: parsed.indicators ?? [],
        riskLevel: parsed.riskLevel ?? 'safe',
        recommendations: parsed.recommendations ?? [],
      };
    } catch (error) {
      console.error('Failed to parse spam/phishing response:', error);
      return this.getSafeSpamResult();
    }
  }

  /**
   * Parse sentiment analysis response
   */
  private parseSentimentResponse(response: string): SentimentAnalysisResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getNeutralSentiment();
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        sentiment: parsed.sentiment ?? 'neutral',
        tone: parsed.tone ?? 'professional',
        emotions: parsed.emotions ?? [],
        confidenceScore: parsed.confidenceScore ?? 0,
        keyPhrases: parsed.keyPhrases ?? [],
      };
    } catch (error) {
      console.error('Failed to parse sentiment response:', error);
      return this.getNeutralSentiment();
    }
  }

  /**
   * Mask email address
   */
  private maskEmail(email: string): string {
    const [user, domain] = email.split('@');
    if (!domain) return email;
    
    const maskedUser = user.length > 2 
      ? user[0] + '*'.repeat(user.length - 2) + user[user.length - 1]
      : '*'.repeat(user.length);
    
    return `${maskedUser}@${domain}`;
  }

  /**
   * Mask phone number
   */
  private maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '*'.repeat(phone.length);
    
    const lastFour = digits.slice(-4);
    const masked = '*'.repeat(digits.length - 4) + lastFour;
    
    // Preserve original formatting
    let result = '';
    let digitIndex = 0;
    for (const char of phone) {
      if (/\d/.test(char)) {
        result += masked[digitIndex++];
      } else {
        result += char;
      }
    }
    return result;
  }

  /**
   * Mask generic value
   */
  private maskValue(value: string): string {
    if (value.length <= 4) return '*'.repeat(value.length);
    return '*'.repeat(value.length - 4) + value.slice(-4);
  }

  /**
   * Mask value by PII type
   */
  private maskValueByType(type: PIIType, value: string): string {
    switch (type) {
      case 'email':
        return this.maskEmail(value);
      case 'phone':
        return this.maskPhone(value);
      case 'ssn':
        return '***-**-****';
      case 'credit_card':
        return '**** **** **** ****';
      default:
        return this.maskValue(value);
    }
  }

  /**
   * Merge PII detection results
   */
  private mergePIIResults(
    regexResult: PIIDetectionResult,
    llmResult: PIIDetectionResult
  ): PIIDetectionResult {
    const allDetections = [...regexResult.detectedItems, ...llmResult.detectedItems];
    
    // Deduplicate by type and value
    const uniqueDetections = allDetections.filter(
      (detection, index, self) =>
        index === self.findIndex(
          (d) => d.type === detection.type && d.value === detection.value
        )
    );

    const hasPII = uniqueDetections.length > 0;
    const piiTypes = [...new Set(uniqueDetections.map(item => item.type))];
    const riskLevel = this.calculatePIIRiskLevel(uniqueDetections);

    return {
      hasPII,
      piiTypes,
      detectedItems: uniqueDetections,
      riskLevel,
      recommendations: this.generatePIIRecommendations(uniqueDetections),
    };
  }

  /**
   * Calculate PII risk level
   */
  private calculatePIIRiskLevel(detections: PIIItem[]): 'none' | 'low' | 'medium' | 'high' {
    if (detections.length === 0) return 'none';

    const highRiskTypes: PIIType[] = ['ssn', 'credit_card'];
    const hasHighRisk = detections.some((d) => highRiskTypes.includes(d.type));
    
    if (hasHighRisk) return 'high';
    if (detections.length >= 3) return 'high';
    if (detections.length >= 2) return 'medium';
    
    return 'low';
  }

  /**
   * Generate PII recommendations
   */
  private generatePIIRecommendations(detections: PIIItem[]): string[] {
    const recommendations: string[] = [];

    if (detections.length === 0) {
      return ['No PII detected - safe to share'];
    }

    const types = new Set(detections.map((d) => d.type));

    if (types.has('ssn')) {
      recommendations.push('CRITICAL: Remove Social Security Number before sending');
    }
    if (types.has('credit_card')) {
      recommendations.push('CRITICAL: Remove credit card information before sending');
    }
    if (types.has('email')) {
      recommendations.push('Consider if email addresses should be shared');
    }
    if (types.has('phone')) {
      recommendations.push('Verify recipient before sharing phone numbers');
    }
    if (types.has('address')) {
      recommendations.push('Consider if physical address should be shared');
    }

    if (detections.length >= 3) {
      recommendations.push('Multiple PII types detected - use encryption or secure channel');
    }

    return recommendations;
  }

  /**
   * Get empty PII result
   */
  private getEmptyPIIResult(): PIIDetectionResult {
    return {
      hasPII: false,
      piiTypes: [],
      detectedItems: [],
      riskLevel: 'none',
      recommendations: ['No PII detected - safe to share'],
    };
  }

  /**
   * Get safe spam result
   */
  private getSafeSpamResult(): SpamPhishingResult {
    return {
      isSpam: false,
      isPhishing: false,
      confidenceScore: 0,
      indicators: [],
      riskLevel: 'safe',
      recommendations: ['Unable to analyze - treat with caution'],
    };
  }

  /**
   * Get neutral sentiment
   */
  private getNeutralSentiment(): SentimentAnalysisResult {
    return {
      sentiment: 'neutral',
      tone: 'professional',
      emotions: [],
      confidenceScore: 0,
      keyPhrases: [],
    };
  }
}

/**
 * Singleton instance
 */
export const emailSecurityService = new EmailSecurityService();
