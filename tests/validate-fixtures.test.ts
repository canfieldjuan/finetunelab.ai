// Fixture Validation Tests
// Verify DPO and RLHF test fixtures are valid
// Date: 2025-10-17

import { datasetValidator } from '../lib/training/dataset-validator';
import * as fs from 'fs';
import * as path from 'path';

describe('Test Fixture Validation', () => {
  describe('DPO Fixture', () => {
    it('should validate sample-dataset-dpo.jsonl', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample-dataset-dpo.jsonl');
      const fileContent = fs.readFileSync(filePath);
      const file = new File([fileContent], 'sample-dataset-dpo.jsonl', { type: 'text/plain' });

      const result = await datasetValidator.validate(file, 'dpo');

      expect(result.valid).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats?.total_examples).toBe(3);
      expect(result.stats?.format).toBe('dpo');
    });
  });

  describe('RLHF Fixture', () => {
    it('should validate sample-dataset-rlhf.jsonl', async () => {
      const filePath = path.join(__dirname, 'fixtures/sample-dataset-rlhf.jsonl');
      const fileContent = fs.readFileSync(filePath);
      const file = new File([fileContent], 'sample-dataset-rlhf.jsonl', { type: 'text/plain' });

      const result = await datasetValidator.validate(file, 'rlhf');

      expect(result.valid).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats?.total_examples).toBe(3);
      expect(result.stats?.format).toBe('rlhf');
    });
  });
});

console.log('[FixtureValidationTest] Test file loaded');
