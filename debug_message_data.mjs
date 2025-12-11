#!/usr/bin/env node
/**
 * Debug: Check what data is actually in messages
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugMessages() {
  console.log('🔍 Checking message data...\n');

  // Get recent assistant messages
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, role, model_id, provider, llm_model_id, input_tokens, output_tokens, latency_ms')
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (!messages || messages.length === 0) {
    console.log('No assistant messages found');
    return;
  }

  console.log(`Found ${messages.length} recent assistant messages:\n`);
  
  messages.forEach((msg, i) => {
    console.log(`Message ${i + 1}:`);
    console.log(`  ID: ${msg.id}`);
    console.log(`  model_id: ${msg.model_id || 'NULL'}`);
    console.log(`  provider: ${msg.provider || 'NULL'}`);
    console.log(`  llm_model_id: ${msg.llm_model_id || 'NULL'}`);
    console.log(`  input_tokens: ${msg.input_tokens || 'NULL'}`);
    console.log(`  output_tokens: ${msg.output_tokens || 'NULL'}`);
    console.log(`  latency_ms: ${msg.latency_ms || 'NULL'}`);
    console.log('');
  });

  // Check if we have any llm_model_id values
  const hasModelIds = messages.some(m => m.llm_model_id);
  
  if (!hasModelIds) {
    console.log('⚠️  No llm_model_id found in messages!');
    console.log('This means messages are using old schema (model_id instead of llm_model_id)');
    console.log('');
    
    // Check llm_models table
    const { data: models, error: modelsError } = await supabase
      .from('llm_models')
      .select('id, name, model_id, provider')
      .limit(5);
    
    if (modelsError) {
      console.log('❌ Error checking llm_models table:', modelsError.message);
    } else if (!models || models.length === 0) {
      console.log('❌ llm_models table is empty!');
    } else {
      console.log('✅ llm_models table has data:');
      models.forEach(m => {
        console.log(`  - ${m.name} (${m.provider}) [ID: ${m.id}]`);
      });
    }
  } else {
    console.log('✅ Messages have llm_model_id, checking if we can fetch names...\n');
    
    const modelIds = messages
      .map(m => m.llm_model_id)
      .filter(id => id != null);
    
    const { data: models, error: modelsError } = await supabase
      .from('llm_models')
      .select('id, name, model_id, provider')
      .in('id', modelIds);
    
    if (modelsError) {
      console.log('❌ Error fetching model names:', modelsError.message);
    } else if (!models || models.length === 0) {
      console.log('❌ No matching models found in llm_models table');
    } else {
      console.log(`✅ Found ${models.length} model(s):`);
      models.forEach(m => {
        console.log(`  - ${m.name} (${m.provider}) [ID: ${m.id}]`);
      });
    }
  }
}

debugMessages();
