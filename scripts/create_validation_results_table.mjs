import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🔧 Creating validation_results table...\n');

  try {
    // Read the SQL file
    const sqlPath = join(process.cwd(), 'supabase/migrations/20251129_create_validation_results.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If exec_sql doesn't exist, try direct execution (Supabase < v2.40)
      console.log('⚠️  exec_sql RPC not available, trying direct execution...\n');
      
      // Split by semicolon and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.toUpperCase().startsWith('CREATE') || 
            statement.toUpperCase().startsWith('ALTER') ||
            statement.toUpperCase().startsWith('COMMENT')) {
          console.log(`Executing: ${statement.substring(0, 60)}...`);
          
          const { error: stmtError } = await supabase.rpc('exec', { 
            query: statement + ';' 
          });
          
          if (stmtError) {
            console.error(`❌ Error: ${stmtError.message}`);
          }
        }
      }
    }

    console.log('✅ Migration executed\n');

    // Verify table was created
    console.log('🔍 Verifying table exists...\n');
    
    const { data, error: queryError } = await supabase
      .from('validation_results')
      .select('count')
      .limit(0);

    if (queryError) {
      console.error('❌ Table verification failed:', queryError.message);
      console.log('\n⚠️  You may need to run this SQL manually in Supabase Studio:');
      console.log('   1. Go to https://supabase.com/dashboard');
      console.log('   2. Select your project');
      console.log('   3. Go to SQL Editor');
      console.log('   4. Paste the contents of:');
      console.log('      supabase/migrations/20251129_create_validation_results.sql');
      console.log('   5. Click "Run"');
      return;
    }

    console.log('✅ Table verification successful!');
    console.log('\n📊 Table structure:');
    console.log('  - id (UUID)');
    console.log('  - execution_id (TEXT)');
    console.log('  - job_id (TEXT)');
    console.log('  - model_name (TEXT)');
    console.log('  - model_version (TEXT)');
    console.log('  - status (TEXT)');
    console.log('  - metrics (JSONB)');
    console.log('  - baseline_comparisons (JSONB)');
    console.log('  - failures (TEXT[])');
    console.log('  - warnings (TEXT[])');
    console.log('  - created_at (TIMESTAMP)');
    console.log('  - updated_at (TIMESTAMP)');

    console.log('\n✅ validation_results table is ready!');
    console.log('   The API endpoint /api/training/validations should now work.');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
