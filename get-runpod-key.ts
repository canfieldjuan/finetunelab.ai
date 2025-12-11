#!/usr/bin/env npx ts-node
/**
 * Retrieve RunPod API key from Supabase secrets vault
 * and configure runpodctl CLI
 */

import { createClient } from '@supabase/supabase-js';
import { decrypt } from './lib/models/encryption';
import { execSync } from 'child_process';

async function main() {
  // Get Supabase credentials from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('[RunPod Key] Querying secrets vault for RunPod API key...');

  // Query secrets vault - get the first RunPod secret
  const { data, error } = await supabase
    .from('provider_secrets')
    .select('*')
    .ilike('provider', 'runpod')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('❌ Error querying secrets:', error);
    process.exit(1);
  }

  if (!data) {
    console.error('❌ No RunPod secret found for this user');
    process.exit(1);
  }

  console.log('✓ RunPod secret found');

  // Decrypt API key
  const apiKey = decrypt(data.api_key_encrypted);
  console.log('✓ API key decrypted:', apiKey.substring(0, 10) + '...');

  // Configure runpodctl
  console.log('\n[RunPod Key] Configuring runpodctl...');
  try {
    execSync(`runpodctl config --apiKey "${apiKey}"`, { stdio: 'inherit' });
    console.log('✓ runpodctl configured successfully!');

    // Test by listing pods
    console.log('\n[RunPod Key] Testing configuration - listing pods...');
    execSync('runpodctl get pod', { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Failed to configure runpodctl:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main().catch(console.error);
