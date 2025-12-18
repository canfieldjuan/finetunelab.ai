const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[Column Check] Checking message_evaluations table columns...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const columnsToCheck = [
    'id',
    'user_id',
    'userId',  // Check if it's camelCase
    'message_id',
    'messageId',
    'rating',
    'success',
    'notes',
    'created_at',
    'createdAt',
    'evaluation_type',
    'evaluationType',
    'metadata'
  ];

  console.log('Testing which columns exist:\n');

  for (const col of columnsToCheck) {
    try {
      const { data, error } = await supabase
        .from('message_evaluations')
        .select(col)
        .limit(1);

      if (!error) {
        console.log(`✓ ${col} - EXISTS`);
      } else if (error.code === '42703') {
        // Column doesn't exist
        console.log(`  ${col} - does not exist`);
      } else {
        console.log(`? ${col} - error: ${error.message}`);
      }
    } catch (e) {
      console.log(`? ${col} - exception: ${e.message}`);
    }
  }

  // Try to get actual data to see structure
  console.log('\n---\n');
  console.log('Attempting to fetch a sample record:\n');

  const { data, error } = await supabase
    .from('message_evaluations')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
  } else if (data && data.length > 0) {
    console.log('Sample record structure:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('Table exists but is empty');
    console.log('Cannot determine exact schema from data');
  }
}

checkColumns();
