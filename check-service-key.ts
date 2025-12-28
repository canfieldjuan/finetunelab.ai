import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

console.log('Checking SUPABASE_SERVICE_ROLE_KEY availability:\n');

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (serviceKey) {
  console.log('✓ SUPABASE_SERVICE_ROLE_KEY is set');
  console.log(`  Length: ${serviceKey.length} characters`);
  console.log(`  Preview: ${serviceKey.substring(0, 20)}...`);
} else {
  console.log('✗ SUPABASE_SERVICE_ROLE_KEY is NOT set or empty');
}

// Also check what supabaseClient exports
import { supabaseAdmin } from './lib/supabaseClient';

console.log('\nChecking supabaseAdmin from lib/supabaseClient:');
console.log(`  supabaseAdmin is: ${supabaseAdmin ? 'initialized ✓' : 'NULL ✗'}`);

if (!supabaseAdmin && serviceKey) {
  console.log('\n⚠️  WARNING: Service key is set but supabaseAdmin is null!');
  console.log('   This suggests the env var was not available when the module loaded.');
}
