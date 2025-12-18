/**
 * End-to-End Test: GraphRAG Metadata in Messages
 *
 * Tests that GraphRAG metadata is correctly captured and persisted
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API_URL = 'http://localhost:3000';

console.log('======================================================================');
console.log('🧪 Testing GraphRAG Metadata in Messages');
console.log('======================================================================\n');

async function testGraphRAGMetadata() {
  try {
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Step 1: Sign in to get auth token
    console.log('1️⃣  Signing in...');
    console.log('----------------------------------------------------------------------');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'testpassword123',
    });

    if (authError) {
      console.error('❌ Authentication failed:', authError.message);
      console.log('\n💡 Tip: Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.local');
      process.exit(1);
    }

    const accessToken = authData.session.access_token;
    const userId = authData.user.id;
    console.log('✓ Signed in successfully');
    console.log(`   User ID: ${userId}\n`);

    // Step 2: Create a conversation
    console.log('2️⃣  Creating test conversation...');
    console.log('----------------------------------------------------------------------');

    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: 'GraphRAG Metadata Test',
      })
      .select('id')
      .single();

    if (convError) {
      console.error('❌ Failed to create conversation:', convError.message);
      process.exit(1);
    }

    const conversationId = convData.id;
    console.log('✓ Conversation created');
    console.log(`   Conversation ID: ${conversationId}\n`);

    // Step 3: Send a chat message that should trigger GraphRAG
    console.log('3️⃣  Sending message (should trigger GraphRAG if docs uploaded)...');
    console.log('----------------------------------------------------------------------');

    const chatResponse = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'What is the capital of France?', // Simple query
          },
        ],
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 100,
        conversationId: conversationId,
      }),
    });

    if (!chatResponse.ok) {
      console.error('❌ Chat request failed:', chatResponse.statusText);
      const errorText = await chatResponse.text();
      console.error('   Error:', errorText);
      process.exit(1);
    }

    const chatData = await chatResponse.json();
    console.log('✓ Message sent successfully');
    console.log(`   Response: ${chatData.content?.substring(0, 100)}...\n`);

    // Step 4: Wait a moment for message to be saved
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 5: Query messages table to check for GraphRAG metadata
    console.log('4️⃣  Checking message metadata in database...');
    console.log('----------------------------------------------------------------------');

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, role, metadata')
      .eq('conversation_id', conversationId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1);

    if (msgError) {
      console.error('❌ Failed to query messages:', msgError.message);
      process.exit(1);
    }

    if (messages.length === 0) {
      console.log('⚠️  No assistant messages found yet (still processing?)');
      process.exit(0);
    }

    const message = messages[0];
    const metadata = message.metadata;

    console.log('✓ Message retrieved');
    console.log(`   Message ID: ${message.id}`);
    console.log('\n📊 Metadata structure:');
    console.log(JSON.stringify(metadata, null, 2));

    // Step 6: Validate metadata structure
    console.log('\n5️⃣  Validating metadata...');
    console.log('----------------------------------------------------------------------');

    const validationResults = [];

    // Check base metadata
    if (metadata.model_name) {
      validationResults.push('✓ model_name present');
    } else {
      validationResults.push('✗ model_name missing');
    }

    if (metadata.provider) {
      validationResults.push('✓ provider present');
    } else {
      validationResults.push('✗ provider missing');
    }

    if (metadata.timestamp) {
      validationResults.push('✓ timestamp present');
    } else {
      validationResults.push('✗ timestamp missing');
    }

    // Check GraphRAG metadata (if present)
    if (metadata.graphrag) {
      console.log('\n✨ GraphRAG metadata found!');
      const grag = metadata.graphrag;

      // Validate fields
      if (typeof grag.graph_used === 'boolean') {
        validationResults.push(`✓ graph_used: ${grag.graph_used}`);
      } else {
        validationResults.push('✗ graph_used missing or wrong type');
      }

      if (typeof grag.nodes_retrieved === 'number') {
        validationResults.push(`✓ nodes_retrieved: ${grag.nodes_retrieved}`);
      } else {
        validationResults.push('✗ nodes_retrieved missing or wrong type');
      }

      if (typeof grag.context_chunks_used === 'number') {
        validationResults.push(`✓ context_chunks_used: ${grag.context_chunks_used}`);
      } else {
        validationResults.push('✗ context_chunks_used missing or wrong type');
      }

      if (typeof grag.retrieval_time_ms === 'number') {
        validationResults.push(`✓ retrieval_time_ms: ${grag.retrieval_time_ms}ms`);
      } else {
        validationResults.push('✗ retrieval_time_ms missing or wrong type');
      }

      if (typeof grag.context_relevance_score === 'number') {
        validationResults.push(`✓ context_relevance_score: ${grag.context_relevance_score.toFixed(2)}`);
      } else {
        validationResults.push('✗ context_relevance_score missing or wrong type');
      }

      if (typeof grag.answer_grounded_in_graph === 'boolean') {
        validationResults.push(`✓ answer_grounded_in_graph: ${grag.answer_grounded_in_graph}`);
      } else {
        validationResults.push('✗ answer_grounded_in_graph missing or wrong type');
      }

      if (grag.retrieval_method) {
        validationResults.push(`✓ retrieval_method: ${grag.retrieval_method}`);
      } else {
        validationResults.push('✗ retrieval_method missing');
      }
    } else {
      console.log('\nℹ️  GraphRAG metadata not present');
      console.log('   This is normal if:');
      console.log('   - No documents uploaded for this user');
      console.log('   - Query did not match any documents');
      console.log('   - GraphRAG is disabled');
    }

    validationResults.forEach(result => console.log(`   ${result}`));

    // Step 7: Cleanup
    console.log('\n6️⃣  Cleaning up test data...');
    console.log('----------------------------------------------------------------------');

    await supabase.from('conversations').delete().eq('id', conversationId);
    console.log('✓ Test conversation deleted\n');

    console.log('======================================================================');
    console.log('✅ GraphRAG Metadata Test Complete!');
    console.log('======================================================================\n');

    if (metadata.graphrag) {
      console.log('💡 Summary:');
      console.log(`   GraphRAG was ${metadata.graphrag.graph_used ? 'USED' : 'NOT USED'}`);
      console.log(`   ${metadata.graphrag.nodes_retrieved} nodes retrieved`);
      console.log(`   ${metadata.graphrag.context_chunks_used} context chunks used`);
      console.log(`   Retrieval took ${metadata.graphrag.retrieval_time_ms}ms`);
      console.log(`   Relevance score: ${(metadata.graphrag.context_relevance_score * 100).toFixed(1)}%`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testGraphRAGMetadata();
