import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
    // Integration / e2e suites make real HTTP calls to a running server (localhost:3000)
    // and/or need provider secrets, so they are NOT part of the unit gate. Run them
    // separately via `npm run test:e2e` against a live server.
    exclude: [
      ...configDefaults.exclude,
      '**/__tests__/integration/**',
      '**/*.integration.test.ts',
      '**/*.e2e.test.ts',
      '**/__tests__/**/e2e.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        '**/*.config.*',
        '**/types.ts',
        '**/__tests__/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
