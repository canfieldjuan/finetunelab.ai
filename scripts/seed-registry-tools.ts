// Sync registered chat tools to the database.
// Run: npx tsx scripts/seed-registry-tools.ts

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getAllTools } from '../lib/tools/registry';
import { buildRegistryToolSeedRows } from '../lib/tools/registry-sync';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[SeedTools] Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncTools() {
  const rows = buildRegistryToolSeedRows(getAllTools());
  const activeNames = new Set(rows.map((row) => row.name));

  console.log('[SeedTools] Syncing registered chat tools');
  console.log(`[SeedTools] Registry rows: ${rows.length}\n`);

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    const { data: existingRows, error: lookupError } = await supabase
      .from('tools')
      .select('id, name')
      .eq('name', row.name)
      .limit(1);

    if (lookupError) {
      failed++;
      console.error(`[SeedTools] x ${row.name}: lookup failed: ${lookupError.message}`);
      continue;
    }

    const existing = existingRows?.[0];
    if (existing?.id) {
      const { error } = await supabase
        .from('tools')
        .update({
          description: row.description,
          parameters: row.parameters,
          is_builtin: row.is_builtin,
          is_enabled: row.is_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        failed++;
        console.error(`[SeedTools] x ${row.name}: update failed: ${error.message}`);
      } else {
        updated++;
        console.log(`[SeedTools] updated ${row.name} (${row.is_enabled ? 'enabled' : 'disabled'})`);
      }
      continue;
    }

    const { error } = await supabase
      .from('tools')
      .insert({
        name: row.name,
        description: row.description,
        parameters: row.parameters,
        is_builtin: row.is_builtin,
        is_enabled: row.is_enabled,
      });

    if (error) {
      failed++;
      console.error(`[SeedTools] x ${row.name}: insert failed: ${error.message}`);
    } else {
      inserted++;
      console.log(`[SeedTools] inserted ${row.name} (${row.is_enabled ? 'enabled' : 'disabled'})`);
    }
  }

  const { data: builtinRows, error: builtinError } = await supabase
    .from('tools')
    .select('name, is_enabled')
    .eq('is_builtin', true);

  if (builtinError) {
    failed++;
    console.error(`[SeedTools] x stale scan failed: ${builtinError.message}`);
  } else {
    const staleRows = (builtinRows || []).filter((row) => !activeNames.has(row.name));
    for (const row of staleRows) {
      if (!row.is_enabled) continue;
      const { error } = await supabase
        .from('tools')
        .update({ is_enabled: false, updated_at: new Date().toISOString() })
        .eq('name', row.name);

      if (error) {
        failed++;
        console.error(`[SeedTools] x ${row.name}: stale disable failed: ${error.message}`);
      } else {
        updated++;
        console.log(`[SeedTools] disabled stale builtin ${row.name}`);
      }
    }
  }

  console.log('\n[SeedTools] Sync complete');
  console.log(`[SeedTools] Inserted: ${inserted}`);
  console.log(`[SeedTools] Updated: ${updated}`);
  console.log(`[SeedTools] Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

syncTools().catch((error) => {
  console.error('[SeedTools] Fatal error:', error);
  process.exit(1);
});
