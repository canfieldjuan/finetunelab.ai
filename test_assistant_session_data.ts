/**
 * Test script to show what the Analytics Assistant sees for auto-tagged sessions
 * This simulates the data available to the assistant's analytical tools
 *
 * Run with: npx tsx test_assistant_session_data.ts
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

async function testAssistantSessionData() {
  console.log('🤖 Analytics Assistant Session Data Test\n');
  console.log('='.repeat(60));

  // Find a recent auto-tagged session
  const { data: sessions, error } = await supabase
    .from('conversations')
    .select('id, session_id, experiment_name, created_at, title')
    .not('session_id', 'is', null)
    .not('experiment_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !sessions || sessions.length === 0) {
    console.error('❌ No auto-tagged sessions found');
    return;
  }

  const session = sessions[0];
  const conversationIds = [session.id];

  console.log('\n📊 SELECTED SESSION FOR TESTING');
  console.log('='.repeat(60));
  console.log(`Session ID: ${session.session_id}`);
  console.log(`Experiment: ${session.experiment_name}`);
  console.log(`Title: ${session.title || 'Untitled'}`);
  console.log(`Created: ${new Date(session.created_at).toLocaleString()}`);
  console.log(`Conversation IDs: ${JSON.stringify(conversationIds)}\n`);

  // Simulate Tool 1: get_session_metrics
  console.log('\n🔧 TOOL 1: get_session_metrics');
  console.log('='.repeat(60));
  console.log('What the assistant calls to get costs, tokens, response times\n');

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', conversationIds);

  const assistantMessages = messages?.filter(m => m.role === 'assistant') || [];

  const totalInputTokens = assistantMessages.reduce((sum, m) => sum + (m.input_tokens || 0), 0);
  const totalOutputTokens = assistantMessages.reduce((sum, m) => sum + (m.output_tokens || 0), 0);
  const avgLatency = assistantMessages.length > 0
    ? assistantMessages.reduce((sum, m) => sum + (m.latency_ms || 0), 0) / assistantMessages.length
    : 0;

  // Estimate cost (using rough OpenAI pricing)
  const estimatedCost = (totalInputTokens / 1000000) * 5.0 + (totalOutputTokens / 1000000) * 15.0;

  console.log('📈 Metrics Available:');
  console.log(`   Total Messages: ${messages?.length || 0}`);
  console.log(`   Assistant Messages: ${assistantMessages.length}`);
  console.log(`   Input Tokens: ${totalInputTokens.toLocaleString()}`);
  console.log(`   Output Tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`   Total Tokens: ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);
  console.log(`   Avg Response Time: ${Math.round(avgLatency)}ms`);
  console.log(`   Estimated Cost: $${estimatedCost.toFixed(4)}`);

  // Simulate Tool 2: get_session_evaluations
  console.log('\n\n🔧 TOOL 2: get_session_evaluations');
  console.log('='.repeat(60));
  console.log('What the assistant calls to get ratings and quality scores\n');

  const messageIds = messages?.map(m => m.id) || [];
  const { data: evaluations } = await supabase
    .from('evaluations')
    .select('*')
    .in('message_id', messageIds);

  console.log('⭐ Evaluation Data:');
  if (!evaluations || evaluations.length === 0) {
    console.log('   No evaluations yet (send messages and rate them to see data here)');
  } else {
    const avgRating = evaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / evaluations.length;
    const successCount = evaluations.filter(e => e.success).length;
    const successRate = (successCount / evaluations.length) * 100;

    console.log(`   Total Evaluations: ${evaluations.length}`);
    console.log(`   Average Rating: ${avgRating.toFixed(1)}/5.0 ⭐`);
    console.log(`   Success Count: ${successCount}`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   Failed: ${evaluations.length - successCount}`);
  }

  // Simulate Tool 3: get_session_conversations
  console.log('\n\n🔧 TOOL 3: get_session_conversations');
  console.log('='.repeat(60));
  console.log('What the assistant calls to see actual conversation content\n');

  console.log('💬 Conversation Messages:');
  if (!messages || messages.length === 0) {
    console.log('   No messages yet (start a conversation to see data here)');
  } else {
    messages.slice(0, 3).forEach((msg, i) => {
      const preview = msg.content?.substring(0, 60) + (msg.content?.length > 60 ? '...' : '');
      console.log(`   [${i + 1}] ${msg.role}: "${preview}"`);
    });
    if (messages.length > 3) {
      console.log(`   ... and ${messages.length - 3} more messages`);
    }
  }

  // Show what queries the user can ask
  console.log('\n\n🎯 EXAMPLE QUERIES YOU CAN ASK THE ASSISTANT');
  console.log('='.repeat(60));
  console.log('\nGo to /analytics/chat and try these:\n');

  console.log(`1. "Analyze session ${session.session_id}"`);
  console.log('   → Gets metrics, evaluations, and provides insights\n');

  console.log(`2. "What's the cost and token usage for ${session.session_id}?"`);
  console.log('   → Shows detailed breakdown of costs and tokens\n');

  console.log(`3. "How is ${session.experiment_name} performing?"`);
  console.log('   → Analyzes all sessions for this model\n');

  console.log('4. "Compare all my GPT-5 Mini sessions"');
  console.log('   → A/B comparison across sessions\n');

  console.log('5. "Show me the success rate and average rating"');
  console.log('   → Quality metrics with statistical analysis\n');

  console.log('\n✅ The assistant has full access to all this data!');
  console.log('   It can calculate, compare, analyze trends, and provide recommendations.\n');
}

testAssistantSessionData().catch(console.error);
