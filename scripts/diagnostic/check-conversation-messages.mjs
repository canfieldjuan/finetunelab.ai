#!/usr/bin/env node

/**
 * Check if messages exist in batch test conversations
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // Get recent batch test conversations
  const { data: convos, error: convoError } = await supabase
    .from('conversations')
    .select('id, title, batch_test_run_id, llm_model_id, created_at')
    .not('batch_test_run_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (convoError) {
    console.error('Error fetching conversations:', convoError);
    process.exit(1);
  }

  console.log('Recent Batch Test Conversations:\n');

  for (const convo of convos) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Conversation: ${convo.title}`);
    console.log(`ID: ${convo.id}`);
    console.log(`Batch Test Run: ${convo.batch_test_run_id}`);
    console.log(`Model ID: ${convo.llm_model_id}`);
    console.log(`Created: ${convo.created_at}`);

    // Check for messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', convo.id)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error('Error fetching messages:', msgError);
    } else {
      console.log(`\nMessages: ${messages.length} total`);

      if (messages.length === 0) {
        console.log('⚠️  NO MESSAGES FOUND IN THIS CONVERSATION');
      } else {
        for (const msg of messages) {
          console.log(`  - [${msg.role}] ${msg.content.substring(0, 60)}... (${msg.created_at})`);
        }
      }
    }

    // Check batch test results
    const { data: results, error: resultsError } = await supabase
      .from('batch_test_results')
      .select('id, prompt, response, success, error, created_at')
      .eq('test_run_id', convo.batch_test_run_id)
      .order('created_at', { ascending: true });

    if (resultsError) {
      console.error('Error fetching results:', resultsError);
    } else {
      console.log(`\nBatch Test Results: ${results.length} total`);

      if (results.length === 0) {
        console.log('⚠️  NO BATCH TEST RESULTS FOUND');
      } else {
        for (const result of results) {
          console.log(`  - ${result.success ? '✅' : '❌'} Prompt: ${result.prompt.substring(0, 40)}...`);
          if (result.response) {
            console.log(`    Response: ${result.response.substring(0, 50)}...`);
          }
          if (result.error) {
            console.log(`    Error: ${result.error}`);
          }
        }
      }
    }
  }
}

main();
