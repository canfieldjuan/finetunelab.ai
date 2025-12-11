/**
 * Response Quality Validation Service
 * Detects and warns about superficial LLM responses
 * Date: 2025-10-25
 */

export interface ResponseQualityMetrics {
  isLikelySuperficial: boolean;
  confidence: number; // 0-1
  issues: string[];
  recommendations: string[];
}

export interface ValidationContext {
  query: string;
  deepSearchEnabled: boolean;
  resultCount: number;
  instruction: string;
}

export class ResponseValidatorService {
  // Indicators of superficial responses
  private readonly superficialIndicators = {
    // Patterns suggesting brief/superficial response
    briefPatterns: [
      /^[-•*]\s/gm, // Bullet points
      /^\d+\./gm,   // Numbered lists
    ],

    // Keywords in instructions that suggest comprehensive analysis needed
    comprehensiveKeywords: [
      'CRITICAL INSTRUCTIONS',
      'YOU MUST',
      'comprehensive',
      'detailed analysis',
      'synthesize',
      '3-4 paragraphs',
      'specific examples',
    ],
  };

  /**
   * Analyze response context to predict likelihood of superficial response
   * This is called BEFORE the LLM responds, based on the data being sent
   */
  validateResponseContext(context: ValidationContext): ResponseQualityMetrics {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let superficialityScore = 0;
    const maxScore = 10;

    // Check if deep search is enabled but instruction might be ignored
    if (context.deepSearchEnabled) {
      const hasFullContentInstruction = context.instruction.includes('fullContent');
      const hasComprehensiveInstruction = context.instruction.includes('CRITICAL INSTRUCTIONS');

      if (!hasFullContentInstruction) {
        issues.push('Deep search enabled but fullContent not emphasized in instructions');
        superficialityScore += 3;
      }

      if (!hasComprehensiveInstruction) {
        issues.push('Deep search enabled but lacking strong directive language');
        superficialityScore += 2;
      } else {
        superficialityScore -= 2; // Good - has strong instructions
      }
    }

    // Check if query complexity matches instruction strength
    const queryWords = context.query.split(/\s+/).length;
    const isComplexQuery = queryWords > 8 ||
                          /analyze|compare|evaluate|explain|comprehensive/.test(context.query.toLowerCase());

    if (isComplexQuery) {
      const hasStrongInstructions = this.superficialIndicators.comprehensiveKeywords.some(
        keyword => context.instruction.includes(keyword)
      );

      if (!hasStrongInstructions) {
        issues.push('Complex query but weak instructions - may get superficial response');
        superficialityScore += 4;
        recommendations.push('Consider strengthening instructions with directive language');
      }
    }

    // Check result count
    if (context.resultCount < 3) {
      issues.push(`Low result count (${context.resultCount}) - may limit response quality`);
      superficialityScore += 2;
      recommendations.push('Consider expanding search results for better coverage');
    }

    // Check instruction length and detail
    const instructionLength = context.instruction.length;
    if (instructionLength < 200 && isComplexQuery) {
      issues.push('Brief instructions for complex query - may not provide enough guidance');
      superficialityScore += 3;
      recommendations.push('Add specific requirements for response structure and depth');
    }

    // Calculate final metrics
    const normalizedScore = Math.max(0, Math.min(1, superficialityScore / maxScore));
    const isLikelySuperficial = normalizedScore > 0.5;

    // Add general recommendations if likely superficial
    if (isLikelySuperficial) {
      if (context.deepSearchEnabled) {
        recommendations.push('Emphasize using fullContent field in response instructions');
        recommendations.push('Add minimum paragraph/word count requirements');
      } else if (isComplexQuery) {
        recommendations.push('Consider enabling deepSearch for complex analytical queries');
      }

      recommendations.push('Add explicit structure requirements (sections, examples, citations)');
      recommendations.push('Use DO NOT / DO statements to prevent superficial patterns');
    }

    console.log('[ResponseValidator] Quality analysis:', {
      query: context.query.substring(0, 50),
      isLikelySuperficial,
      confidence: normalizedScore.toFixed(2),
      issueCount: issues.length,
      deepSearchEnabled: context.deepSearchEnabled,
    });

    return {
      isLikelySuperficial,
      confidence: normalizedScore,
      issues,
      recommendations,
    };
  }

  /**
   * Enhance instructions with quality enforcement based on validation
   */
  enhanceInstructions(
    originalInstruction: string,
    validation: ResponseQualityMetrics
  ): string {
    if (!validation.isLikelySuperficial || validation.confidence < 0.6) {
      return originalInstruction; // No enhancement needed
    }

    // Add quality enforcement footer
    const enhancement = `

⚠️ QUALITY REQUIREMENTS (CRITICAL):
${validation.recommendations.slice(0, 3).map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

AVOID: Bullet-point lists without explanation, brief summaries, missing citations
REQUIRED: Detailed paragraphs with context, specific examples, proper source attribution`;

    console.log('[ResponseValidator] Enhanced instructions with quality requirements');

    return originalInstruction + enhancement;
  }
}

export const responseValidatorService = new ResponseValidatorService();
