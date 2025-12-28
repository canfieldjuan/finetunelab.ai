
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function investigateTraces() {
  console.log('🔍 Investigating Recent Traces...');

  // 1. Get total count
  const { count, error: countError } = await supabase
    .from('llm_traces')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error getting count:', countError);
  } else {
    console.log(`Total traces in DB: ${count}`);
  }

  // 2. Get 5 most recent traces (raw)
  console.log('\n📋 5 Most Recent Traces (Raw):');
  const { data: recentTraces, error: recentError } = await supabase
    .from('llm_traces')
    .select('id, trace_id, user_id, parent_trace_id, start_time, operation_type, status')
    .order('start_time', { ascending: false })
    .limit(5);

  if (recentError) {
    console.error('Error fetching recent traces:', recentError);
  } else {
    if (recentTraces && recentTraces.length > 0) {
      console.table(recentTraces);
    } else {
      console.log('No traces found.');
    }
  }

  // 3. Check for traces with parent_trace_id = null (Root traces)
  console.log('\n🌳 Recent Root Traces (parent_trace_id is NULL):');
  const { data: rootTraces, error: rootError } = await supabase
    .from('llm_traces')
    .select('id, trace_id, user_id, start_time')
    .is('parent_trace_id', null)
    .order('start_time', { ascending: false })
    .limit(5);

  if (rootError) {
    console.error('Error fetching root traces:', rootError);
  } else {
    if (rootTraces && rootTraces.length > 0) {
      console.table(rootTraces);
    } else {
      console.log('No root traces found.');
    }
  }
  
  // 4. Check for specific user (if known, otherwise just list distinct users)
  // We'll list distinct user_ids from the last 50 traces
  console.log('\nbust👥 Active User IDs in last 50 traces:');
  const { data: userTraces } = await supabase
    .from('llm_traces')
    .select('user_id')
    .order('start_time', { ascending: false })
    .limit(50);
    
  if (userTraces) {
    const uniqueUsers = [...new Set(userTraces.map(t => t.user_id))];
    console.log('Unique User IDs:', uniqueUsers);
  }

  // 5. Check for 'noop' traces
  console.log('\n🚫 Checking for "noop" traces:');
  const { data: noopTraces } = await supabase
    .from('llm_traces')
    .select('id, trace_id')
    .eq('trace_id', 'noop');
    
  if (noopTraces && noopTraces.length > 0) {
    console.log(`Found ${noopTraces.length} "noop" traces!`);
  } else {
    console.log('No "noop" traces found.');
  }
}

investigateTraces();
