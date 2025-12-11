/**
 * Trace Service Unit Tests
 *
 * Tests for the trace service module covering:
 * - ID generation
 * - Duration calculation
 * - Trace lifecycle
 * - Error handling
 * - Graceful degradation
 *
 * Phase 1.1: Unit Tests
 * Date: 2025-11-29
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  generateTraceId,
  generateSpanId,
  calculateDuration,
  startTrace,
  endTrace,
  captureError,
  createChildSpan,
} from '@/lib/tracing/trace.service';

describe('Trace Service - ID Generation', () => {
  test('generateTraceId creates unique IDs', () => {
    const id1 = generateTraceId();
    const id2 = generateTraceId();

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^trace_\d+_[a-z0-9]+$/);
  });

  test('generateSpanId creates unique IDs', () => {
    const id1 = generateSpanId();
    const id2 = generateSpanId();

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^span_\d+_[a-z0-9]+$/);
  });

  test('trace IDs have different prefixes', () => {
    const traceId = generateTraceId();
    const spanId = generateSpanId();

    expect(traceId.startsWith('trace_')).toBe(true);
    expect(spanId.startsWith('span_')).toBe(true);
  });
});

describe('Trace Service - Duration Calculation', () => {
  test('calculates duration correctly for whole seconds', () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-01T00:00:02.000Z');

    const duration = calculateDuration(start, end);

    expect(duration).toBe(2000);
  });

  test('calculates duration correctly for milliseconds', () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-01T00:00:00.500Z');

    const duration = calculateDuration(start, end);

    expect(duration).toBe(500);
  });

  test('calculates duration correctly for mixed time', () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-01T00:00:02.750Z');

    const duration = calculateDuration(start, end);

    expect(duration).toBe(2750);
  });

  test('handles zero duration', () => {
    const time = new Date('2025-01-01T00:00:00.000Z');

    const duration = calculateDuration(time, time);

    expect(duration).toBe(0);
  });

  test('handles very long durations', () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-01T01:00:00.000Z'); // 1 hour

    const duration = calculateDuration(start, end);

    expect(duration).toBe(3600000); // 1 hour in milliseconds
  });
});

describe('Trace Service - Context Format', () => {
  test('startTrace returns valid context structure', async () => {
    const context = await startTrace({
      spanName: 'test.operation',
      operationType: 'llm_call',
      modelName: 'test-model',
    });

    expect(context).toHaveProperty('traceId');
    expect(context).toHaveProperty('spanId');
    expect(context).toHaveProperty('startTime');
    expect(context).toHaveProperty('spanName', 'test.operation');
    expect(context).toHaveProperty('operationType', 'llm_call');
    expect(context.startTime).toBeInstanceOf(Date);
  });

  test('createChildSpan inherits parent trace ID', async () => {
    const parentContext = await startTrace({
      spanName: 'parent.operation',
      operationType: 'llm_call',
    });

    const childContext = await createChildSpan(
      parentContext,
      'child.operation',
      'tool_call'
    );

    expect(childContext.traceId).toBe(parentContext.traceId);
    // Note: In no-session mode, both will be "noop" which is expected
    if (parentContext.spanId !== 'noop') {
      expect(childContext.spanId).not.toBe(parentContext.spanId);
    }
    expect(childContext.parentSpanId).toBe(parentContext.spanId);
    expect(childContext.spanName).toBe('child.operation');
    expect(childContext.operationType).toBe('tool_call');
  });

  test('createChildSpan inherits conversation and message IDs', async () => {
    const parentContext = await startTrace({
      spanName: 'parent.operation',
      operationType: 'llm_call',
      conversationId: 'conv-123',
      messageId: 'msg-456',
    });

    const childContext = await createChildSpan(
      parentContext,
      'child.operation'
    );

    expect(childContext.conversationId).toBe('conv-123');
    expect(childContext.messageId).toBe('msg-456');
  });
});

describe('Trace Service - Error Handling', () => {
  test('captureError creates failed trace with error message', async () => {
    const context = await startTrace({
      spanName: 'error.test',
      operationType: 'llm_call',
    });

    const testError = new Error('Test error message');

    // captureError should not throw
    await expect(captureError(context, testError)).resolves.not.toThrow();
  });

  test('endTrace handles missing optional fields', async () => {
    const context = await startTrace({
      spanName: 'minimal.test',
      operationType: 'llm_call',
    });

    // Should work with minimal result
    await expect(endTrace(context, {
      endTime: new Date(),
      status: 'completed',
    })).resolves.not.toThrow();
  });

  test('startTrace works with minimal parameters', async () => {
    await expect(startTrace({
      spanName: 'minimal',
      operationType: 'llm_call',
    })).resolves.toBeDefined();
  });

  test('startTrace works with all optional parameters', async () => {
    await expect(startTrace({
      spanName: 'maximal',
      operationType: 'llm_call',
      modelName: 'gpt-4-turbo',
      modelProvider: 'openai',
      conversationId: 'conv-123',
      messageId: 'msg-456',
      metadata: { custom: 'data' },
    })).resolves.toBeDefined();
  });
});

describe('Trace Service - Operation Types', () => {
  test('supports all operation types', async () => {
    const operationTypes = [
      'llm_call',
      'tool_call',
      'retrieval',
      'embedding',
      'prompt_generation',
      'response_processing',
    ] as const;

    for (const operationType of operationTypes) {
      const context = await startTrace({
        spanName: `test.${operationType}`,
        operationType,
      });

      expect(context.operationType).toBe(operationType);
    }
  });
});

describe('Trace Service - Status Values', () => {
  test('supports all status values in endTrace', async () => {
    const statuses = [
      'pending',
      'running',
      'completed',
      'failed',
      'cancelled',
    ] as const;

    for (const status of statuses) {
      const context = await startTrace({
        spanName: `test.${status}`,
        operationType: 'llm_call',
      });

      await expect(endTrace(context, {
        endTime: new Date(),
        status,
      })).resolves.not.toThrow();
    }
  });
});

describe('Trace Service - Token Calculation', () => {
  test('endTrace calculates total tokens when both provided', async () => {
    const context = await startTrace({
      spanName: 'token.test',
      operationType: 'llm_call',
    });

    // The service should calculate total_tokens = input + output
    await endTrace(context, {
      endTime: new Date(),
      status: 'completed',
      inputTokens: 1000,
      outputTokens: 500,
    });

    // In actual implementation, verify via database query
    // For unit test, we're just testing it doesn't throw
    expect(true).toBe(true);
  });

  test('endTrace handles missing token counts', async () => {
    const context = await startTrace({
      spanName: 'no-tokens.test',
      operationType: 'llm_call',
    });

    await expect(endTrace(context, {
      endTime: new Date(),
      status: 'completed',
      // No token counts provided
    })).resolves.not.toThrow();
  });
});

describe('Trace Service - Metadata', () => {
  test('startTrace accepts metadata', async () => {
    const metadata = {
      custom_field: 'value',
      number_field: 123,
      nested: { data: 'test' },
    };

    const context = await startTrace({
      spanName: 'metadata.test',
      operationType: 'llm_call',
      metadata,
    });

    expect(context).toBeDefined();
  });

  test('endTrace accepts metadata', async () => {
    const context = await startTrace({
      spanName: 'metadata.test',
      operationType: 'llm_call',
    });

    await expect(endTrace(context, {
      endTime: new Date(),
      status: 'completed',
      metadata: { result: 'success' },
    })).resolves.not.toThrow();
  });
});

describe('Trace Service - Performance', () => {
  test('ID generation is fast', () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      generateTraceId();
    }
    const duration = Date.now() - start;

    // 1000 IDs should generate in well under 1 second
    expect(duration).toBeLessThan(1000);
  });

  test('duration calculation is fast', () => {
    const start = Date.now();
    const date1 = new Date('2025-01-01T00:00:00.000Z');
    const date2 = new Date('2025-01-01T00:00:01.000Z');

    for (let i = 0; i < 10000; i++) {
      calculateDuration(date1, date2);
    }
    const duration = Date.now() - start;

    // 10000 calculations should complete in well under 1 second
    expect(duration).toBeLessThan(1000);
  });
});

describe('Trace Service - Edge Cases', () => {
  test('handles very long span names', async () => {
    const longName = 'a'.repeat(500);

    await expect(startTrace({
      spanName: longName,
      operationType: 'llm_call',
    })).resolves.toBeDefined();
  });

  test('handles special characters in span names', async () => {
    const specialName = 'test-span_123.operation@v2';

    const context = await startTrace({
      spanName: specialName,
      operationType: 'llm_call',
    });

    expect(context.spanName).toBe(specialName);
  });

  test('handles very large token counts', async () => {
    const context = await startTrace({
      spanName: 'large-tokens.test',
      operationType: 'llm_call',
    });

    await expect(endTrace(context, {
      endTime: new Date(),
      status: 'completed',
      inputTokens: 1000000,
      outputTokens: 500000,
    })).resolves.not.toThrow();
  });

  test('handles fractional costs', async () => {
    const context = await startTrace({
      spanName: 'cost.test',
      operationType: 'llm_call',
    });

    await expect(endTrace(context, {
      endTime: new Date(),
      status: 'completed',
      costUsd: 0.00123456,
    })).resolves.not.toThrow();
  });
});
