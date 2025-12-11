// Verify RLS Policy State - Direct Database Check
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function verifyRLSState() {
  console.log('=== SUPABASE RLS VERIFICATION ===');
  console.log('Time:', new Date().toISOString());
  console.log();

  // Get credentials from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('ERROR: Missing Supabase credentials');
    console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  // Create client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    console.log('--- 1. Check RLS Status for local_training_metrics ---');
    const { data: rlsStatus, error: rlsError } = await supabase
      .rpc('sql', {
        query: `SELECT schemaname, tablename, rowsecurity 
                FROM pg_tables 
                WHERE tablename = 'local_training_metrics';`
      });
    
    if (rlsError) {
      console.error('RLS Status Query Error:', rlsError);
    } else {
      console.log('RLS Status:', rlsStatus);
    }
    console.log();

    console.log('--- 2. List RLS Policies for local_training_metrics ---');
    const { data: policies, error: policiesError } = await supabase
      .rpc('sql', {
        query: `SELECT policyname, cmd, permissive, roles, qual, with_check 
                FROM pg_policies 
                WHERE tablename = 'local_training_metrics';`
      });
    
    if (policiesError) {
      console.error('Policies Query Error:', policiesError);
    } else {
      console.log('RLS Policies:', JSON.stringify(policies, null, 2));
    }
    console.log();

    console.log('--- 3. Check Table Privileges ---');
    const { data: privileges, error: privError } = await supabase
      .rpc('sql', {
        query: `SELECT grantee, privilege_type 
                FROM information_schema.table_privileges 
                WHERE table_name = 'local_training_metrics' 
                AND grantee IN ('anon', 'authenticated');`
      });
    
    if (privError) {
      console.error('Privileges Query Error:', privError);
    } else {
      console.log('Table Privileges:', privileges);
    }
    console.log();

    console.log('--- 4. Check Specific Policy ---');
    const { data: specificPolicy, error: specificError } = await supabase
      .rpc('sql', {
        query: `SELECT policyname, cmd, permissive, roles, qual, with_check 
                FROM pg_policies 
                WHERE tablename = 'local_training_metrics' 
                AND policyname = 'Allow insert metrics with valid job token';`
      });
    
    if (specificError) {
      console.error('Specific Policy Query Error:', specificError);
    } else {
      console.log('Specific Policy:', JSON.stringify(specificPolicy, null, 2));
    }
    console.log();

    console.log('=== VERIFICATION COMPLETE ===');
    
  } catch (error) {
    console.error('Verification Error:', error);
    process.exit(1);
  }
}

verifyRLSState();