// Check if calculator tool is enabled in database
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env manually
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.log('Note: Could not load .env, using existing environment variables');
  }
}

loadEnv();

async function checkCalculatorTool() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env');
    console.log('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Checking calculator tool in database...\n');

  // Check if calculator tool exists
  const { data: tools, error } = await supabase
    .from('tools')
    .select('*')
    .eq('name', 'calculator');

  if (error) {
    console.error('❌ Error querying database:', error.message);
    process.exit(1);
  }

  if (!tools || tools.length === 0) {
    console.log('❌ Calculator tool NOT FOUND in database');
    console.log('\nTo add it, you need to insert it into the tools table.');
    console.log('Would you like me to create an insert script?');
    process.exit(1);
  }

  const tool = tools[0];
  console.log('✅ Calculator tool found!\n');
  console.log('Tool Details:');
  console.log('─'.repeat(50));
  console.log(`ID:          ${tool.id}`);
  console.log(`Name:        ${tool.name}`);
  console.log(`Description: ${tool.description}`);
  console.log(`Enabled:     ${tool.is_enabled ? '✅ YES' : '❌ NO'}`);
  console.log(`Builtin:     ${tool.is_builtin ? 'Yes' : 'No'}`);
  console.log(`Created:     ${tool.created_at}`);
  console.log('─'.repeat(50));
  
  if (tool.parameters) {
    console.log('\nParameters Schema:');
    console.log(JSON.stringify(tool.parameters, null, 2));
  }

  if (!tool.is_enabled) {
    console.log('\n⚠️  WARNING: Calculator tool is DISABLED!');
    console.log('To enable it, run:');
    console.log(`UPDATE tools SET is_enabled = true WHERE name = 'calculator';`);
  } else {
    console.log('\n✅ Calculator tool is enabled and ready to use!');
  }

  // Check all enabled tools
  const { data: enabledTools } = await supabase
    .from('tools')
    .select('name, is_enabled')
    .eq('is_enabled', true);

  console.log(`\n📊 Total enabled tools: ${enabledTools?.length || 0}`);
  if (enabledTools && enabledTools.length > 0) {
    console.log('Enabled tools:', enabledTools.map(t => t.name).join(', '));
  }
}

checkCalculatorTool().catch(console.error);
