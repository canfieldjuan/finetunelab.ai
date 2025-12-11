import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyTable() {
  console.log('🔍 Verifying model_baselines table...\n');

  try {
    // Check if table exists by trying to query it
    const { data, error } = await supabase
      .from('model_baselines')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Table not found:', error.message);
      console.log('\n⚠️  Please run this SQL in Supabase Studio:');
      console.log('   File: supabase/migrations/20251129_create_model_baselines.sql');
      return;
    }

    console.log('✅ Table exists and is queryable!');
    console.log(`   Current records: ${data?.length || 0}`);

    console.log('\n📊 Table is ready for use');
    console.log('   API endpoint should now work: POST /api/training/baselines');
    
  } catch (err) {
    console.error('❌ Verification failed:', err);
  }
}

verifyTable();
