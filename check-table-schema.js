const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[Schema Check] Connecting to Supabase...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  try {
    // Try to query the table to see what columns exist
    console.log('Checking if message_evaluations table exists...\n');

    const { data, error } = await supabase
      .from('message_evaluations')
      .select('*')
      .limit(0);

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Table does NOT exist');
        console.log('   Error:', error.message);
        console.log('\n✓ Safe to create new table with user_id column');
      } else {
        console.log('❌ Error querying table:', error.message);
        console.log('   Code:', error.code);
        console.log('   Details:', error.details);
        console.log('   Hint:', error.hint);
      }
    } else {
      console.log('✓ Table EXISTS');
      console.log('   Columns available (based on successful query)');
      console.log('\n   To see exact schema, check Supabase Dashboard:');
      console.log('   https://supabase.com/dashboard/project/tkizlemssfmrfluychsn/editor');
    }

    // Also check messages table to ensure it exists and has correct structure
    console.log('\n---\n');
    console.log('Checking messages table structure...\n');

    const { data: msgData, error: msgError } = await supabase
      .from('messages')
      .select('id')
      .limit(1);

    if (msgError) {
      console.log('❌ Messages table error:', msgError.message);
    } else {
      console.log('✓ Messages table exists and is accessible');
      console.log('   Sample record:', msgData.length > 0 ? 'Found' : 'Empty table');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkSchema();
