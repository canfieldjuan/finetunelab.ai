/**
 * Quick script to verify auto-generated session tags in database
 * Run with: npx tsx test_session_tags.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSessionTags() {
  console.log('🔍 Checking conversations with auto-generated session tags...\n');

  // Query conversations with session_id and experiment_name
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select(`
      id,
      session_id,
      experiment_name,
      llm_model_id,
      created_at,
      title
    `)
    .not('session_id', 'is', null)
    .not('experiment_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error querying conversations:', error);
    return;
  }

  if (!conversations || conversations.length === 0) {
    console.log('⚠️  No conversations found with session tags');
    console.log('Try creating a new conversation and sending a message to trigger auto-tagging.');
    return;
  }

  console.log(`✅ Found ${conversations.length} conversations with session tags:\n`);

  for (const conv of conversations) {
    // Count messages in this conversation
    const { data: messages } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id);

    console.log(`📝 Conversation: ${conv.title || 'Untitled'}`);
    console.log(`   ID: ${conv.id}`);
    console.log(`   🏷️  Session ID: ${conv.session_id}`);
    console.log(`   📊 Experiment: ${conv.experiment_name}`);
    console.log(`   🤖 Model: ${conv.llm_model_id}`);
    console.log(`   💬 Messages: ${messages?.length || 0}`);
    console.log(`   📅 Created: ${new Date(conv.created_at).toLocaleString()}`);
    console.log('');
  }

  // Check if these appear in analytics
  console.log('🔍 Checking if these sessions appear in analytics...\n');

  const { data: analyticsData, error: analyticsError } = await supabase
    .from('conversations')
    .select(`
      session_id,
      experiment_name,
      id
    `)
    .not('session_id', 'is', null)
    .not('experiment_name', 'is', null);

  if (analyticsError) {
    console.error('❌ Error querying analytics data:', analyticsError);
    return;
  }

  // Group by session_id
  const sessionGroups = analyticsData?.reduce((acc: Record<string, any[]>, conv: any) => {
    if (!acc[conv.session_id]) {
      acc[conv.session_id] = [];
    }
    acc[conv.session_id].push(conv);
    return acc;
  }, {});

  console.log('📊 Sessions available for A/B testing:');
  console.log(`   Total unique sessions: ${Object.keys(sessionGroups || {}).length}`);
  console.log('');

  for (const [sessionId, convs] of Object.entries(sessionGroups || {})) {
    const experimentName = (convs as any)[0].experiment_name;
    console.log(`   🏷️  ${sessionId}`);
    console.log(`      Experiment: ${experimentName}`);
    console.log(`      Conversations: ${convs.length}`);
  }

  console.log('\n✅ Auto-generated session tags are working!');
  console.log('   Visit /analytics to see A/B testing dashboard');
  console.log('   Visit /analytics/chat to use AI analytics assistant');
}

checkSessionTags().catch(console.error);
