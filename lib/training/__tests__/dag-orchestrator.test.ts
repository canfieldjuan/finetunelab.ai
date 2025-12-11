/**
 * DAG Orchestrator Tests
 * 
 * Tests for the TypeScript-native DAG orchestration system
 */

import DAGOrchestrator, { DAGValidator, JobConfig, JobContext } from '../dag-orchestrator';

describe('DAGValidator', () => {
  describe('validate', () => {
    it('should validate a simple linear DAG', () => {
      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'First Job',
          type: 'preprocessing',
          dependsOn: [],
          config: {},
        },
        {
          id: 'job2',
          name: 'Second Job',
          type: 'training',
          dependsOn: ['job1'],
          config: {},
        },
      ];

      const result = DAGValidator.validate(jobs);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect circular dependencies', () => {
      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'First Job',
          type: 'preprocessing',
          dependsOn: ['job2'],
          config: {},
        },
        {
          id: 'job2',
          name: 'Second Job',
          type: 'training',
          dependsOn: ['job1'],
          config: {},
        },
      ];

      const result = DAGValidator.validate(jobs);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Cycle detected');
    });

    it('should detect non-existent dependencies', () => {
      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'First Job',
          type: 'training',
          dependsOn: ['nonexistent'],
          config: {},
        },
      ];

      const result = DAGValidator.validate(jobs);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Job "job1" depends on non-existent job "nonexistent"'
      );
    });
  });

  describe('topologicalSort', () => {
    it('should sort jobs in execution order', () => {
      const jobs: JobConfig[] = [
        {
          id: 'job3',
          name: 'Third Job',
          type: 'validation',
          dependsOn: ['job2'],
          config: {},
        },
        {
          id: 'job1',
          name: 'First Job',
          type: 'preprocessing',
          dependsOn: [],
          config: {},
        },
        {
          id: 'job2',
          name: 'Second Job',
          type: 'training',
          dependsOn: ['job1'],
          config: {},
        },
      ];

      const sorted = DAGValidator.topologicalSort(jobs);
      
      expect(sorted.map(j => j.id)).toEqual(['job1', 'job2', 'job3']);
    });

    it('should handle parallel jobs correctly', () => {
      const jobs: JobConfig[] = [
        {
          id: 'preprocess',
          name: 'Preprocess',
          type: 'preprocessing',
          dependsOn: [],
          config: {},
        },
        {
          id: 'train1',
          name: 'Train Model 1',
          type: 'training',
          dependsOn: ['preprocess'],
          config: {},
        },
        {
          id: 'train2',
          name: 'Train Model 2',
          type: 'training',
          dependsOn: ['preprocess'],
          config: {},
        },
        {
          id: 'ensemble',
          name: 'Ensemble',
          type: 'validation',
          dependsOn: ['train1', 'train2'],
          config: {},
        },
      ];

      const sorted = DAGValidator.topologicalSort(jobs);
      
      // First job should be preprocess
      expect(sorted[0].id).toBe('preprocess');
      
      // train1 and train2 should be before ensemble
      const train1Index = sorted.findIndex(j => j.id === 'train1');
      const train2Index = sorted.findIndex(j => j.id === 'train2');
      const ensembleIndex = sorted.findIndex(j => j.id === 'ensemble');
      
      expect(train1Index).toBeLessThan(ensembleIndex);
      expect(train2Index).toBeLessThan(ensembleIndex);
    });
  });

  describe('getExecutionLevels', () => {
    it('should group jobs by execution level', () => {
      const jobs: JobConfig[] = [
        {
          id: 'preprocess',
          name: 'Preprocess',
          type: 'preprocessing',
          dependsOn: [],
          config: {},
        },
        {
          id: 'train1',
          name: 'Train Model 1',
          type: 'training',
          dependsOn: ['preprocess'],
          config: {},
        },
        {
          id: 'train2',
          name: 'Train Model 2',
          type: 'training',
          dependsOn: ['preprocess'],
          config: {},
        },
        {
          id: 'ensemble',
          name: 'Ensemble',
          type: 'validation',
          dependsOn: ['train1', 'train2'],
          config: {},
        },
      ];

      const levels = DAGValidator.getExecutionLevels(jobs);
      
      expect(levels).toHaveLength(3);
      expect(levels[0].map(j => j.id)).toEqual(['preprocess']);
      expect(levels[1].map(j => j.id).sort()).toEqual(['train1', 'train2']);
      expect(levels[2].map(j => j.id)).toEqual(['ensemble']);
    });
  });
});

describe('DAGOrchestrator', () => {
  let orchestrator: DAGOrchestrator;

  beforeEach(() => {
    orchestrator = new DAGOrchestrator();
  });

  describe('registerHandler', () => {
    it('should register job handlers', () => {
      const handler = jest.fn();
      
      orchestrator.registerHandler('training', handler);
      
      expect(orchestrator['handlers'].has('training')).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute a simple DAG successfully', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ success: true });
      orchestrator.registerHandler('training', mockHandler);

      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'Training Job',
          type: 'training',
          dependsOn: [],
          config: { model: 'test' },
        },
      ];

      const execution = await orchestrator.execute('Test Pipeline', jobs);

      expect(execution.status).toBe('completed');
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(execution.jobs.get('job1')?.status).toBe('completed');
    });

    it('should fail on invalid DAG', async () => {
      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'Job 1',
          type: 'training',
          dependsOn: ['nonexistent'],
          config: {},
        },
      ];

      await expect(orchestrator.execute('Invalid Pipeline', jobs)).rejects.toThrow(
        'Invalid DAG'
      );
    });

    it('should execute jobs in dependency order', async () => {
      const executionOrder: string[] = [];
      
      const handler = jest.fn().mockImplementation(async (config: JobConfig) => {
        executionOrder.push(config.id);
        return { success: true };
      });

      orchestrator.registerHandler('training', handler);
      orchestrator.registerHandler('preprocessing', handler);

      const jobs: JobConfig[] = [
        {
          id: 'job2',
          name: 'Training',
          type: 'training',
          dependsOn: ['job1'],
          config: {},
        },
        {
          id: 'job1',
          name: 'Preprocessing',
          type: 'preprocessing',
          dependsOn: [],
          config: {},
        },
      ];

      await orchestrator.execute('Ordered Pipeline', jobs);

      expect(executionOrder).toEqual(['job1', 'job2']);
    });

    it('should handle job failures and stop execution', async () => {
      const failingHandler = jest.fn().mockRejectedValue(new Error('Job failed'));
      const successHandler = jest.fn().mockResolvedValue({ success: true });

      orchestrator.registerHandler('preprocessing', failingHandler);
      orchestrator.registerHandler('training', successHandler);

      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'Preprocessing',
          type: 'preprocessing',
          dependsOn: [],
          config: {},
        },
        {
          id: 'job2',
          name: 'Training',
          type: 'training',
          dependsOn: ['job1'],
          config: {},
        },
      ];

      await expect(orchestrator.execute('Failing Pipeline', jobs)).rejects.toThrow();

      expect(failingHandler).toHaveBeenCalled();
      expect(successHandler).not.toHaveBeenCalled();
    });

    it('should retry failed jobs', async () => {
      let attempts = 0;
      const retriableHandler = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      });

      orchestrator.registerHandler('training', retriableHandler);

      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'Retriable Job',
          type: 'training',
          dependsOn: [],
          config: {},
          retryConfig: {
            maxRetries: 2,
            retryDelayMs: 100,
          },
        },
      ];

      const execution = await orchestrator.execute('Retry Pipeline', jobs);

      expect(execution.status).toBe('completed');
      expect(retriableHandler).toHaveBeenCalledTimes(3);
    });

    it('should call progress callbacks', async () => {
      const onJobComplete = jest.fn();
      const onProgress = jest.fn();

      const handler = jest.fn().mockResolvedValue({ success: true });
      orchestrator.registerHandler('training', handler);

      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'Job 1',
          type: 'training',
          dependsOn: [],
          config: {},
        },
        {
          id: 'job2',
          name: 'Job 2',
          type: 'training',
          dependsOn: ['job1'],
          config: {},
        },
      ];

      await orchestrator.execute('Callback Pipeline', jobs, {
        onJobComplete,
        onProgress,
      });

      expect(onJobComplete).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(1, 2);
      expect(onProgress).toHaveBeenCalledWith(2, 2);
    });

    it('should provide context to job handlers', async () => {
      let capturedContext: JobContext | null = null;

      const handler = jest.fn().mockImplementation(
        async (config: JobConfig, context: JobContext) => {
          capturedContext = context;
          context.log('Test log message');
          await context.updateProgress(50);
          return { data: 'test' };
        }
      );

      orchestrator.registerHandler('training', handler);

      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'Context Test',
          type: 'training',
          dependsOn: [],
          config: {},
        },
      ];

      const execution = await orchestrator.execute('Context Pipeline', jobs);

      expect(capturedContext).not.toBeNull();
      const logs = execution.jobs.get('job1')?.logs || [];
      const hasTestLog = logs.some(log => log.includes('Test log message'));
      expect(hasTestLog).toBe(true);
    });
  });

  describe('cancel', () => {
    it('should cancel an execution and mark jobs as cancelled', async () => {
      const slowHandler = jest.fn().mockImplementation(async () => {
        // Job that takes a while
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true };
      });

      orchestrator.registerHandler('training', slowHandler);

      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'Slow Job',
          type: 'training',
          dependsOn: [],
          config: {},
        },
        {
          id: 'job2',
          name: 'Second Job',
          type: 'training',
          dependsOn: ['job1'],
          config: {},
        },
      ];

      const executionPromise = orchestrator.execute('Cancellable Pipeline', jobs);

      // Wait for job to start, then cancel
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const execution = Array.from(orchestrator['executions'].values())[0];
      if (execution) {
        await orchestrator.cancel(execution.id);
      }

      try {
        await executionPromise;
      } catch {
        // Expected to fail due to cancellation or job failure
      }

      const finalExecution = Array.from(orchestrator['executions'].values())[0];
      
      // Execution should be marked as cancelled
      expect(finalExecution.status).toBe('cancelled');
      
      // At least one job should be cancelled or pending (job2 shouldn't run)
      const job2Status = finalExecution.jobs.get('job2')?.status;
      expect(['pending', 'cancelled']).toContain(job2Status);
    });
  });

  describe('caching', () => {
    it('should execute jobs even when cache fails', async () => {
      let executionCount = 0;
      const handler = jest.fn().mockImplementation(async () => {
        executionCount++;
        return { result: `execution_${executionCount}`, timestamp: Date.now() };
      });

      orchestrator.registerHandler('training', handler);

      const jobs: JobConfig[] = [
        {
          id: 'cacheable_job',
          name: 'Cacheable Job',
          type: 'training',
          dependsOn: [],
          config: { model: 'gpt2', epochs: 10 },
        },
      ];

      // First execution - should run
      const execution1 = await orchestrator.execute('Cache Test 1', jobs, {
        enableCache: true,
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(execution1.jobs.get('cacheable_job')?.output).toEqual({
        result: 'execution_1',
        timestamp: expect.any(Number),
      });

      // Second execution - without Supabase, cache won't work but execution should still succeed
      const execution2 = await orchestrator.execute('Cache Test 2', jobs, {
        enableCache: true,
      });
      expect(handler).toHaveBeenCalledTimes(2); // Executes again since no DB
      expect(execution2.jobs.get('cacheable_job')?.output).toEqual({
        result: 'execution_2',
        timestamp: expect.any(Number),
      });
      
      // Verify cache errors are logged
      const logs = execution2.jobs.get('cacheable_job')?.logs || [];
      const hasCacheError = logs.some(log => log.includes('CACHE'));
      expect(hasCacheError).toBe(true);
    });

    it('should bypass cache when forceRerun is true', async () => {
      let executionCount = 0;
      const handler = jest.fn().mockImplementation(async () => {
        executionCount++;
        return { result: `execution_${executionCount}` };
      });

      orchestrator.registerHandler('training', handler);

      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'Job 1',
          type: 'training',
          dependsOn: [],
          config: { model: 'gpt2' },
        },
      ];

      // First run
      await orchestrator.execute('Run 1', jobs, { enableCache: true });
      expect(handler).toHaveBeenCalledTimes(1);

      // Second run with forceRerun
      await orchestrator.execute('Run 2', jobs, {
        enableCache: true,
        forceRerun: true,
      });
      expect(handler).toHaveBeenCalledTimes(2); // Should execute again
    });

    it('should invalidate cache when config changes', async () => {
      let executionCount = 0;
      const handler = jest.fn().mockImplementation(async () => {
        executionCount++;
        return { result: `execution_${executionCount}` };
      });

      orchestrator.registerHandler('training', handler);

      const jobs1: JobConfig[] = [
        {
          id: 'job1',
          name: 'Job 1',
          type: 'training',
          dependsOn: [],
          config: { model: 'gpt2', epochs: 10 },
        },
      ];

      const jobs2: JobConfig[] = [
        {
          id: 'job1',
          name: 'Job 1',
          type: 'training',
          dependsOn: [],
          config: { model: 'gpt2', epochs: 20 }, // Different config
        },
      ];

      // First run
      await orchestrator.execute('Run 1', jobs1, { enableCache: true });
      expect(handler).toHaveBeenCalledTimes(1);

      // Second run with different config - should not use cache
      await orchestrator.execute('Run 2', jobs2, { enableCache: true });
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('parallelism control', () => {
    it('should respect parallelism limit', async () => {
      const activeJobs = new Set<string>();
      let maxConcurrent = 0;

      const handler = jest.fn().mockImplementation(async (config: JobConfig) => {
        activeJobs.add(config.id);
        maxConcurrent = Math.max(maxConcurrent, activeJobs.size);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        activeJobs.delete(config.id);
        return { success: true };
      });

      orchestrator.registerHandler('training', handler);

      const jobs: JobConfig[] = [
        {
          id: 'preprocess',
          name: 'Preprocess',
          type: 'training',
          dependsOn: [],
          config: {},
        },
        {
          id: 'train1',
          name: 'Train 1',
          type: 'training',
          dependsOn: ['preprocess'],
          config: {},
        },
        {
          id: 'train2',
          name: 'Train 2',
          type: 'training',
          dependsOn: ['preprocess'],
          config: {},
        },
        {
          id: 'train3',
          name: 'Train 3',
          type: 'training',
          dependsOn: ['preprocess'],
          config: {},
        },
        {
          id: 'train4',
          name: 'Train 4',
          type: 'training',
          dependsOn: ['preprocess'],
          config: {},
        },
      ];

      await orchestrator.execute('Parallel Pipeline', jobs, {
        parallelism: 2, // Limit to 2 concurrent jobs
      });

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should execute jobs in correct levels', async () => {
      const executionLog: Array<{ time: number; jobId: string; action: string }> = [];
      
      const handler = jest.fn().mockImplementation(async (config: JobConfig) => {
        executionLog.push({ time: Date.now(), jobId: config.id, action: 'start' });
        await new Promise(resolve => setTimeout(resolve, 50));
        executionLog.push({ time: Date.now(), jobId: config.id, action: 'end' });
        return { success: true };
      });

      orchestrator.registerHandler('training', handler);

      const jobs: JobConfig[] = [
        {
          id: 'level0',
          name: 'Level 0',
          type: 'training',
          dependsOn: [],
          config: {},
        },
        {
          id: 'level1a',
          name: 'Level 1A',
          type: 'training',
          dependsOn: ['level0'],
          config: {},
        },
        {
          id: 'level1b',
          name: 'Level 1B',
          type: 'training',
          dependsOn: ['level0'],
          config: {},
        },
        {
          id: 'level2',
          name: 'Level 2',
          type: 'training',
          dependsOn: ['level1a', 'level1b'],
          config: {},
        },
      ];

      await orchestrator.execute('Level Pipeline', jobs, { parallelism: 5 });

      // Verify level 0 completes before level 1 starts
      const level0End = executionLog.find(e => e.jobId === 'level0' && e.action === 'end')!;
      const level1aStart = executionLog.find(e => e.jobId === 'level1a' && e.action === 'start')!;
      const level1bStart = executionLog.find(e => e.jobId === 'level1b' && e.action === 'start')!;
      
      expect(level0End.time).toBeLessThanOrEqual(level1aStart.time);
      expect(level0End.time).toBeLessThanOrEqual(level1bStart.time);

      // Verify level 1 completes before level 2 starts
      const level1aEnd = executionLog.find(e => e.jobId === 'level1a' && e.action === 'end')!;
      const level1bEnd = executionLog.find(e => e.jobId === 'level1b' && e.action === 'end')!;
      const level2Start = executionLog.find(e => e.jobId === 'level2' && e.action === 'start')!;
      
      expect(Math.max(level1aEnd.time, level1bEnd.time)).toBeLessThanOrEqual(level2Start.time);
    });
  });

  describe('timeout enforcement', () => {
    it('should timeout long-running jobs', async () => {
      const slowHandler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return { success: true };
      });

      orchestrator.registerHandler('training', slowHandler);

      const jobs: JobConfig[] = [
        {
          id: 'slow_job',
          name: 'Slow Job',
          type: 'training',
          dependsOn: [],
          config: {},
          timeoutMs: 200, // 200ms timeout
        },
      ];

      await expect(
        orchestrator.execute('Timeout Pipeline', jobs)
      ).rejects.toThrow();

      const execution = Array.from(orchestrator['executions'].values())[0];
      expect(execution.jobs.get('slow_job')?.status).toBe('failed');
      expect(execution.jobs.get('slow_job')?.error).toContain('timeout');
    });

    it('should allow jobs without timeout to run indefinitely', async () => {
      const handler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true };
      });

      orchestrator.registerHandler('training', handler);

      const jobs: JobConfig[] = [
        {
          id: 'normal_job',
          name: 'Normal Job',
          type: 'training',
          dependsOn: [],
          config: {},
          // No timeoutMs specified
        },
      ];

      const execution = await orchestrator.execute('No Timeout Pipeline', jobs);

      expect(execution.status).toBe('completed');
      expect(execution.jobs.get('normal_job')?.status).toBe('completed');
    });
  });

  describe('exponential backoff retry', () => {
    it('should use exponential backoff for retries', async () => {
      const retryDelays: number[] = [];
      let lastAttemptTime = 0;
      let attempts = 0;

      const handler = jest.fn().mockImplementation(async () => {
        const now = Date.now();
        if (lastAttemptTime > 0) {
          retryDelays.push(now - lastAttemptTime);
        }
        lastAttemptTime = now;
        attempts++;
        
        if (attempts < 4) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      });

      orchestrator.registerHandler('training', handler);

      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'Retry Job',
          type: 'training',
          dependsOn: [],
          config: {},
          retryConfig: {
            maxRetries: 3,
            retryDelayMs: 100,
            backoffMultiplier: 2,
          },
        },
      ];

      await orchestrator.execute('Backoff Pipeline', jobs);

      expect(retryDelays).toHaveLength(3);
      
      // First retry should be ~100ms
      expect(retryDelays[0]).toBeGreaterThanOrEqual(95);
      expect(retryDelays[0]).toBeLessThan(150);
      
      // Second retry should be ~200ms (100 * 2)
      expect(retryDelays[1]).toBeGreaterThanOrEqual(195);
      expect(retryDelays[1]).toBeLessThan(250);
      
      // Third retry should be ~400ms (100 * 2^2)
      expect(retryDelays[2]).toBeGreaterThanOrEqual(395);
      expect(retryDelays[2]).toBeLessThan(500);
    });
  });

  describe('job context', () => {
    it('should allow jobs to access outputs from dependencies', async () => {
      const preprocessHandler = jest.fn().mockResolvedValue({
        datasetPath: '/tmp/processed',
        recordCount: 1000,
      });

      const trainHandler = jest.fn().mockImplementation(
        async (config: JobConfig, context: JobContext) => {
          const preprocessOutput = context.getJobOutput('preprocess') as {
            datasetPath: string;
            recordCount: number;
          };
          
          expect(preprocessOutput).toBeDefined();
          expect(preprocessOutput.datasetPath).toBe('/tmp/processed');
          expect(preprocessOutput.recordCount).toBe(1000);
          
          return { modelPath: '/tmp/model', accuracy: 0.95 };
        }
      );

      orchestrator.registerHandler('preprocessing', preprocessHandler);
      orchestrator.registerHandler('training', trainHandler);

      const jobs: JobConfig[] = [
        {
          id: 'preprocess',
          name: 'Preprocess',
          type: 'preprocessing',
          dependsOn: [],
          config: {},
        },
        {
          id: 'train',
          name: 'Train',
          type: 'training',
          dependsOn: ['preprocess'],
          config: {},
        },
      ];

      await orchestrator.execute('Context Pipeline', jobs);

      expect(trainHandler).toHaveBeenCalled();
    });

    it('should track execution logs per job', async () => {
      const handler = jest.fn().mockImplementation(
        async (config: JobConfig, context: JobContext) => {
          context.log('Starting job');
          context.log('Processing data');
          context.log('Saving results');
          return { success: true };
        }
      );

      orchestrator.registerHandler('training', handler);

      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'Logging Job',
          type: 'training',
          dependsOn: [],
          config: {},
        },
      ];

      const execution = await orchestrator.execute('Logging Pipeline', jobs);
      const jobExecution = execution.jobs.get('job1');

      const logs = jobExecution?.logs || [];
      expect(logs.some(log => log.includes('Starting job'))).toBe(true);
      expect(logs.some(log => log.includes('Processing data'))).toBe(true);
      expect(logs.some(log => log.includes('Saving results'))).toBe(true);
    });

    it('should track progress updates', async () => {
      const progressUpdates: number[] = [];
      
      const handler = jest.fn().mockImplementation(
        async (config: JobConfig, context: JobContext) => {
          await context.updateProgress(0);
          await context.updateProgress(25);
          await context.updateProgress(50);
          await context.updateProgress(75);
          await context.updateProgress(100);
          return { success: true };
        }
      );

      orchestrator.registerHandler('training', handler);

      const jobs: JobConfig[] = [
        {
          id: 'job1',
          name: 'Progress Job',
          type: 'training',
          dependsOn: [],
          config: {},
        },
      ];

      await orchestrator.execute('Progress Pipeline', jobs, {
        onProgress: (completed, total) => {
          progressUpdates.push((completed / total) * 100);
        },
      });

      expect(progressUpdates).toContain(100);
    });
  });
});
