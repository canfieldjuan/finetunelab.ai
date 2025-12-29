// Verify Tool Schemas in Database
// Check that invalid 'required' properties have been removed
// Date: October 14, 2025

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env file manually
const envPath = join(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[VerifySchemas] Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchemas() {
  console.log('[VerifySchemas] Fetching tool schemas from database...\n');

  const { data, error } = await supabase
    .from('tools')
    .select('name, parameters, is_enabled')
    .eq('is_enabled', true)
    .order('name');

  if (error) {
    console.error('[VerifySchemas] Error:', error);
    process.exit(1);
  }

  console.log(`[VerifySchemas] Found ${data?.length} enabled tools\n`);

  let allValid = true;

  data?.forEach(tool => {
    const params = tool.parameters as unknown;

    // Check for invalid nested 'required' in property definitions
    let hasInvalidRequired = false;
    if (params?.properties) {
      Object.keys(params.properties).forEach(propName => {
        const prop = params.properties[propName];
        if (prop.required !== undefined) {
          hasInvalidRequired = true;
          console.log(`✗ ${tool.name}: Property '${propName}' has invalid 'required' field`);
          allValid = false;
        }
      });
    }

    // Check for valid 'required' array at schema level
    const hasValidRequired = Array.isArray(params?.required);

    if (!hasInvalidRequired) {
      console.log(`✓ ${tool.name}: No invalid nested 'required' properties`);
    }

    if (hasValidRequired) {
      console.log(`  ✓ Has valid 'required' array: [${params.required.join(', ')}]`);
    } else {
      console.log(`  ✗ Missing or invalid 'required' array`);
      allValid = false;
    }

    // Show the actual JSON being sent to OpenAI
    console.log(`  Schema preview: ${JSON.stringify(params, null, 2).substring(0, 200)}...\n`);
  });

  if (allValid) {
    console.log('\n✓ All tool schemas are valid!');
    process.exit(0);
  } else {
    console.log('\n✗ Some tool schemas have errors');
    process.exit(1);
  }
}

verifySchemas();
