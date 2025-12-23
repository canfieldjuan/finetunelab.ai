// This file contains valid TypeScript to test that CI passes

/**
 * Simple test function to verify CI/CD pipeline
 */
export const testCIPipeline = (): string => {
  return 'CI/CD pipeline test - this should pass all checks';
};

/**
 * Test that type checking works correctly
 */
export const validTypeScript = (input: string): number => {
  return input.length;
};

// This file should pass:
// ✅ Lint check
// ✅ Type check
// ✅ Build check
