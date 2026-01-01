#!/usr/bin/env npx tsx

/**
 * Check if tables are in supabase_realtime publication
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPublication() {
  console.log('🔍 Checking publication status...\n');

  // Query to check if tables are in publication
  const query = `
    SELECT schemaname, tablename
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename IN ('local_training_jobs', 'local_training_metrics')
    ORDER BY tablename;
  `;

  try {
    // Use the REST API to query the database
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      console.error('❌ Query failed:', response.status, await response.text());
      console.log('\n💡 Run this query manually in Supabase SQL Editor:');
      console.log(query);
      process.exit(1);
    }

    const result = await response.json();
    console.log('Publication check result:', result);

    if (result && result.length > 0) {
      console.log('✅ Tables in supabase_realtime publication:');
      result.forEach((row: unknown) => {
        console.log(`   - ${row.tablename} (schema: ${row.schemaname})`);
      });
    } else {
      console.log('❌ NO tables found in supabase_realtime publication');
      console.log('\n💡 The tables are NOT in the realtime publication.');
      console.log('   This is why realtime subscriptions are timing out.');
    }

    // Also check replica identity
    const replicaQuery = `
      SELECT
        c.relname AS tablename,
        CASE c.relreplident
          WHEN 'd' THEN 'default'
          WHEN 'n' THEN 'nothing'
          WHEN 'f' THEN 'full'
          WHEN 'i' THEN 'index'
        END AS replica_identity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('local_training_jobs', 'local_training_metrics')
        AND c.relkind = 'r';
    `;

    const replicaResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: replicaQuery })
    });

    if (replicaResponse.ok) {
      const replicaResult = await replicaResponse.json();
      console.log('\n📊 Replica Identity:');
      replicaResult.forEach((row: unknown) => {
        console.log(`   - ${row.tablename}: ${row.replica_identity}`);
      });
    }

  } catch (error: unknown) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkPublication();
