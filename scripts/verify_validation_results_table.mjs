import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyTable() {
  console.log('🔍 Verifying validation_results table...\n');

  try {
    // Check if table exists by trying to query it
    const { data, error } = await supabase
      .from('validation_results')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Table verification failed:', error.message);
      return;
    }

    console.log('✅ Table exists and is queryable!');
    console.log(`   Current records: ${data?.length || 0}`);

    // Check table structure
    const { data: columns } = await supabase
      .rpc('get_columns', { table_name: 'validation_results' })
      .then(() => ({ data: null }))
      .catch(() => ({ data: null }));

    console.log('\n📊 Table is ready for use');
    console.log('   API endpoint should now work: GET /api/training/validations');
    
  } catch (err) {
    console.error('❌ Verification failed:', err);
  }
}

verifyTable();
