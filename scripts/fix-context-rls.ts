// Apply RLS fix for conversation_model_contexts table
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRLS() {
  console.log('Applying RLS fix for conversation_model_contexts table...\n');

  const sqlPath = path.join(__dirname, '../supabase/migrations/20251127_fix_conversation_model_contexts_rls.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Executing SQL:');
  console.log('='.repeat(80));
  console.log(sql);
  console.log('='.repeat(80) + '\n');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error applying RLS fix:', error);
      console.error('\nManual fix required:');
      console.error('1. Go to Supabase Dashboard > SQL Editor');
      console.error('2. Paste the SQL from:');
      console.error(`   ${sqlPath}`);
      console.error('3. Run the query\n');
      process.exit(1);
    }

    console.log('✅ RLS policies updated successfully!');
    console.log('Context saving should now work from the frontend.\n');
  } catch (err) {
    console.error('❌ Failed to execute SQL:', err);
    console.error('\n⚠️  The Supabase client cannot execute raw SQL directly.');
    console.error('You need to apply this migration manually:\n');
    console.error('Option 1: Via Supabase Dashboard');
    console.error('  1. Go to https://supabase.com/dashboard');
    console.error('  2. Select your project');
    console.error('  3. Go to SQL Editor');
    console.error('  4. Paste the contents of:');
    console.error(`     ${sqlPath}`);
    console.error('  5. Click Run\n');
    console.error('Option 2: Via psql');
    console.error('  psql <your-connection-string> -f ' + sqlPath);
    console.log('\n📄 SQL to run:');
    console.log('='.repeat(80));
    console.log(sql);
    console.log('='.repeat(80));
  }
}

fixRLS();
