// Dataset Validator Unit Tests
// Tests for DPO and RLHF format validators
// Date: 2025-10-17

import { datasetValidator } from './dataset-validator';

describe('DatasetValidator', () => {
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
