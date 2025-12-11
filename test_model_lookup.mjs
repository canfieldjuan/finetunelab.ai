#!/usr/bin/env node
/**
 * Test the OR query for model lookup
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

async function testModelLookup() {
  console.log('🧪 Testing model lookup query...\n');

  // Get model_ids from messages
  const { data: messages } = await supabase
    .from('messages')
    .select('model_id')
    .eq('role', 'assistant')
    .not('model_id', 'is', null)
    .limit(5);

  const modelIds = [...new Set(messages?.map(m => m.model_id) || [])];
  console.log('Model IDs from messages:', modelIds);
  console.log('');

  // Test the OR query
  const orQuery = modelIds.map(id => `id.eq.${id},model_id.eq.${id}`).join(',');
  console.log('OR Query:', orQuery);
  console.log('');

  const { data: models, error } = await supabase
    .from('llm_models')
    .select('id, name, model_id, provider')
    .or(orQuery);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Found ${models?.length || 0} models:\n`);
  
  models?.forEach(m => {
    console.log(`  ${m.name} (${m.provider})`);
    console.log(`    id: ${m.id}`);
    console.log(`    model_id: ${m.model_id}`);
    console.log('');
  });

  // Show what the modelMap would contain
  const modelMap = new Map();
  models?.forEach(m => {
    const modelInfo = { name: m.name || m.model_id, provider: m.provider };
    modelMap.set(m.id, modelInfo);
    modelMap.set(m.model_id, modelInfo);
  });

  console.log(`📊 ModelMap has ${modelMap.size} entries:`);
  modelMap.forEach((info, key) => {
    console.log(`  "${key}" -> ${info.name} (${info.provider})`);
  });
  console.log('');

  // Test lookups
  console.log('🔍 Testing lookups:');
  modelIds.forEach(id => {
    const found = modelMap.get(id);
    if (found) {
      console.log(`  ✅ "${id}" -> ${found.name}`);
    } else {
      console.log(`  ❌ "${id}" -> NOT FOUND`);
    }
  });
}

testModelLookup();
