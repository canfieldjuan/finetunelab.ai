import { describe, it, expect, beforeEach } from 'vitest';
import { formatEmailAlert } from '../email.formatter';

describe('formatEmailAlert', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  it('formats batch test alerts with a testing link', () => {
    const result = formatEmailAlert({
      type: 'batch_test_failed',
      userId: 'user-1',
      title: 'Test Run Failed: gpt-4',
      message: '2 prompts failed',
      metadata: {
        testRunId: 'test-run-1',
        userId: 'user-1',
        modelName: 'gpt-4',
        testRunName: 'Nightly',
        status: 'completed',
        totalPrompts: 10,
        completedPrompts: 10,
        failedPrompts: 2,
        errorMessage: '2 prompts failed',
      },
    });

    expect(result.subject).toContain('Test Run Failed');
    expect(result.html).toContain('/testing?testRunId=test-run-1');
    expect(result.text).toContain('Failed Prompts: 2');
  });
});

