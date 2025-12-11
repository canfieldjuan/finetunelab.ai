/**
 * Manual Checkpoint System Validation
 * 
 * Validates checkpoint functionality without test framework
 */

import { StateSerializer } from './checkpoint-manager';
import type { DAGExecution, JobExecution } from './dag-orchestrator';

console.log('='.repeat(80));
console.log('CHECKPOINT SYSTEM VALIDATION');
console.log('='.repeat(80));

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    testsFailed++;
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error}`);
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toHaveLength(expected: number) {
      if (!Array.isArray(actual) || actual.length !== expected) {
        throw new Error(`Expected length ${expected}, got ${Array.isArray(actual) ? actual.length : 'not an array'}`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
    },
    toBeUndefined() {
      if (actual !== undefined) {
        throw new Error(`Expected undefined, got ${actual}`);
      }
    },
  };
}

// Create mock execution
function createMockExecution(): DAGExecution {
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
}

console.log('\n--- StateSerializer Tests ---\n');

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
});

test('deserialize() converts serialized state back to DAGExecution', () => {
  const execution = createMockExecution();
  const serialized = StateSerializer.serialize(execution);
  const deserialized = StateSerializer.deserialize(serialized);

  expect(deserialized.id).toBe(execution.id);
  expect(deserialized.name).toBe(execution.name);
  expect(deserialized.status).toBe(execution.status);
  expect(deserialized.jobs.size).toBe(2);
});

test('serialize/deserialize round-trip preserves data', () => {
  const original = createMockExecution();
  const roundTrip = StateSerializer.deserialize(StateSerializer.serialize(original));

  expect(roundTrip.id).toBe(original.id);
  expect(roundTrip.name).toBe(original.name);
  expect(roundTrip.status).toBe(original.status);
  expect(roundTrip.jobs.size).toBe(original.jobs.size);

  const originalJob1 = original.jobs.get('job1');
  const roundTripJob1 = roundTrip.jobs.get('job1');
  expect(JSON.stringify(roundTripJob1?.output)).toBe(JSON.stringify(originalJob1?.output));
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
  expect(JSON.stringify(job?.output)).toBe(JSON.stringify(complexOutput));
});

console.log('\n--- Integration Tests ---\n');

test('Full checkpoint workflow', () => {
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

  const serialized = StateSerializer.serialize(execution);
  expect(serialized.jobs).toHaveLength(1);

  const checkpoint = {
    id: 'cp_integration',
    execution_id: execution.id,
    name: 'Integration Checkpoint',
    trigger: 'manual' as const,
    state: serialized,
    job_configs: [],
    created_at: new Date().toISOString(),
  };

  expect(StateSerializer.validate(checkpoint)).toBe(true);

  const restored = StateSerializer.deserialize(checkpoint.state);
  expect(restored.id).toBe(execution.id);
  expect(restored.jobs.size).toBe(1);

  const restoredJob = restored.jobs.get('train');
  expect(restoredJob?.status).toBe('completed');
  expect(JSON.stringify(restoredJob?.output)).toBe(JSON.stringify({ model: 'model_v1', accuracy: 0.92 }));
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

  const serialized = StateSerializer.serialize(execution);
  const restored = StateSerializer.deserialize(serialized);

  expect(restored.jobs.size).toBe(4);
  
  const restoredJob1 = restored.jobs.get('job1');
  expect(restoredJob1?.status).toBe('completed');

  const restoredJob4 = restored.jobs.get('job4');
  expect(restoredJob4?.status).toBe('failed');
  expect(restoredJob4?.error).toBe('Job failed due to error');
  expect(restoredJob4?.attempt).toBe(2);
});

console.log('\n--- Edge Cases ---\n');

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
  expect(JSON.stringify(job?.output)).toBe(JSON.stringify({
    message: 'Test with "quotes" and \\backslashes\\ and \nnewlines',
    unicode: '测试 🚀',
  }));
});

// Summary
console.log('\n' + '='.repeat(80));
console.log('TEST SUMMARY');
console.log('='.repeat(80));
console.log(`Total tests:  ${testsRun}`);
console.log(`✅ Passed:     ${testsPassed}`);
console.log(`❌ Failed:     ${testsFailed}`);
console.log(`Success rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);
console.log('='.repeat(80));

if (testsFailed === 0) {
  console.log('\n🎉 All checkpoint system tests passed!');
} else {
  console.error(`\n⚠️  ${testsFailed} test(s) failed`);
  process.exit(1);
}
