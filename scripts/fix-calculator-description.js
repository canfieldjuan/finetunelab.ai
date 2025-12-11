#!/usr/bin/env node
// Fix calculator tool description to make LLM actually use it

const fs = require('fs');
const path = require('path');

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const NEW_DESCRIPTION = 
  'A calculator tool for performing PRECISE mathematical calculations. ' +
  'You MUST use this tool for ANY mathematical computation, percentage calculation, ' +
  'or numeric operation instead of approximating or calculating manually. ' +
  'Supports arithmetic (+, -, *, /), percentages (convert to decimal: 23% = 0.23), ' +
  'powers, roots, and trigonometry. For percentage calculations, convert to decimal ' +
  'form (e.g., "23% of 456" becomes "0.23 * 456").';

async function updateDescription() {
  console.log('='.repeat(60));
  console.log('UPDATING CALCULATOR TOOL DESCRIPTION');
  console.log('='.repeat(60));

  console.log('\n[OLD DESCRIPTION]');
  const { data: oldData } = await supabase
    .from('tools')
    .select('description')
    .eq('name', 'calculator')
    .single();
  
  console.log(oldData?.description || 'Not found');

  console.log('\n[NEW DESCRIPTION]');
  console.log(NEW_DESCRIPTION);

  console.log('\n[UPDATING...]');
  const { data, error } = await supabase
    .from('tools')
    .update({ description: NEW_DESCRIPTION })
    .eq('name', 'calculator')
    .select();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('✓ Successfully updated!');
  console.log('\n[VERIFICATION]');
  console.log('Updated description:', data[0].description);
  
  console.log('\n' + '='.repeat(60));
  console.log('NEXT STEPS:');
  console.log('1. Refresh the browser page to reload tools');
  console.log('2. Try: "Calculate 23% of 456"');
  console.log('3. LLM should now USE the calculator tool');
  console.log('='.repeat(60));
}

updateDescription();
