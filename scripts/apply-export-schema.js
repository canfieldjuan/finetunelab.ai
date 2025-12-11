/**
 * Apply Export/Archive Schema to Supabase
 *
 * Run with: node scripts/apply-export-schema.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySchema() {
  console.log('🔧 Applying Export/Archive schema to Supabase...\n');

  // Read the SQL file
  const sqlPath = path.join(__dirname, '..', 'docs', 'schema_updates', '05_export_archive.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split by statement (rough split on semicolons outside of function bodies)
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';

    // Skip comments
    if (statement.startsWith('--') || statement.startsWith('/*')) {
      continue;
    }

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_string: statement });

      if (error) {
        // Try direct SQL execution as fallback
        const { error: error2 } = await supabase.from('_temp').select('*').limit(0);

        console.log(`⚠️  Statement ${i + 1}: ${error.message.substring(0, 100)}...`);
        errorCount++;
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
        successCount++;
      }
    } catch (err) {
      console.log(`❌ Statement ${i + 1} failed: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Results: ${successCount} succeeded, ${errorCount} failed`);

  if (errorCount > 0) {
    console.log('\n⚠️  Some statements failed. You may need to apply the schema manually via Supabase Dashboard.');
    console.log('📍 Dashboard SQL Editor: https://supabase.com/dashboard/project/tkizlemssfmrfluychsn/sql');
  } else {
    console.log('\n🎉 Schema applied successfully!');
  }
}

applySchema().catch(console.error);
