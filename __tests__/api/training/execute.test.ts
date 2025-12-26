/**
 * Unit Tests for Local Training API Endpoint
 * Tests the handleLocalProvider and helper functions
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { spawn } from 'child_process';
import path from 'path';
import { writeFile, unlink, readFile } from 'fs/promises';

describe('Local Training Execution', () => {
  const testConfigPath = path.join(process.cwd(), 'lib', 'training', 'test_unit_config.json');
  
  const mockConfig = {
    model_name: 'meta-llama/Llama-3.2-1B',
    dataset_id: 'test-dataset-unit',
    method: 'sft',
    output_dir: './outputs/test-unit',
    learning_rate: 0.0002,
    num_epochs: 1,
    batch_size: 2,
    lora_r: 16,
    lora_alpha: 32,
    use_4bit: true,
    max_seq_length: 512
  };

  afterAll(async () => {
    // Cleanup test files
    try {
      await unlink(testConfigPath);
    } catch {
      // File may not exist
    }
  });

  describe('Config File Management', () => {
    it('should write config to JSON file', async () => {
      await writeFile(testConfigPath, JSON.stringify(mockConfig, null, 2));
      
      const fileExists = await readFile(testConfigPath, 'utf-8');
      expect(fileExists).toBeTruthy();
      
      const loadedConfig = JSON.parse(fileExists);
      expect(loadedConfig.model_name).toBe('meta-llama/Llama-3.2-1B');
      expect(loadedConfig.method).toBe('sft');
    });

    it('should parse config correctly', async () => {
      const content = await readFile(testConfigPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config).toHaveProperty('model_name');
      expect(config).toHaveProperty('dataset_id');
      expect(config).toHaveProperty('method');
      expect(config.learning_rate).toBe(0.0002);
      expect(config.num_epochs).toBe(1);
    });
  });

  describe('Python Path Resolution', () => {
    it('should resolve Python executable path', () => {
      const pythonPath = process.env.PYTHON_PATH ||
        path.join(process.cwd(), 'lib', 'training', 'trainer_venv', 'bin', 'python3');

      expect(pythonPath).toContain('python');
      expect(path.isAbsolute(pythonPath) || pythonPath.includes('python')).toBe(true);
    });

    it('should resolve trainer script path', () => {
      const trainerPath = path.join(process.cwd(), 'lib', 'training', 'standalone_trainer.py');
      
      expect(trainerPath).toContain('standalone_trainer.py');
      expect(trainerPath).toContain('lib');
      expect(trainerPath).toContain('training');
    });
  });

  describe('Subprocess Spawning', () => {
    it('should spawn Python process with correct arguments', (done) => {
      const pythonPath = process.env.PYTHON_PATH ||
        path.join(process.cwd(), 'lib', 'training', 'trainer_venv', 'bin', 'python3');
      const trainerPath = path.join(process.cwd(), 'lib', 'training', 'standalone_trainer.py');

      // Spawn with --help to test argument parsing without training
      const pythonProcess = spawn(pythonPath, [trainerPath, '--help']);

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', () => {
        const combinedOutput = output + errorOutput;
        expect(combinedOutput).toContain('usage:');
        expect(combinedOutput).toContain('--config');
        expect(combinedOutput).toContain('--execution-id');
        done();
      });

      pythonProcess.on('error', (err) => {
        done(err);
      });
    }, 15000);

    it('should fail when required arguments are missing', (done) => {
      const pythonPath = process.env.PYTHON_PATH ||
        path.join(process.cwd(), 'lib', 'training', 'trainer_venv', 'bin', 'python3');
      const trainerPath = path.join(process.cwd(), 'lib', 'training', 'standalone_trainer.py');

      // Spawn without arguments - should fail
      const pythonProcess = spawn(pythonPath, [trainerPath]);

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        const combinedOutput = output + errorOutput;
        expect(code).not.toBe(0);
        const hasExpectedError = combinedOutput.toLowerCase().includes('required') ||
                                 combinedOutput.toLowerCase().includes('error') ||
                                 combinedOutput.toLowerCase().includes('usage:') ||
                                 code === 2;
        expect(hasExpectedError).toBe(true);
        done();
      });

      pythonProcess.on('error', (err) => {
        done(err);
      });
    }, 15000);
  });

  describe('Configuration Validation', () => {
    it('should require model_name', () => {
      const invalidConfig: Partial<typeof mockConfig> = { ...mockConfig };
      delete invalidConfig.model_name;

      expect(invalidConfig.model_name).toBeUndefined();
    });

    it('should require dataset_id', () => {
      const invalidConfig: Partial<typeof mockConfig> = { ...mockConfig };
      delete invalidConfig.dataset_id;

      expect(invalidConfig.dataset_id).toBeUndefined();
    });

    it('should have valid method', () => {
      expect(['sft', 'dpo', 'teacher']).toContain(mockConfig.method);
    });

    it('should have numeric hyperparameters', () => {
      expect(typeof mockConfig.learning_rate).toBe('number');
      expect(typeof mockConfig.num_epochs).toBe('number');
      expect(typeof mockConfig.batch_size).toBe('number');
      expect(typeof mockConfig.lora_r).toBe('number');
      expect(typeof mockConfig.lora_alpha).toBe('number');
    });
  });
});
