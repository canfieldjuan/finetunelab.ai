#!/usr/bin/env node
/**
 * Verify Messages Table Schema
 * 
 * This script queries the Supabase database to check what fields
 * are actually available in the messages table.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

console.log('🔍 Verifying Messages Table Schema\n');
console.log('Supabase URL:', supabaseUrl);
console.log('');

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
  try {
    // Try to fetch count first to see if table has any rows
    const { count, error: countError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error checking message count:', countError.message);
      return;
    }

    console.log(`📊 Total messages in database: ${count || 0}\n`);

    if (count === 0) {
      console.log('⚠️  No messages found. This might indicate:');
      console.log('  • RLS policies preventing access');
      console.log('  • Empty database');
      console.log('  • Need to use service role key\n');
      console.log('💡 To see actual schema, we need at least one message or admin access');
      return;
    }

    // Fetch a recent message to see what fields are actually available
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Error fetching message:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️  No messages found in database');
      return;
    }

    const message = data[0];

    console.log('✅ Successfully fetched message\n');
    console.log('📋 Available Fields:');
    console.log('='.repeat(60));
    
    const fields = Object.keys(message).sort();
    fields.forEach(field => {
      const value = message[field];
      const type = typeof value;
      const displayValue = value === null 
        ? 'null' 
        : type === 'string' && value.length > 50
        ? `"${value.substring(0, 50)}..."`
        : type === 'string'
        ? `"${value}"`
        : JSON.stringify(value);
      
      console.log(`  ${field.padEnd(20)} ${type.padEnd(10)} ${displayValue}`);
    });

    console.log('='.repeat(60));
    console.log('');
    console.log('🎯 Fields relevant for metadata display:');
    
    const metadataFields = [
      'model_id',
      'provider',
      'input_tokens',
      'output_tokens',
      'latency_ms',
      'metadata',
      'llm_model_id'
    ];

    metadataFields.forEach(field => {
      if (fields.includes(field)) {
        console.log(`  ✅ ${field}: ${typeof message[field]} (${message[field] === null ? 'NULL' : 'HAS VALUE'})`);
      } else {
        console.log(`  ❌ ${field}: NOT FOUND`);
      }
    });

    console.log('');
    console.log('💡 Recommendations:');
    
    if (fields.includes('llm_model_id') && fields.includes('provider')) {
      console.log('  ✅ Model identification data is available (llm_model_id, provider)');
      console.log('  ✅ Will need to join with llm_models table to get model name');
    }
    
    if (fields.includes('input_tokens') && fields.includes('output_tokens')) {
      console.log('  ✅ Token usage data is available');
    }
    
    if (fields.includes('latency_ms')) {
      console.log('  ✅ Latency data is available');
    }
    
    if (fields.includes('metadata')) {
      console.log('  ℹ️  Generic metadata field exists (JSONB)');
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

verifySchema();
