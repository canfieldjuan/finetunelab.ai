
import dotenv from 'dotenv';
import path from 'path';
import { testDatasetManager } from './test';

// Load environment variables from the root .env file
const envPath = path.resolve(__dirname, '../../../../.env');
console.log(`Loading environment variables from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file', result.error);
  process.exit(1);
}

console.log('Environment variables loaded. Starting tests...');

// Run the tests
testDatasetManager().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
