#!/usr/bin/env node

/**
 * Check if user has active API keys for batch testing
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
  // Get user ID from scheduled evaluation
  const { data: schedule } = await supabase
    .from('scheduled_evaluations')
    .select('user_id, name')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!schedule) {
    console.log('No active scheduled evaluations found');
    return;
  }

  const userId = schedule.user_id;
  console.log(`Checking API keys for user: ${userId}`);
  console.log(`From schedule: ${schedule.name}\n`);

  const { data: apiKeys, error } = await supabase
    .from('user_api_keys')
    .select('id, key, name, is_active, created_at')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching API keys:', error);
    process.exit(1);
  }

  console.log(`Total API keys: ${apiKeys.length}`);
  console.log(`Active API keys: ${apiKeys.filter(k => k.is_active).length}\n`);

  for (const key of apiKeys) {
    console.log(`Key: ${key.name || 'Unnamed'}`);
    console.log(`  ID: ${key.id}`);
    console.log(`  Key: ${key.key.substring(0, 20)}...`);
    console.log(`  Active: ${key.is_active ? '✅' : '❌'}`);
    console.log(`  Created: ${key.created_at}`);
    console.log('');
  }

  if (apiKeys.filter(k => k.is_active).length === 0) {
    console.log('⚠️  WARNING: No active API keys found!');
    console.log('Batch tests will fail without an active API key.');
    console.log('Create one at: https://finetunelab.ai/settings/api-keys');
  }
}

main();
