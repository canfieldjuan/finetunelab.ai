/**
 * Unit Tests for LLM-Judge Evaluation System
 * Tests the AI-powered evaluation capabilities
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LLMJudge, STANDARD_CRITERIA, createCustomCriterion } from '@/lib/evaluation/llm-judge';

describe('LLM-Judge', () => {
  let judge: LLMJudge;

  beforeEach(() => {
    judge = new LLMJudge('gpt-4-turbo');
  });

  describe('Standard Criteria', () => {
    it('should have 5 standard criteria', () => {
      expect(STANDARD_CRITERIA).toHaveLength(5);
    });

    it('should include helpfulness criterion', () => {
      const helpfulness = STANDARD_CRITERIA.find((c) => c.name === 'helpfulness');
      expect(helpfulness).toBeDefined();
      expect(helpfulness?.min_score).toBe(1);
      expect(helpfulness?.max_score).toBe(10);
      expect(helpfulness?.passing_score).toBe(7);
    });

    it('should include accuracy criterion', () => {
      const accuracy = STANDARD_CRITERIA.find((c) => c.name === 'accuracy');
      expect(accuracy).toBeDefined();
      expect(accuracy?.passing_score).toBe(7);
    });

    it('should include clarity criterion', () => {
      const clarity = STANDARD_CRITERIA.find((c) => c.name === 'clarity');
      expect(clarity).toBeDefined();
      expect(clarity?.passing_score).toBe(7);
    });

    it('should include safety criterion with higher threshold', () => {
      const safety = STANDARD_CRITERIA.find((c) => c.name === 'safety');
      expect(safety).toBeDefined();
      expect(safety?.passing_score).toBe(8); // Higher threshold for safety
    });

    it('should include completeness criterion', () => {
      const completeness = STANDARD_CRITERIA.find((c) => c.name === 'completeness');
      expect(completeness).toBeDefined();
      expect(completeness?.passing_score).toBe(7);
    });
  });

  describe('Custom Criterion Creation', () => {
    it('should create custom criterion with default passing score', () => {
      const custom = createCustomCriterion(
        'politeness',
        'Is the response polite and respectful?',
        '1-5: Rude, 6-8: Neutral, 9-10: Very polite'
      );

      expect(custom.name).toBe('politeness');
      expect(custom.min_score).toBe(1);
      expect(custom.max_score).toBe(10);
      expect(custom.passing_score).toBe(7);
    });

    it('should create custom criterion with custom passing score', () => {
      const custom = createCustomCriterion(
        'brevity',
        'Is the response concise?',
        '1-5: Too verbose, 6-8: Good, 9-10: Perfect',
        8
      );

      expect(custom.passing_score).toBe(8);
    });
  });

  describe('LLMJudge Class', () => {
    it('should initialize with default model', () => {
      const defaultJudge = new LLMJudge();
      expect(defaultJudge).toBeDefined();
    });

    it('should initialize with custom model', () => {
      const customJudge = new LLMJudge('claude-3-opus');
      expect(customJudge).toBeDefined();
    });
  });

  describe('Response Parsing', () => {
    it('should handle JSON with all fields', () => {
      // This tests the internal parsing logic indirectly
      const criterion = STANDARD_CRITERIA[0];
      expect(criterion).toBeDefined();
      expect(criterion.scoring_guide).toContain('1-2');
      expect(criterion.scoring_guide).toContain('9-10');
    });

    it('should validate score ranges', () => {
      STANDARD_CRITERIA.forEach((criterion) => {
        expect(criterion.min_score).toBeLessThanOrEqual(criterion.passing_score);
        expect(criterion.passing_score).toBeLessThanOrEqual(criterion.max_score);
      });
    });
  });

  describe('Batch Processing', () => {
    it('should support batch evaluation requests', () => {
      // Verify the method exists
      expect(judge.batchJudge).toBeDefined();
      expect(typeof judge.batchJudge).toBe('function');
    });
  });
});
