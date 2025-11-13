// Dataset Manager Tool - Advanced Filtering Tests
// Date: October 21, 2025

import dotenv from 'dotenv';
import path from 'path';

async function main() {
  // Load environment variables first
  const envPath = path.resolve(__dirname, '../../../.env');
  console.log(`[Setup] Loading environment variables from: ${envPath}`);
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    console.error(`[Setup] FATAL: Could not load .env file from ${envPath}`, result.error);
    process.exit(1);
  }
  console.log('[Setup] Environment variables loaded successfully.');

  // Dynamically import and run the tests
  const { runAdvancedFilterTests } = await import('./test-logic');
  await runAdvancedFilterTests();
}

main();
