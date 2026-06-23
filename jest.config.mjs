import nextJest from 'next/jest.js';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const createJestConfig = nextJest({
  dir: './',
});

// Vitest-style suites (they `import ... from 'vitest'`) are run by the dedicated vitest
// runner (`npm run test:vitest`), not jest. The jest<->vitest compat shim can't fully
// emulate vitest semantics (vi.mock hoisting, import.meta, etc.), so collect those files
// and exclude them from the jest run to keep `npm test` (jest) green and unambiguous.
function collectVitestTestPatterns(root) {
  const skipDirs = new Set(['node_modules', '.next', '.git', 'worktrees', 'coverage', 'dist', '.turbo']);
  const patterns = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(join(dir, entry.name));
      } else if (/\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
        const full = join(dir, entry.name);
        try {
          const src = readFileSync(full, 'utf8');
          if (/from\s+['"]vitest['"]/.test(src) || /import\(\s*['"]vitest['"]\s*\)/.test(src)) {
            const rel = full.slice(root.length + 1).replace(/\\/g, '/');
            // Escape regex metacharacters (paths contain [id], [jobId], etc.)
            patterns.push('/' + rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
          }
        } catch {
          /* ignore unreadable files */
        }
      }
    }
  };
  walk(root);
  return patterns;
}

const vitestIgnorePatterns = collectVitestTestPatterns(process.cwd());

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
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
    // Skip manual test scripts (not Jest tests)
    '/lib/tools/web-search/__tests__/test-storage.ts',
    // Auto-excluded vitest-style suites (run via `npm run test:vitest`)
    ...vitestIgnorePatterns,
    // Skip E2E and integration tests that require running server/Supabase
    ...(!process.env.RUN_INTEGRATION_TESTS ? [
      '/__tests__/integration/',
      '/tests/integration/',
    ] : []),
  ],
  // Transform ignore - Allow transforming ES modules from node_modules
  transformIgnorePatterns: [
    '/node_modules/(?!(cheerio|htmlparser2|dom-serializer|domutils|entities)/)',
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
