/**
 * Schema Verification Script
 * Checks current Supabase table schema and reports missing columns
 */

// Update the import path if your supabaseClient is located elsewhere, for example:
import { supabase } from '../../../supabaseClient';
// Or create the file at '../../../lib/supabaseClient.ts' with the following content:

// import { createClient } from '@supabase/supabase-js';
// export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function checkTableSchema() {
  console.log('========================================');
  console.log('Web Search Cache - Schema Verification');
  console.log('========================================\n');

  try {
    // Try to query the table to see what columns exist
    const { data, error } = await supabase
      .from('search_summaries')
      .select('*')
      .limit(1);

    if (error) {
      console.error('ERROR querying table:', error.message);
      console.log('\nTable might not exist or have permission issues.');
      return;
    }

    console.log('SUCCESS: Table exists and is accessible\n');

    // Get column names from the data
    const existingColumns = data && data.length > 0 
      ? Object.keys(data[0]) 
      : [];

    console.log('Current columns:');
    existingColumns.forEach(col => {
      console.log(`  - ${col}`);
    });

    // Required columns for cache implementation
    const requiredColumns = [
      'id',
      'query_hash',
      'query_text',
      'provider',
      'max_results',
      'result_count',
      'results',
      'raw_response',
      'latency_ms',
      'fetched_at',
      'expires_at',
      'created_at',
      'updated_at',
    ];

    console.log('\nRequired columns:');
    requiredColumns.forEach(col => {
      console.log(`  - ${col}`);
    });

    const missingColumns = requiredColumns.filter(
      col => !existingColumns.includes(col)
    );

    if (missingColumns.length === 0) {
      console.log('\n✅ SUCCESS: All required columns are present!');
      console.log('\nCache is ready to use with Base AI plan.');
      console.log('Make sure SEARCH_CACHE_ENABLED=true in .env');
    } else {
      console.log('\n⚠️  WARNING: Missing columns detected:');
      missingColumns.forEach(col => {
        console.log(`  - ${col}`);
      });
      console.log('\nPlease run the migration SQL in Supabase SQL Editor:');
      console.log('  File: migrations/tools/web-search/001_add_cache_columns.sql');
    }

  } catch (err) {
    console.error('ERROR:', err);
  }
}

// Run the check
checkTableSchema();
