// Execute SQL directly via Supabase REST API
require('dotenv').config();
const https = require('https');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = 'ALTER TABLE local_inference_servers ALTER COLUMN user_id DROP NOT NULL;';

const url = new URL('/rest/v1/rpc/_exec_sql', supabaseUrl);
const postData = JSON.stringify({ query: sql });

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Prefer': 'return=representation'
  }
};

console.log('\n=== Applying Database Fix ===');
console.log('SQL:', sql);
console.log('\nAttempting to execute...\n');

// Try using the client library instead
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql() {
  // Method 1: Try inserting a test record to see the actual error
  console.log('Testing insert with null user_id...');
  const { data, error } = await supabase
    .from('local_inference_servers')
    .insert({
      id: '00000000-0000-0000-0000-000000000000',
      user_id: null,
      server_type: 'vllm',
      name: 'test',
      base_url: 'http://localhost:8000',
      port: 8000,
      model_path: '/test',
      model_name: 'test'
    });
  
  if (error) {
    console.log('ERROR:', error.message);
    console.log('\nThis confirms user_id does not allow NULL.');
    console.log('You need to run this SQL in Supabase Dashboard:');
    console.log('  ALTER TABLE local_inference_servers ALTER COLUMN user_id DROP NOT NULL;');
  } else {
    console.log('SUCCESS! user_id already allows NULL');
    // Clean up test record
    await supabase.from('local_inference_servers').delete().eq('id', '00000000-0000-0000-0000-000000000000');
  }
}

executeSql().catch(console.error);
