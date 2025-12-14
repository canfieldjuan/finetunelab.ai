// Dataset Validator Unit Tests
// Tests for DPO and RLHF format validators
// Date: 2025-10-17

import { datasetValidator } from './dataset-validator';

describe('DatasetValidator', () => {
  describe('validateWithNormalization', () => {
    it('should reject when normalization yields 0 examples (alpaca missing output)', async () => {
      const alpacaBad = JSON.stringify({
        instruction: 'Write a greeting',
        input: 'Name: Juan'
        // missing output/response
      });

      const file = new File([alpacaBad], 'alpaca.json', { type: 'application/json' });
      const result = await datasetValidator.validateWithNormalization(file);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some(e => e.toLowerCase().includes('no valid training examples'))).toBe(true);
    });

    it('should reject standard-text uploads (text field) as 0-example normalization', async () => {
      const textOnly = JSON.stringify({ text: 'just some text' });
      const file = new File([textOnly], 'text.json', { type: 'application/json' });
      const result = await datasetValidator.validateWithNormalization(file);

      expect(result.valid).toBe(false);
      expect(result.detectedFormat).toBe('standard-text');
      expect(result.errors).toBeDefined();
    });

    it('should accept valid alpaca and produce 1 normalized example', async () => {
      const alpacaGood = JSON.stringify({
        instruction: 'Write a greeting',
        input: 'Name: Juan',
        output: 'Hello Juan!'
      });

      const file = new File([alpacaGood], 'alpaca.json', { type: 'application/json' });
      const result = await datasetValidator.validateWithNormalization(file);

      expect(result.valid).toBe(true);
      expect(result.stats?.total_examples).toBe(1);
      expect(result.normalized?.stats.convertedCount).toBe(1);
    });
  });

  describe('DPO Format', () => {
    it('should validate correct DPO format', async () => {
      const dpoData = JSON.stringify({
        prompt: 'What is AI?',
        chosen: 'AI stands for Artificial Intelligence',
        rejected: 'I dont know'
      });

      const file = new File([dpoData], 'test.jsonl', { type: 'text/plain' });
      const result = await datasetValidator.validate(file, 'dpo');

      expect(result.valid).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats?.total_examples).toBe(1);
    });

    it('should reject DPO with missing prompt', async () => {
      const dpoData = JSON.stringify({
        chosen: 'AI stands for Artificial Intelligence',
        rejected: 'I dont know'
      });

      const file = new File([dpoData], 'test.jsonl', { type: 'text/plain' });
      const result = await datasetValidator.validate(file, 'dpo');

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('RLHF Format', () => {
    it('should validate correct RLHF format', async () => {
      const rlhfData = JSON.stringify({
        prompt: 'What is AI?',
        response: 'AI stands for Artificial Intelligence',
        reward: 0.9
      });

      const file = new File([rlhfData], 'test.jsonl', { type: 'text/plain' });
      const result = await datasetValidator.validate(file, 'rlhf');

      expect(result.valid).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats?.total_examples).toBe(1);
    });

    it('should validate RLHF without reward field', async () => {
      const rlhfData = JSON.stringify({
        prompt: 'What is AI?',
        response: 'AI stands for Artificial Intelligence'
      });

      const file = new File([rlhfData], 'test.jsonl', { type: 'text/plain' });
      const result = await datasetValidator.validate(file, 'rlhf');

      expect(result.valid).toBe(true);
      expect(result.stats).toBeDefined();
    });

    it('should reject RLHF with invalid reward type', async () => {
      const rlhfData = JSON.stringify({
        prompt: 'What is AI?',
        response: 'AI stands for Artificial Intelligence',
        reward: 'high'
      });

      const file = new File([rlhfData], 'test.jsonl', { type: 'text/plain' });
      const result = await datasetValidator.validate(file, 'rlhf');

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});

console.log('[DatasetValidatorTest] Test file loaded');
