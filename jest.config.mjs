import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/worktrees/',
    // Skip llama.cpp subdirectory (embedded project with own test setup)
    '/lib/training/llama.cpp/',
    // Skip E2E and integration tests that require running server/Supabase
    ...(!process.env.RUN_INTEGRATION_TESTS ? [
      '/__tests__/integration/',
      '/tests/integration/',
    ] : []),
  ],
  globals: {
    fetch: global.fetch,
  },
};

const jestConfig = createJestConfig(customJestConfig);

export default jestConfig;
