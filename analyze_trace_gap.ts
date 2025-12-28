
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeTraceGap() {
  console.log('Analyzing trace distribution...');
  
  const { data, error } = await supabase
    .from('llm_traces')
    .select('start_time, status, user_id')
    .order('start_time', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching traces:', error);
    return;
  }

  console.log(`Found ${data.length} recent traces.`);
  
  if (data.length === 0) return;

  console.log('Most recent traces:');
  data.slice(0, 10).forEach(t => {
    console.log(`- ${t.start_time} | Status: ${t.status} | User: ${t.user_id}`);
  });

  // Group by day
  const distribution: Record<string, number> = {};
  data.forEach(t => {
    const day = new Date(t.start_time).toISOString().split('T')[0];
    distribution[day] = (distribution[day] || 0) + 1;
  });

  console.log('\nDaily distribution (last 100 traces):');
  Object.keys(distribution).sort().forEach(day => {
    console.log(`${day}: ${distribution[day]} traces`);
  });
}

analyzeTraceGap();
