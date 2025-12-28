
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log('🔍 Checking Trace Environment Variables...');

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const enableTracing = process.env.ENABLE_TRACING;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log(`NEXT_PUBLIC_BASE_URL: ${baseUrl || '(not set)'}`);
console.log(`NEXT_PUBLIC_APP_URL: ${appUrl || '(not set)'}`);
console.log(`ENABLE_TRACING: ${enableTracing || '(not set, defaults to true)'}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? 'Set (starts with ' + serviceKey.substring(0, 10) + '...)' : 'NOT SET'}`);

if (!baseUrl && appUrl) {
  console.log('⚠️ NEXT_PUBLIC_BASE_URL is missing, but NEXT_PUBLIC_APP_URL is set.');
  console.log('   trace.service.ts defaults to http://localhost:3000.');
  console.log('   If the app is running on a different port (e.g. 4000), traces will fail.');
}
