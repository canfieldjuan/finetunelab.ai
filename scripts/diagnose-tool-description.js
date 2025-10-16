#!/usr/bin/env node
// Diagnostic: Check what tools are being sent to the LLM

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
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkToolDefinition() {
  console.log('='.repeat(60));
  console.log('TOOL DEFINITION DIAGNOSTIC');
  console.log('='.repeat(60));

  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .eq('name', 'calculator')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n[DATABASE] Calculator tool:');
  console.log('  Name:', data.name);
  console.log('  Description:', data.description);
  console.log('  Enabled:', data.enabled);
  console.log('\n[PARAMETERS SCHEMA]');
  console.log(JSON.stringify(data.parameters, null, 2));

  console.log('\n[WHAT FRONTEND SENDS TO API]');
  const apiFormat = {
    type: 'function',
    function: {
      name: data.name,
      description: data.description,
      parameters: data.parameters,
    }
  };
  console.log(JSON.stringify(apiFormat, null, 2));

  console.log('\n[ANALYSIS]');
  console.log('Description length:', data.description.length, 'characters');
  
  const hasKeywords = {
    'use this': data.description.toLowerCase().includes('use this'),
    'always': data.description.toLowerCase().includes('always'),
    'must': data.description.toLowerCase().includes('must'),
    'calculate': data.description.toLowerCase().includes('calculate'),
    'mathematical': data.description.toLowerCase().includes('mathematical'),
  };
  
  console.log('Directive keywords:');
  Object.entries(hasKeywords).forEach(([keyword, found]) => {
    console.log(`  ${found ? '✓' : '✗'} "${keyword}"`);
  });

  const recommendedDescription = 
    'A calculator tool for performing precise mathematical calculations. ' +
    'ALWAYS use this tool for ANY mathematical computation, percentage calculation, ' +
    'or numeric operation instead of approximating. Supports arithmetic (+, -, *, /), ' +
    'percentages (e.g., "0.23 * 456"), and algebraic expressions.';

  console.log('\n[RECOMMENDATION]');
  console.log('Current description is too vague. LLM needs explicit directive.');
  console.log('\nRecommended description:');
  console.log(`"${recommendedDescription}"`);
  
  console.log('\n' + '='.repeat(60));
}

checkToolDefinition();
