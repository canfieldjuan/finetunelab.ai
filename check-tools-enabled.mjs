import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== CHECKING TOOLS TABLE ===\n');

// Get all tools (enabled and disabled)
const { data: allTools, error } = await supabase
  .from('tools')
  .select('name, is_enabled, is_builtin')
  .order('name');

if (error) {
  console.error('Error fetching tools:', error);
  process.exit(1);
}

if (!allTools || allTools.length === 0) {
  console.error('❌ NO TOOLS FOUND IN DATABASE!');
  console.error('This explains why traces have empty toolDefinitions.');
  console.error('\nYou need to seed the tools table with default tools.');
  process.exit(1);
}

console.log(`Found ${allTools.length} tools total:\n`);

const enabledTools = allTools.filter(t => t.is_enabled);
const disabledTools = allTools.filter(t => !t.is_enabled);

console.log(`✅ ENABLED (${enabledTools.length}):`);
enabledTools.forEach(t => {
  console.log(`   - ${t.name}${t.is_builtin ? ' (builtin)' : ''}`);
});

if (disabledTools.length > 0) {
  console.log(`\n❌ DISABLED (${disabledTools.length}):`);
  disabledTools.forEach(t => {
    console.log(`   - ${t.name}${t.is_builtin ? ' (builtin)' : ''}`);
  });
}

console.log('\n=== DIAGNOSIS ===');
if (enabledTools.length === 0) {
  console.log('❌ PROBLEM FOUND: No tools are enabled!');
  console.log('This is why traces have empty toolDefinitions.');
  console.log('\nSOLUTION: Enable tools in the database:');
  console.log('UPDATE tools SET is_enabled = true WHERE name IN (\'web_search\', \'query_knowledge_graph\', \'calculator\', \'datetime_tool\');');
} else {
  console.log('✅ Tools are enabled and should appear in traces.');
  console.log('The issue must be elsewhere in the flow.');
}
