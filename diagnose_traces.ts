/**
 * Diagnose traces in database
 * Run with: npx tsx diagnose_traces.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseTraces() {
  console.log('🔍 Diagnosing LLM Traces\n');
  console.log('='.repeat(70));

  // Check if llm_traces table exists and has data
  console.log('\n📊 Checking llm_traces table...\n');

  const { data: traces, error, count } = await supabase
    .from('llm_traces')
    .select('*', { count: 'exact', head: false })
    .order('start_time', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error querying llm_traces:', error);
    console.error('   Code:', error.code);
    console.error('   Message:', error.message);
    console.error('   Hint:', error.hint);
    return;
  }

  console.log(`✅ Query successful`);
  console.log(`   Total traces in database: ${count || 0}`);
  console.log(`   Fetched: ${traces?.length || 0} most recent traces\n`);

  if (!traces || traces.length === 0) {
    console.log('⚠️  No traces found in database');
    console.log('\nPossible reasons:');
    console.log('1. Tracing is not enabled in the chat API');
    console.log('2. No conversations have been created yet');
    console.log('3. Traces are being created but not committed to database');
    console.log('4. RLS policies are preventing access\n');

    // Check if tracing is configured
    console.log('💡 To enable tracing:');
    console.log('   - Ensure LANGFUSE_* env vars are set');
    console.log('   - Check that startTrace() is being called in chat API');
    console.log('   - Send a test message to create traces\n');
    return;
  }

  console.log('📋 Recent Traces:\n');
  console.log('='.repeat(70));

  traces.forEach((trace, i) => {
    console.log(`\n[${i + 1}] Trace ID: ${trace.trace_id}`);
    console.log(`    Span: ${trace.span_name}`);
    console.log(`    Operation: ${trace.operation_type}`);
    console.log(`    Status: ${trace.status}`);
    console.log(`    User ID: ${trace.user_id}`);
    console.log(`    Start Time: ${new Date(trace.start_time).toLocaleString()}`);
    console.log(`    Duration: ${trace.duration_ms ? `${trace.duration_ms}ms` : 'N/A'}`);
    console.log(`    Model: ${trace.model_name || 'N/A'}`);
    console.log(`    Provider: ${trace.model_provider || 'N/A'}`);
    console.log(`    Conversation: ${trace.conversation_id || 'N/A'}`);
    console.log(`    Message: ${trace.message_id || 'N/A'}`);
    console.log(`    Session Tag: ${trace.session_tag || 'N/A'}`);
    console.log(`    Parent Trace: ${trace.parent_trace_id || 'ROOT'}`);
    if (trace.error_message) {
      console.log(`    ❌ Error: ${trace.error_message}`);
    }
  });

  // Check for root traces only (what the UI shows)
  console.log('\n\n📌 Root Traces (shown in UI):\n');
  console.log('='.repeat(70));

  const { data: rootTraces, count: rootCount } = await supabase
    .from('llm_traces')
    .select('*', { count: 'exact' })
    .is('parent_trace_id', null)
    .order('start_time', { ascending: false })
    .limit(5);

  console.log(`Total root traces: ${rootCount || 0}`);

  if (rootTraces && rootTraces.length > 0) {
    rootTraces.forEach((trace, i) => {
      console.log(`\n[${i + 1}] ${trace.span_name} (${trace.operation_type})`);
      console.log(`    Trace ID: ${trace.trace_id}`);
      console.log(`    Status: ${trace.status}`);
      console.log(`    Time: ${new Date(trace.start_time).toLocaleString()}`);
      console.log(`    Session: ${trace.session_tag || 'none'}`);
    });
  }

  // Check for traces by status
  console.log('\n\n📊 Trace Status Breakdown:\n');
  console.log('='.repeat(70));

  const statuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];

  for (const status of statuses) {
    const { count: statusCount } = await supabase
      .from('llm_traces')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);

    if (statusCount && statusCount > 0) {
      console.log(`   ${status.toUpperCase()}: ${statusCount}`);
    }
  }

  // Check for recent traces (last 24 hours)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const { count: recentCount } = await supabase
    .from('llm_traces')
    .select('*', { count: 'exact', head: true })
    .gte('start_time', oneDayAgo.toISOString());

  console.log(`\n   Last 24 hours: ${recentCount || 0} traces`);

  // Check for traces with session tags
  const { count: sessionTagCount } = await supabase
    .from('llm_traces')
    .select('*', { count: 'exact', head: true })
    .not('session_tag', 'is', null);

  console.log(`   With session tags: ${sessionTagCount || 0} traces`);

  console.log('\n✅ Diagnosis complete!\n');
}

diagnoseTraces().catch(console.error);
