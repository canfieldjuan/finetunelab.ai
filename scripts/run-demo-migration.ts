/**
 * Run Demo Tables Migration
 * Executes the demo tables migration directly via Supabase REST API
 *
 * Run with: npx ts-node scripts/run-demo-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function runMigration() {
  console.log('Running demo tables migration...\n');

  const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: { persistSession: false }
  });

  // Read the migration file
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20251215000000_create_demo_tables.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    console.error('Migration file not found:', migrationPath);
    process.exit(1);
  }

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  // Split into individual statements (simple split on semicolons outside of functions)
  // For complex migrations, we'll execute as chunks
  const statements = splitSqlStatements(migrationSql);

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim();
    if (!statement || statement.startsWith('--')) continue;

    // Show a preview of what we're executing
    const preview = statement.slice(0, 60).replace(/\n/g, ' ');
    process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        // Try direct query for DDL statements
        const { error: queryError } = await supabase.from('_temp').select().limit(0);

        // If it's a "relation already exists" error, that's fine
        if (error.message?.includes('already exists')) {
          console.log('(already exists)');
          successCount++;
          continue;
        }

        throw error;
      }

      console.log('OK');
      successCount++;
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string };
      // Handle "already exists" errors gracefully
      if (error.message?.includes('already exists') || error.code === '42P07') {
        console.log('(already exists)');
        successCount++;
      } else {
        console.log('FAILED');
        console.error(`   Error: ${error.message || error}`);
        errorCount++;
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${errorCount}`);

  if (errorCount > 0) {
    console.log('\nSome statements failed. You may need to run the migration manually.');
    console.log('Copy the SQL from: supabase/migrations/20251215000000_create_demo_tables.sql');
    console.log('And run it in the Supabase SQL Editor at:');
    console.log(`${supabaseUrl!.replace('.supabase.co', '')}/project/tkizlemssfmrfluychsn/sql`);
  }
}

function splitSqlStatements(sql: string): string[] {
  // This is a simple splitter that handles basic cases
  // It splits on semicolons but tries to keep function bodies together
  const results: string[] = [];
  let current = '';
  let inFunction = false;
  let dollarQuote = '';

  const lines = sql.split('\n');

  for (const line of lines) {
    // Check for function start
    if (line.includes('$$') && !inFunction) {
      inFunction = true;
      dollarQuote = '$$';
    }

    current += line + '\n';

    // Check for function end
    if (inFunction && line.includes(dollarQuote) && current.split(dollarQuote).length > 2) {
      inFunction = false;
      // Find the semicolon after the closing $$
      const lastDollar = current.lastIndexOf(dollarQuote);
      const afterDollar = current.slice(lastDollar + 2);
      if (afterDollar.includes(';')) {
        results.push(current.trim());
        current = '';
      }
    } else if (!inFunction && line.trim().endsWith(';')) {
      results.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    results.push(current.trim());
  }

  return results.filter(s => s && !s.startsWith('--'));
}

runMigration().catch(console.error);
