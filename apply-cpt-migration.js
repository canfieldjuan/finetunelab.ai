const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const sql = fs.readFileSync('supabase/migrations/20251218000001_add_raw_text_format_and_fix_storage_constraint.sql', 'utf8');

// Use postgres connection if available
const Database = require('better-sqlite3'); // Not available, will use fetch

async function applySQLDirectly(sqlStatements) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
    console.log('Please run this SQL manually in Supabase SQL Editor:');
    console.log('---');
    console.log(sqlStatements);
    console.log('---');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Try to execute via REST API
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    },
    body: JSON.stringify({ query: sqlStatements })
  });

  if (!response.ok) {
    console.error('Failed to execute SQL via API');
    console.log('Please run this SQL manually in Supabase SQL Editor:');
    console.log('---');
    console.log(sqlStatements);
    console.log('---');
  } else {
    console.log('Migration applied successfully!');
  }
}

applySQLDirectly(sql).catch(err => {
  console.error('Error:', err.message);
  console.log('\nPlease run this SQL manually in Supabase SQL Editor:');
  console.log('---');
  console.log(sql);
  console.log('---');
});
