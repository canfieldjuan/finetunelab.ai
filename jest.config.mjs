import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Map vitest to jest globals for compatibility
    '^vitest$': '<rootDir>/jest-vitest-compat.js',
  },
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/worktrees/',
    // Skip llama.cpp subdirectory (embedded project with own test setup)
    '/lib/training/llama.cpp/',
    // Skip Vitest-based tests (use separate vitest runner for these)
    '/app/api/batch-testing/.*/__tests__/',
    '/app/api/analytics/.*/__tests__/',
    '/app/api/training/.*/__tests__/',
    '/lib/tools/analytics-export/__tests__/',
    '/lib/alerts/formatters/__tests__/',
    // Skip E2E and integration tests that require running server/Supabase
    ...(!process.env.RUN_INTEGRATION_TESTS ? [
      '/__tests__/integration/',
      '/tests/integration/',
    ] : []),
  ],
  // Transform ignore - Skip Vitest tests (we use Jest)
  transformIgnorePatterns: [
    '/node_modules/',
    '\\.vitest\\.',
  ],
  // Global setup to skip tests importing vitest
  globalSetup: undefined,
  globals: {
    fetch: global.fetch,
  },
};

const jestConfig = createJestConfig(customJestConfig);

export default jestConfig;
