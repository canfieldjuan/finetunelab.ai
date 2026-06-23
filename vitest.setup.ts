/**
 * Vitest Setup File
 * Global test configuration and mocks
 */

import { vi } from 'vitest';

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
// Fallback so any code that reads the key directly doesn't throw "Missing credentials".
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';

// Mock the OpenAI SDK (mirrors jest.setup.js) so constructing a client in unit tests
// doesn't require real credentials and returns a deterministic judge-style response.
vi.mock('openai', () => {
  const mockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ score: 8, reasoning: 'Test reasoning' }) } }],
        }),
      },
    },
  }));
  return { __esModule: true, default: mockOpenAI, OpenAI: mockOpenAI };
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
