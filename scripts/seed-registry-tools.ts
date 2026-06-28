// Sync registered chat tools to the database.
// Run: npx tsx scripts/seed-registry-tools.ts

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(repoRoot, '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[SeedTools] Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncTools() {
  const [{ getAllTools }, { buildRegistryToolSeedRows, mergeRegistryToolSeedRow }] = await Promise.all([
    import('../lib/tools/registry'),
    import('../lib/tools/registry-sync'),
  ]);
  const rows = buildRegistryToolSeedRows(getAllTools());

  console.log('[SeedTools] Syncing registered tools');
  console.log(`[SeedTools] Registry rows: ${rows.length}\n`);

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    const { data: existingRows, error: lookupError } = await supabase
      .from('tools')
      .select('id, name, is_enabled')
      .eq('name', row.name)
      .limit(1);

    if (lookupError) {
      failed++;
      console.error(`[SeedTools] x ${row.name}: lookup failed: ${lookupError.message}`);
      continue;
    }

    const existing = existingRows?.[0];
    if (existing?.id) {
      const mergedRow = mergeRegistryToolSeedRow(row, existing);
      const { error } = await supabase
        .from('tools')
        .update({
          description: mergedRow.description,
          parameters: mergedRow.parameters,
          // Registry-owned rows are canonical built-ins even if a legacy row
          // was inserted with is_builtin=false.
          is_builtin: mergedRow.is_builtin,
          is_enabled: mergedRow.is_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        failed++;
        console.error(`[SeedTools] x ${row.name}: update failed: ${error.message}`);
      } else {
        updated++;
        console.log(`[SeedTools] updated ${row.name} (${mergedRow.is_enabled ? 'enabled' : 'disabled'})`);
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
