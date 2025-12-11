// Check actual schema of local_training_metrics table
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkMetricsSchema() {
  console.log('=== METRICS TABLE SCHEMA CHECK ===');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseService = createClient(supabaseUrl, serviceKey);

  try {
    // Get a sample record to see the actual columns
    console.log('--- 1. Sample metrics record (if any exist) ---');
    const { data: sampleRecord, error: sampleError } = await supabaseService
      .from('local_training_metrics')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.log('Sample query error:', sampleError);
    } else if (sampleRecord && sampleRecord.length > 0) {
      console.log('Sample record columns:', Object.keys(sampleRecord[0]));
      console.log('Sample record:', sampleRecord[0]);
    } else {
      console.log('No records found in local_training_metrics');
    }

    // Try different column names that might exist
    console.log('\n--- 2. Test different possible column names ---');
    const possibleColumns = ['loss', 'current_loss', 'train_loss', 'step_loss'];
    
    for (const col of possibleColumns) {
      try {
        const { data, error } = await supabaseService
          .from('local_training_metrics')
          .select(col)
          .limit(1);
        
        if (error) {
          console.log(`❌ Column '${col}' does NOT exist:`, error.message);
        } else {
          console.log(`✅ Column '${col}' EXISTS`);
        }
      } catch (err) {
        console.log(`❌ Column '${col}' test failed:`, err.message);
      }
    }

    // Check what the RunPod script is actually trying to insert
    console.log('\n--- 3. Check what RunPod script inserts ---');
    console.log('From the error logs, RunPod script tries to INSERT to local_training_metrics');
    console.log('We need to find the exact column names that exist in the table');

  } catch (error) {
    console.error('Schema check failed:', error);
  }
}

checkMetricsSchema();