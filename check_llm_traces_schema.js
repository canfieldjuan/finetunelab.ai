
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkTableSchema() {
  console.log('🔍 CHECKING TABLE SCHEMA FOR llm_traces');
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
      .from('llm_traces')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log('❌ Error reading table:', sampleError);
    } else {
      console.log('✅ Sample data:', JSON.stringify(sampleData, null, 2));
      
      // Check user_id type by trying to insert a non-UUID
      console.log('\n🧪 Testing user_id type constraint...');
      const { error: insertError } = await serviceClient
        .from('llm_traces')
        .insert({
          trace_id: 'test_type_check_' + Date.now(),
          span_id: 'test_span_' + Date.now(),
          span_name: 'test',
          operation_type: 'test',
          user_id: null, // Test null
          start_time: new Date().toISOString()
        });

      if (insertError) {
        console.log('❌ Insert with NULL user_id failed:', insertError.message);
      } else {
        console.log('✅ Insert with NULL user_id succeeded.');
      }
    }

    console.log('\n🔍 CHECKING TABLE SCHEMA FOR message_evaluations');
    console.log('='.repeat(60));
    const { data: evalData, error: evalError } = await serviceClient
      .from('message_evaluations')
      .select('*')
      .limit(1);

    if (evalError) {
      console.log('❌ Error reading message_evaluations:', evalError);
    } else {
      if (evalData.length > 0) {
        console.log('✅ Sample data:', JSON.stringify(evalData, null, 2));
        console.log('\n📊 Available columns:', Object.keys(evalData[0]).join(', '));
      } else {
        console.log('⚠️ message_evaluations table is empty.');
        // Check if user_id column exists
        const { error: colError } = await serviceClient
          .from('message_evaluations')
          .select('user_id')
          .limit(1);
        if (colError) {
          console.log('❌ user_id column missing in message_evaluations:', colError);
        } else {
          console.log('✅ user_id column exists in message_evaluations.');
        }
      }
    }

    console.log('\n🔍 CHECKING TABLE SCHEMA FOR judgments');
    console.log('='.repeat(60));
    const { data: judgData, error: judgError } = await serviceClient
      .from('judgments')
      .select('*')
      .limit(1);

    if (judgError) {
      console.log('❌ Error reading judgments:', judgError);
    } else {
      if (judgData.length > 0) {
        console.log('✅ Sample data:', JSON.stringify(judgData, null, 2));
        console.log('\n📊 Available columns:', Object.keys(judgData[0]).join(', '));
      } else {
        console.log('⚠️ judgments table is empty.');
        // Check columns by selecting them
        const { error: colError } = await serviceClient
          .from('judgments')
          .select('trace_id, score, passed')
          .limit(1);
        if (colError) {
          console.log('❌ Columns missing in judgments:', colError);
        } else {
          console.log('✅ trace_id, score, passed columns exist in judgments.');
        }
      }
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkTableSchema();
