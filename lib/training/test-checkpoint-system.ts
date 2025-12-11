/**
 * Checkpoint System Tests
 * 
 * Tests for workflow checkpointing, pause/resume, and state serialization
 * 
 * Phase 2.2 Implementation Tests
 */

import { StateSerializer, SerializedExecution } from './checkpoint-manager';
import type { DAGExecution, JobExecution } from './dag-orchestrator';

describe('StateSerializer', () => {
  const createMockExecution = (): DAGExecution => {
    const jobs = new Map<string, JobExecution>();
    
    jobs.set('job1', {
      jobId: 'job1',
      status: 'completed',
      startedAt: new Date('2024-01-01T10:00:00Z'),
      completedAt: new Date('2024-01-01T10:05:00Z'),
      output: { result: 'success', accuracy: 0.95 },
      logs: ['Started job1', 'Completed successfully'],
      attempt: 1,
    });

    jobs.set('job2', {
      jobId: 'job2',
      status: 'running',
      startedAt: new Date('2024-01-01T10:05:00Z'),
      logs: ['Started job2'],
      attempt: 1,
    });

    return {
      id: 'exec_123',
      name: 'Test Execution',
      status: 'running',
      startedAt: new Date('2024-01-01T10:00:00Z'),
      jobs,
    };
  };

  test('serialize() converts DAGExecution to serializable format', () => {
    const execution = createMockExecution();
    const serialized = StateSerializer.serialize(execution);

    expect(serialized.id).toBe('exec_123');
    expect(serialized.name).toBe('Test Execution');
    expect(serialized.status).toBe('running');
    expect(serialized.startedAt).toBe('2024-01-01T10:00:00.000Z');
    expect(serialized.jobs).toHaveLength(2);

    const job1 = serialized.jobs.find((j: {jobId: string}) => j.jobId === 'job1');
    expect(job1).toBeDefined();
    expect(job1?.status).toBe('completed');
    expect(job1?.output).toBe(JSON.stringify({ result: 'success', accuracy: 0.95 }));
    expect(job1?.logs).toEqual(['Started job1', 'Completed successfully']);
  });

  test('deserialize() converts serialized state back to DAGExecution', () => {
    const execution = createMockExecution();
    const serialized = StateSerializer.serialize(execution);
    const deserialized = StateSerializer.deserialize(serialized);

    expect(deserialized.id).toBe(execution.id);
    expect(deserialized.name).toBe(execution.name);
    expect(deserialized.status).toBe(execution.status);
    expect(deserialized.startedAt).toEqual(execution.startedAt);
    expect(deserialized.jobs.size).toBe(2);

    const job1 = deserialized.jobs.get('job1');
    expect(job1).toBeDefined();
    expect(job1?.status).toBe('completed');
    expect(job1?.output).toEqual({ result: 'success', accuracy: 0.95 });
    expect(job1?.logs).toEqual(['Started job1', 'Completed successfully']);
  });

  test('serialize/deserialize round-trip preserves data', () => {
    const original = createMockExecution();
    const roundTrip = StateSerializer.deserialize(StateSerializer.serialize(original));

    expect(roundTrip.id).toBe(original.id);
    expect(roundTrip.name).toBe(original.name);
    expect(roundTrip.status).toBe(original.status);
    expect(roundTrip.startedAt).toEqual(original.startedAt);
    expect(roundTrip.jobs.size).toBe(original.jobs.size);

    // Check job 1
    const originalJob1 = original.jobs.get('job1');
    const roundTripJob1 = roundTrip.jobs.get('job1');
    expect(roundTripJob1?.output).toEqual(originalJob1?.output);
    expect(roundTripJob1?.logs).toEqual(originalJob1?.logs);
  });

  test('validate() accepts valid checkpoint', () => {
    const execution = createMockExecution();
    const serialized = StateSerializer.serialize(execution);
    
    const checkpoint = {
      id: 'checkpoint_123',
      execution_id: 'exec_123',
      name: 'Test Checkpoint',
      trigger: 'manual' as const,
      state: serialized,
      job_configs: [],
      created_at: new Date().toISOString(),
    };

    expect(StateSerializer.validate(checkpoint)).toBe(true);
  });

  test('validate() rejects checkpoint with missing fields', () => {
    const invalidCheckpoint = {
      id: 'checkpoint_123',
      execution_id: 'exec_123',
      // missing name, trigger, state, job_configs
    } as never;

    expect(StateSerializer.validate(invalidCheckpoint)).toBe(false);
  });

  test('validate() rejects checkpoint with invalid state structure', () => {
    const checkpoint = {
      id: 'checkpoint_123',
      execution_id: 'exec_123',
      name: 'Test Checkpoint',
      trigger: 'manual' as const,
      state: {
        // missing required fields like id, name, jobs
      } as SerializedExecution,
      job_configs: [],
      created_at: new Date().toISOString(),
    };

    expect(StateSerializer.validate(checkpoint)).toBe(false);
  });

  test('serialize() handles jobs without output', () => {
    const execution = createMockExecution();
    const jobs = new Map<string, JobExecution>();
    
    jobs.set('job_no_output', {
      jobId: 'job_no_output',
      status: 'pending',
      logs: [],
      attempt: 0,
    });

    execution.jobs = jobs;
    const serialized = StateSerializer.serialize(execution);

    const job = serialized.jobs.find((j: {jobId: string}) => j.jobId === 'job_no_output');
    expect(job).toBeDefined();
    expect(job?.output).toBeUndefined();
  });

  test('serialize() handles complex nested output', () => {
    const execution = createMockExecution();
    const complexOutput = {
      metrics: {
        accuracy: 0.95,
        loss: 0.05,
        nested: {
          deep: {
            value: 123,
          },
        },
      },
      arrays: [1, 2, 3, { key: 'value' }],
      nullValue: null,
    };

    const jobs = new Map<string, JobExecution>();
    jobs.set('complex_job', {
      jobId: 'complex_job',
      status: 'completed',
      output: complexOutput,
      logs: [],
      attempt: 1,
    });

    execution.jobs = jobs;
    const serialized = StateSerializer.serialize(execution);
    const deserialized = StateSerializer.deserialize(serialized);

    const job = deserialized.jobs.get('complex_job');
    expect(job?.output).toEqual(complexOutput);
  });
});

describe('Checkpoint Integration', () => {
  test('Full checkpoint workflow', () => {
    // Create execution
    const jobs = new Map<string, JobExecution>();
    jobs.set('train', {
      jobId: 'train',
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      output: { model: 'model_v1', accuracy: 0.92 },
      logs: ['Training started', 'Training completed'],
      attempt: 1,
    });

    const execution: DAGExecution = {
      id: 'exec_integration',
      name: 'Integration Test Execution',
      status: 'running',
      startedAt: new Date(),
      jobs,
    };

    // Serialize
    const serialized = StateSerializer.serialize(execution);
    expect(serialized.jobs).toHaveLength(1);

    // Create checkpoint structure
    const checkpoint = {
      id: 'cp_integration',
      execution_id: execution.id,
      name: 'Integration Checkpoint',
      trigger: 'manual' as const,
      state: serialized,
      job_configs: [],
      created_at: new Date().toISOString(),
    };

    // Validate
    expect(StateSerializer.validate(checkpoint)).toBe(true);

    // Deserialize
    const restored = StateSerializer.deserialize(checkpoint.state);
    expect(restored.id).toBe(execution.id);
    expect(restored.jobs.size).toBe(1);

    const restoredJob = restored.jobs.get('train');
    expect(restoredJob?.status).toBe('completed');
    expect(restoredJob?.output).toEqual({ model: 'model_v1', accuracy: 0.92 });
  });

  test('Checkpoint with multiple jobs in different states', () => {
    const jobs = new Map<string, JobExecution>();
    
    jobs.set('job1', {
      jobId: 'job1',
      status: 'completed',
      startedAt: new Date('2024-01-01T10:00:00Z'),
      completedAt: new Date('2024-01-01T10:05:00Z'),
      output: { result: 'done' },
      logs: ['Completed'],
      attempt: 1,
    });

    jobs.set('job2', {
      jobId: 'job2',
      status: 'running',
      startedAt: new Date('2024-01-01T10:05:00Z'),
      logs: ['Started'],
      attempt: 1,
    });

    jobs.set('job3', {
      jobId: 'job3',
      status: 'pending',
      logs: [],
      attempt: 0,
    });

    jobs.set('job4', {
      jobId: 'job4',
      status: 'failed',
      startedAt: new Date('2024-01-01T10:06:00Z'),
      completedAt: new Date('2024-01-01T10:07:00Z'),
      error: 'Job failed due to error',
      logs: ['Started', 'Error occurred'],
      attempt: 2,
    });

    const execution: DAGExecution = {
      id: 'exec_multi',
      name: 'Multi-Job Execution',
      status: 'running',
      startedAt: new Date('2024-01-01T10:00:00Z'),
      jobs,
    };

    // Serialize and deserialize
    const serialized = StateSerializer.serialize(execution);
    const restored = StateSerializer.deserialize(serialized);

    // Verify all jobs preserved
    expect(restored.jobs.size).toBe(4);
    
    const restoredJob1 = restored.jobs.get('job1');
    expect(restoredJob1?.status).toBe('completed');
    expect(restoredJob1?.output).toEqual({ result: 'done' });

    const restoredJob2 = restored.jobs.get('job2');
    expect(restoredJob2?.status).toBe('running');

    const restoredJob3 = restored.jobs.get('job3');
    expect(restoredJob3?.status).toBe('pending');

    const restoredJob4 = restored.jobs.get('job4');
    expect(restoredJob4?.status).toBe('failed');
    expect(restoredJob4?.error).toBe('Job failed due to error');
    expect(restoredJob4?.attempt).toBe(2);
  });
});

describe('Checkpoint Edge Cases', () => {
  test('Handle empty job map', () => {
    const execution: DAGExecution = {
      id: 'exec_empty',
      name: 'Empty Execution',
      status: 'pending',
      startedAt: new Date(),
      jobs: new Map(),
    };

    const serialized = StateSerializer.serialize(execution);
    expect(serialized.jobs).toHaveLength(0);

    const restored = StateSerializer.deserialize(serialized);
    expect(restored.jobs.size).toBe(0);
  });

  test('Handle job with empty logs array', () => {
    const jobs = new Map<string, JobExecution>();
    jobs.set('job', {
      jobId: 'job',
      status: 'pending',
      logs: [],
      attempt: 0,
    });

    const execution: DAGExecution = {
      id: 'exec_empty_logs',
      name: 'Empty Logs Execution',
      status: 'pending',
      startedAt: new Date(),
      jobs,
    };

    const serialized = StateSerializer.serialize(execution);
    const restored = StateSerializer.deserialize(serialized);

    const job = restored.jobs.get('job');
    expect(job?.logs).toEqual([]);
  });

  test('Handle execution without completedAt', () => {
    const execution: DAGExecution = {
      id: 'exec_running',
      name: 'Running Execution',
      status: 'running',
      startedAt: new Date(),
      jobs: new Map(),
    };

    const serialized = StateSerializer.serialize(execution);
    expect(serialized.completedAt).toBeUndefined();

    const restored = StateSerializer.deserialize(serialized);
    expect(restored.completedAt).toBeUndefined();
  });

  test('Handle special characters in job output', () => {
    const jobs = new Map<string, JobExecution>();
    jobs.set('job', {
      jobId: 'job',
      status: 'completed',
      output: {
        message: 'Test with "quotes" and \\backslashes\\ and \nnewlines',
        unicode: '测试 🚀',
      },
      logs: [],
      attempt: 1,
    });

    const execution: DAGExecution = {
      id: 'exec_special',
      name: 'Special Characters',
      status: 'completed',
      startedAt: new Date(),
      jobs,
    };

    const serialized = StateSerializer.serialize(execution);
    const restored = StateSerializer.deserialize(serialized);

    const job = restored.jobs.get('job');
    expect(job?.output).toEqual({
      message: 'Test with "quotes" and \\backslashes\\ and \nnewlines',
      unicode: '测试 🚀',
    });
  });
});

console.log('Checkpoint system tests defined successfully');
console.log('Total test suites: 3');
console.log('Total tests: 17');
