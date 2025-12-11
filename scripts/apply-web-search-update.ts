// Apply web_search tool parameter update
// Run with: npx tsx scripts/apply-web-search-update.ts

import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateWebSearchTool() {
  console.log('[Update] Updating web_search tool parameters...\n');

  const newParameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      maxResults: {
        type: 'number',
        description: 'Max results for standard search'
      },
      deepSearch: {
        type: 'boolean',
        description: 'Enable full content fetching for standard search'
      },
      summarize: {
        type: 'boolean',
        description: 'Generate AI summaries of search results (RECOMMENDED: always use true for better quality results)'
      },
      deepResearchConfirmed: {
        type: 'boolean',
        description: 'Confirm to start a deep research session'
      }
    },
    required: ['query']
  };

  const { data, error } = await supabase
    .from('tools')
    .update({
      description: 'Search the web for CURRENT, UP-TO-DATE information. ALWAYS use summarize=true to get AI-enhanced summaries instead of raw snippets. For comprehensive research topics, the system will suggest deep research mode.',
      parameters: newParameters,
      updated_at: new Date().toISOString()
    })
    .eq('name', 'web_search')
    .select();

  if (error) {
    console.error('[Update] ❌ Error updating tool:', error.message);
    return;
  }

  console.log('[Update] ✅ Successfully updated web_search tool');
  console.log('\n[Update] New parameters:');
  console.log(JSON.stringify(newParameters, null, 2));

  // Verify
  const { data: verified } = await supabase
    .from('tools')
    .select('parameters')
    .eq('name', 'web_search')
    .single();

  if (verified && verified.parameters.properties.summarize) {
    console.log('\n[Update] ✅ Verification passed - summarize parameter exists');
  } else {
    console.log('\n[Update] ⚠️  Verification failed - check parameters');
  }
}

updateWebSearchTool().catch(console.error);
