/**
 * Debug script to check why Response Time Trends chart is empty
 *
 * Run with: npx ts-node scripts/check-response-times.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function checkResponseTimes() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get user from environment or prompt
  const userId = process.env.USER_ID;
  if (!userId) {
    console.error('Please set USER_ID environment variable');
    process.exit(1);
  }

  console.log('[Check] Checking response time data for user:', userId);
  console.log('[Check] Time range: Last 30 days');

  const dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch messages
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, role, created_at, latency_ms, model_id')
    .eq('user_id', userId)
    .gte('created_at', dateFilter)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Check] Error fetching messages:', error);
    process.exit(1);
  }

  console.log('\n=== MESSAGES OVERVIEW ===');
  console.log('Total messages:', messages?.length || 0);
  console.log('Assistant messages:', messages?.filter(m => m.role === 'assistant').length || 0);
  console.log('Messages with latency_ms:', messages?.filter(m => m.latency_ms).length || 0);
  console.log('Messages with BOTH role=assistant AND latency_ms:',
    messages?.filter(m => m.role === 'assistant' && m.latency_ms).length || 0);

  // Sample messages
  console.log('\n=== SAMPLE MESSAGES (first 5) ===');
  messages?.slice(0, 5).forEach((m, i) => {
    console.log(`${i + 1}. role=${m.role}, latency_ms=${m.latency_ms}, created_at=${m.created_at}`);
  });

  // Check latency distribution
  const assistantWithLatency = messages?.filter(m => m.role === 'assistant' && m.latency_ms) || [];

  if (assistantWithLatency.length > 0) {
    const latencies = assistantWithLatency.map(m => m.latency_ms as number);
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    console.log('\n=== LATENCY STATISTICS ===');
    console.log('Count:', latencies.length);
    console.log('Min:', min, 'ms');
    console.log('Max:', max, 'ms');
    console.log('Avg:', Math.round(avg), 'ms');

    // Group by date
    const byDate: Record<string, number[]> = {};
    assistantWithLatency.forEach(m => {
      const date = new Date(m.created_at).toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(m.latency_ms as number);
    });

    console.log('\n=== BY DATE ===');
    Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, latencies]) => {
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        console.log(`${date}: ${latencies.length} messages, avg ${Math.round(avg)}ms`);
      });
  } else {
    console.log('\n=== NO DATA FOUND ===');
    console.log('❌ No assistant messages with latency_ms found in the last 30 days');
    console.log('\nPossible reasons:');
    console.log('1. Messages are not being saved with latency_ms field');
    console.log('2. Only user messages exist (no assistant responses)');
    console.log('3. All messages are older than 30 days');
    console.log('\nRecommendation: Check the /api/chat route to ensure it saves latency_ms');
  }
}

checkResponseTimes().catch(console.error);
