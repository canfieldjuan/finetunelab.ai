// Check if tools table exists and web_search is enabled
// Run with: npx tsx scripts/check-tools-table.ts

import { config } from 'dotenv';
config(); // Load .env file

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkToolsTable() {
  console.log('[Check] Checking tools table...\n');

  // Check if table exists
  const { data: tables, error: tablesError } = await supabase
    .from('tools')
    .select('*')
    .limit(1);

  if (tablesError) {
    console.error('[Check] ❌ Tools table does not exist or error:', tablesError.message);
    console.log('\n[Check] You need to create the tools table and populate it.');
    console.log('[Check] Run: npm run migrate or create a migration for the tools table');
    return;
  }

  console.log('[Check] ✅ Tools table exists\n');

  // Get all tools
  const { data: allTools, error: allToolsError } = await supabase
    .from('tools')
    .select('name, is_enabled, is_builtin');

  if (allToolsError) {
    console.error('[Check] Error fetching tools:', allToolsError.message);
    return;
  }

  console.log('[Check] All tools in database:');
  console.table(allTools);

  // Check web_search specifically
  const { data: webSearch, error: webSearchError } = await supabase
    .from('tools')
    .select('*')
    .eq('name', 'web_search')
    .single();

  if (webSearchError || !webSearch) {
    console.log('\n[Check] ❌ web_search tool NOT FOUND in database');
    console.log('[Check] The tool is registered in code but missing from database');
    console.log('[Check] You need to insert it into the tools table\n');
    return;
  }

  console.log('\n[Check] web_search tool found:');
  console.log(JSON.stringify(webSearch, null, 2));

  if (!webSearch.is_enabled) {
    console.log('\n[Check] ⚠️  web_search is DISABLED in database');
    console.log('[Check] Run this SQL to enable it:');
    console.log("UPDATE tools SET is_enabled = true WHERE name = 'web_search';");
  } else {
    console.log('\n[Check] ✅ web_search is ENABLED in database');
  }
}

checkToolsTable().catch(console.error);
