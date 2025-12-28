const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkTableSchema() {
  console.log('🔍 CHECKING TABLE SCHEMA FOR message_evaluations');
  console.log('='.repeat(60));

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  );

  try {
    // Try to get a few rows to see the actual structure
    console.log('1. Checking existing data structure...');
    const { data: sampleData, error: sampleError } = await serviceClient
      .from('message_evaluations')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Error fetching sample data:', sampleError);
    } else {
      if (sampleData && sampleData.length > 0) {
        console.log('✅ Sample data:', JSON.stringify(sampleData, null, 2));
        
        // Log keys
        const keys = Object.keys(sampleData[0]);
        console.log('\n📊 Available columns:');
        keys.forEach(key => {
          console.log(`   - ${key}: ${typeof sampleData[0][key]}`);
        });
      } else {
        console.log('⚠️ No data found in table. Cannot infer schema from data.');
      }
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

checkTableSchema();
