const fs = require('fs');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MIGRATION_FILE = './supabase/migrations/20251216_create_message_evaluations.sql';

console.log('==================================================');
console.log('  APPLYING MESSAGE EVALUATIONS MIGRATION');
console.log('==================================================\n');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', !!SUPABASE_URL);
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', !!SERVICE_KEY);
  process.exit(1);
}

const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
console.log('✓ Supabase URL:', SUPABASE_URL);
console.log('✓ Project Reference:', projectRef);
console.log('✓ Service key found\n');

// Read migration file
const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
console.log('✓ Migration file loaded:', MIGRATION_FILE);
console.log('  SQL length:', migrationSQL.length, 'characters');
console.log('  Lines:', migrationSQL.split('\n').length);
console.log('');

console.log('==================================================');
console.log('  HOW TO APPLY THIS MIGRATION');
console.log('==================================================\n');

console.log('🔷 Option 1: Supabase SQL Editor (Easiest)');
console.log('   1. Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
console.log('   2. Copy the SQL from:', MIGRATION_FILE);
console.log('   3. Paste and click "Run"\n');

console.log('🔷 Option 2: Copy SQL to Clipboard');
console.log('   The SQL has been written to:', MIGRATION_FILE);
console.log('   You can copy it from there\n');

console.log('🔷 Option 3: Use npx supabase (if configured)');
console.log('   npx supabase db push\n');

console.log('==================================================');
console.log('  MIGRATION SQL PREVIEW');
console.log('==================================================\n');

// Show first 40 lines
const lines = migrationSQL.split('\n');
console.log(lines.slice(0, 40).join('\n'));
console.log('\n... (' + (lines.length - 40) + ' more lines) ...\n');

console.log('==================================================\n');
console.log('📝 Once applied, the message_evaluations table will be created');
console.log('   and quality metrics in analytics will work properly!\n');
