#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: recentMessages } = await supabase
  .from('messages')
  .select('id, model_id, provider, created_at')
  .eq('role', 'assistant')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('Recent messages with model_id:\n');
recentMessages?.forEach(m => {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.model_id || '');
  console.log(`${m.created_at.substring(0, 19)}: "${m.model_id}" (${isUUID ? 'UUID' : 'STRING'}) provider: ${m.provider}`);
});

// Check if gpt-4o-mini exists in llm_models
const { data: gptMini } = await supabase
  .from('llm_models')
  .select('id, name, model_id, provider')
  .or('model_id.eq.gpt-4o-mini,id.eq.gpt-4o-mini');

console.log('\nSearching llm_models for "gpt-4o-mini":');
if (!gptMini || gptMini.length === 0) {
  console.log('❌ NOT FOUND');
} else {
  gptMini.forEach(m => {
    console.log(`✅ ${m.name} (id: ${m.id}, model_id: ${m.model_id})`);
  });
}
