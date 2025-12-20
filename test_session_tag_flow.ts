#!/usr/bin/env tsx
/**
 * Test Session Tag End-to-End Flow
 * Verifies: chat → conversations → traces
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

async function testSessionTagFlow() {
  console.log('🔍 Testing Session Tag End-to-End Flow...\n');

  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('❌ Not authenticated. Please log in first.');
    process.exit(1);
  }

  console.log('✓ Authenticated as:', user.email);

  try {
    // 1. Check conversations table for session_id column
    console.log('\n📋 Step 1: Checking conversations table schema...');
    const { data: convs, error: convsError } = await supabase
      .from('conversations')
      .select('id, session_id, experiment_name, llm_model_id')
      .eq('user_id', user.id)
      .not('session_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (convsError) {
      console.log('  ❌ Error querying conversations:', convsError.message);
    } else if (convs && convs.length > 0) {
      console.log(`  ✓ Found ${convs.length} conversations with session tags:`);
      convs.forEach((conv, i) => {
        console.log(`    ${i + 1}. ${conv.session_id} (${conv.experiment_name || 'No name'})`);
        console.log(`       - Conversation ID: ${conv.id}`);
        console.log(`       - Model ID: ${conv.llm_model_id || 'Not set'}`);
      });
    } else {
      console.log('  ⚠️  No conversations with session tags found');
      console.log('  💡 Create a new conversation and send a message to generate a session tag');
    }

    // 2. Check llm_traces table for session_tag column
    console.log('\n📋 Step 2: Checking llm_traces table schema...');
    const { data: traces, error: tracesError } = await supabase
      .from('llm_traces')
      .select('id, trace_id, session_tag, conversation_id, span_name, operation_type, status')
      .eq('user_id', user.id)
      .not('session_tag', 'is', null)
      .order('start_time', { ascending: false })
      .limit(5);

    if (tracesError) {
      console.log('  ❌ Error querying traces:', tracesError.message);
      if (tracesError.message.includes('column') && tracesError.message.includes('does not exist')) {
        console.log('  ❌ MIGRATION NOT APPLIED: session_tag column missing in llm_traces');
        console.log('  🔧 Run: 20251219_add_session_tag_to_traces.sql in Supabase SQL Editor');
      }
    } else if (traces && traces.length > 0) {
      console.log(`  ✓ Found ${traces.length} traces with session tags:`);
      traces.forEach((trace, i) => {
        console.log(`    ${i + 1}. ${trace.session_tag}`);
        console.log(`       - Trace ID: ${trace.trace_id}`);
        console.log(`       - Conversation ID: ${trace.conversation_id || 'Not set'}`);
        console.log(`       - Operation: ${trace.span_name} (${trace.operation_type})`);
        console.log(`       - Status: ${trace.status}`);
      });
    } else {
      console.log('  ⚠️  No traces with session tags found');
      console.log('  💡 Send a message in a conversation to generate traces with session tags');
    }

    // 3. Cross-check: Find conversations with traces
    if (convs && convs.length > 0 && traces && traces.length > 0) {
      console.log('\n📋 Step 3: Cross-checking conversations ↔ traces...');
      
      const convsWithTraces = convs.filter(conv => 
        traces.some(trace => trace.conversation_id === conv.id)
      );

      if (convsWithTraces.length > 0) {
        console.log(`  ✓ Found ${convsWithTraces.length} conversations with matching traces:`);
        convsWithTraces.forEach(conv => {
          const matchingTraces = traces.filter(t => t.conversation_id === conv.id);
          console.log(`    - ${conv.session_id}`);
          console.log(`      → ${matchingTraces.length} trace(s) with session_tag: ${matchingTraces[0]?.session_tag}`);
          
          if (conv.session_id === matchingTraces[0]?.session_tag) {
            console.log('      ✅ Session tags match!');
          } else {
            console.log('      ⚠️  Session tags DON\'T match:');
            console.log(`         Conv: ${conv.session_id}`);
            console.log(`         Trace: ${matchingTraces[0]?.session_tag}`);
          }
        });
      } else {
        console.log('  ⚠️  No conversations found with matching traces');
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    const hasConvs = convs && convs.length > 0;
    const hasTraces = traces && traces.length > 0;
    const flowWorking = hasConvs && hasTraces;

    if (flowWorking) {
      console.log('✅ Session tag flow is working!');
      console.log('\n✓ Conversations table has session_id');
      console.log('✓ Traces table has session_tag');
      console.log('✓ Data is flowing end-to-end');
    } else {
      console.log('⚠️  Session tag flow incomplete');
      
      if (!hasConvs) {
        console.log('\n❌ No conversations with session tags');
        console.log('💡 Action: Send a message in a new conversation');
      }
      
      if (!hasTraces) {
        console.log('\n❌ No traces with session tags');
        console.log('💡 Action: Ensure tracing is enabled and send a message');
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

testSessionTagFlow();
