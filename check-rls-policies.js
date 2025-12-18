const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[RLS Check] Checking message_evaluations RLS policies...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  try {
    // Try to query with service role (should bypass RLS)
    console.log('1. Testing service role query (should bypass RLS)...\n');
    
    const { data: serviceData, error: serviceError } = await supabase
      .from('message_evaluations')
      .select('*')
      .limit(5);
    
    if (serviceError) {
      console.log('❌ Service role query failed:');
      console.log('   Message:', serviceError.message);
      console.log('   Code:', serviceError.code);
      console.log('   Details:', serviceError.details);
      console.log('   Hint:', serviceError.hint);
    } else {
      console.log('✓ Service role query succeeded');
      console.log('   Records found:', serviceData.length);
      if (serviceData.length > 0) {
        console.log('   Sample record:');
        console.log('   ', JSON.stringify(serviceData[0], null, 2));
      } else {
        console.log('   Table is empty (no evaluations yet)');
      }
    }
    
    // Check table info
    console.log('\n2. Checking table schema...\n');
    
    const { data: schemaData, error: schemaError } = await supabase
      .from('message_evaluations')
      .select('id, user_id, message_id, rating, created_at')
      .limit(1);
    
    if (schemaError) {
      console.log('❌ Schema check failed:', schemaError.message);
    } else {
      console.log('✓ Schema check passed');
      console.log('   Columns accessible: id, user_id, message_id, rating, created_at');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkRLS();
