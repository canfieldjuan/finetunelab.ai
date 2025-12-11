// Prompt Tester Service - Core Functionality
// Date: October 13, 2025
// Security: Uses API routes for LLM calls, no direct OpenAI access

import { supabase } from '@/lib/supabaseClient';
import type {
  PromptTestResult,
  PromptComparison,
  PromptPattern,
  TestData,
  TestOptions,
  ComparisonMetrics,
} from './types';
import { promptTesterConfig } from './config';

class PromptTesterService {
  async testPrompt(
    template: string,
    testData: TestData,
    options: TestOptions = {}
  ): Promise<PromptTestResult> {
    try {
      const prompt = this.injectVariables(template, testData.variables || {});

      const result = await this.executePrompt(prompt, testData, options);

      const qualityScore = this.analyzeQuality(result.response);
      const issues = this.identifyIssues(result.response);

      return {
        prompt,
        response: result.response,
        tokenCount: result.tokens,
        responseTime: result.latency,
        qualityScore,
        issues,
      };
    } catch (error) {
      throw new Error(
        `Failed to test prompt: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async comparePrompts(
    promptA: string,
    promptB: string,
    testData: TestData,
    options: TestOptions = {}
  ): Promise<PromptComparison> {
    try {
      const resultA = await this.testPrompt(promptA, testData, options);
      const resultB = await this.testPrompt(promptB, testData, options);

      const metrics = this.calculateMetrics(resultA, resultB);
      const winner = this.determineWinner(resultA, resultB);

      const winnerIndex = winner === 'A' ? 0 : winner === 'B' ? 1 : -1;

      const reasoning =
        winner === 'A'
          ? 'Prompt A has better quality and performance'
          : winner === 'B'
          ? 'Prompt B has better quality and performance'
          : 'Both prompts perform similarly';

      return {
        variations: [resultA, resultB],
        winner: winnerIndex,
        reasoning,
        metrics,
      };
    } catch (error) {
      throw new Error(
        `Failed to compare prompts: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async savePattern(
    pattern: PromptPattern,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[PromptTester] Saving pattern:', pattern.name, 'for user:', userId);

      // Insert pattern into database
      const { data, error } = await supabase
        .from('prompt_patterns')
        .insert({
          user_id: userId,
          name: pattern.name,
          template: pattern.template,
          use_case: pattern.use_case,
          success_rate: pattern.success_rate,
          avg_rating: pattern.avg_rating,
          metadata: pattern.metadata || {},
        })
        .select()
        .single();

      if (error) {
        // Check if table doesn't exist yet
        if (error.message?.includes('relation "public.prompt_patterns" does not exist')) {
          console.warn('[PromptTester] prompt_patterns table not found. Run migration: docs/schema_updates/07_prompt_patterns.sql');
          return {
            success: false,
            message: 'Database table not configured. Please contact administrator.',
          };
        }

        // Check for duplicate name
        if (error.code === '23505') {
          return {
            success: false,
            message: `Pattern "${pattern.name}" already exists. Please use a different name.`,
          };
        }

        throw error;
      }

      console.log('[PromptTester] Pattern saved successfully:', data.id);

      return {
        success: true,
        message: `Pattern "${pattern.name}" saved successfully`,
      };
    } catch (error) {
      console.error('[PromptTester] Error saving pattern:', error);
      return {
        success: false,
        message: `Failed to save pattern: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  async searchPatterns(
    query: string,
    userId: string
  ): Promise<PromptPattern[]> {
    try {
      console.log('[PromptTester] Searching patterns:', query, 'for user:', userId);

      // Build query - search by name, template, or use_case
      let dbQuery = supabase
        .from('prompt_patterns')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // If query is provided, filter results
      if (query && query.trim()) {
        const searchTerm = `%${query.trim()}%`;
        dbQuery = dbQuery.or(
          `name.ilike.${searchTerm},template.ilike.${searchTerm},use_case.ilike.${searchTerm}`
        );
      }

      const { data, error } = await dbQuery.limit(50);

      if (error) {
        // Check if table doesn't exist yet
        if (error.message?.includes('relation "public.prompt_patterns" does not exist')) {
          console.warn('[PromptTester] prompt_patterns table not found. Run migration: docs/schema_updates/07_prompt_patterns.sql');
          return [];
        }

        throw error;
      }

      // Map database rows to PromptPattern type
      const patterns: PromptPattern[] = (data || []).map(row => ({
        id: row.id,
        name: row.name,
        template: row.template,
        use_case: row.use_case,
        success_rate: row.success_rate,
        avg_rating: row.avg_rating,
        created_at: row.created_at,
        metadata: row.metadata || {},
      }));

      console.log('[PromptTester] Found', patterns.length, 'patterns');

      return patterns;
    } catch (error) {
      console.error('[PromptTester] Error searching patterns:', error);
      return [];
    }
  }

  private injectVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  private async executePrompt(
    prompt: string,
    testData: TestData,
    options: TestOptions
  ): Promise<{ response: string; tokens: number; latency: number }> {
    // Call secure API route instead of direct OpenAI access
    const response = await fetch('/api/tools/prompt-tester', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'test_prompt',
        prompt,
        testData,
        options: {
          model: promptTesterConfig.defaultModel,
          temperature: options.temperature ?? promptTesterConfig.defaultTemperature,
          max_tokens: options.max_tokens ?? promptTesterConfig.defaultMaxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to execute prompt');
    }

    const result = await response.json();
    return result.data;
  }

  private analyzeQuality(response: string): number {
    let score = 0.5;

    // Check response length (ideal: 50-500 chars)
    if (response.length >= 50 && response.length <= 500) {
      score += 0.2;
    }

    // Check for coherence (has proper sentences)
    if (response.includes('.') || response.includes('!') || response.includes('?')) {
      score += 0.15;
    }

    // Check for detail (multiple sentences)
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 2) {
      score += 0.15;
    }

    return Math.min(score, 1.0);
  }

  private identifyIssues(response: string): string[] {
    const issues: string[] = [];

    if (response.length < 10) {
      issues.push('Response too short');
    }
    if (response.length > 2000) {
      issues.push('Response too long');
    }
    if (!response.trim()) {
      issues.push('Empty response');
    }

    return issues;
  }

  private calculateMetrics(
    resultA: PromptTestResult,
    resultB: PromptTestResult
  ): ComparisonMetrics {
    return {
      avgTokenCount: [resultA.tokenCount, resultB.tokenCount],
      avgResponseTime: [resultA.responseTime, resultB.responseTime],
      avgQualityScore: [
        resultA.qualityScore || 0,
        resultB.qualityScore || 0
      ],
    };
  }

  private determineWinner(
    resultA: PromptTestResult,
    resultB: PromptTestResult
  ): 'A' | 'B' | 'tie' {
    const scoreA = (resultA.qualityScore || 0) * 0.7 +
      (1000 / resultA.tokenCount) * 0.2 +
      (5000 / resultA.responseTime) * 0.1;

    const scoreB = (resultB.qualityScore || 0) * 0.7 +
      (1000 / resultB.tokenCount) * 0.2 +
      (5000 / resultB.responseTime) * 0.1;

    const diff = Math.abs(scoreA - scoreB);
    if (diff < 0.1) return 'tie';

    return scoreA > scoreB ? 'A' : 'B';
  }
}

const promptTesterService = new PromptTesterService();
export default promptTesterService;
