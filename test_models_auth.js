const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing models API with different auth scenarios\n');

async function testModelsFetch() {
  // First, get a real user session
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  console.log('1. Testing UNAUTHENTICATED request:');
  const response1 = await fetch('http://localhost:3000/api/models');
  const data1 = await response1.json();
  console.log(`   Status: ${response1.status}`);
  console.log(`   Models returned: ${data1.models?.length || 0}`);
  if (data1.models?.length > 0) {
    console.log(`   First model: ${data1.models[0].name} (${data1.models[0].provider})`);
    console.log(`   All are global: ${data1.models.every(m => m.is_global)}`);
  }
  
  console.log('\n2. Getting authenticated session...');
  // Try to get session from stored credentials
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    console.log('   No active session found. Need to authenticate first.');
    console.log('\n3. Attempting sign in with email/password...');
    
    // You'll need to provide credentials here or use existing session
    console.log('   (Skipping - need manual auth)');
    return;
  }
  
  console.log(`   ✓ Session found for user: ${session.user.email}`);
  console.log(`   User ID: ${session.user.id}`);
  console.log(`   Token length: ${session.access_token.length} chars`);
  
  console.log('\n3. Testing AUTHENTICATED request:');
  const response2 = await fetch('http://localhost:3000/api/models', {
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  });
  const data2 = await response2.json();
  console.log(`   Status: ${response2.status}`);
  console.log(`   Models returned: ${data2.models?.length || 0}`);
  if (data2.models?.length > 0) {
    const globalCount = data2.models.filter(m => m.is_global).length;
    const userCount = data2.models.filter(m => !m.is_global).length;
    console.log(`   Global models: ${globalCount}`);
    console.log(`   User models: ${userCount}`);
    console.log(`   First user model: ${data2.models.find(m => !m.is_global)?.name || 'none'}`);
  }
  
  console.log('\n4. Direct database query for comparison:');
  const { data: dbModels, error: dbError } = await supabase
    .from('llm_models')
    .select('id, name, provider, is_global, user_id')
    .eq('enabled', true)
    .order('created_at', { ascending: false });
  
  if (dbError) {
    console.log(`   Error: ${dbError.message}`);
  } else {
    const globalModels = dbModels.filter(m => m.is_global);
    const userModels = dbModels.filter(m => m.user_id === session.user.id);
    console.log(`   Total in DB: ${dbModels.length}`);
    console.log(`   Global: ${globalModels.length}`);
    console.log(`   Belonging to current user: ${userModels.length}`);
    console.log(`   User models: ${userModels.map(m => m.name).join(', ')}`);
  }
}

testModelsFetch().catch(console.error);
