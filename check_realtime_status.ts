#!/usr/bin/env tsx
/**
 * Check Realtime Configuration Status
 * Diagnoses why realtime subscriptions are failing
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

async function checkRealtimeStatus() {
  console.log('🔍 Checking Realtime Configuration...\n');

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // 1. Check if tables exist
    console.log('📋 Step 1: Checking if tables exist...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['local_training_jobs', 'local_training_metrics']);

    if (tablesError) {
      console.log('  ⚠️  Cannot query information_schema (normal for Supabase)');
    } else {
      console.log('  ✓ Tables found:', tables?.map(t => (t as {table_name: string}).table_name));
    }

    // 2. Check RLS status
    console.log('\n📋 Step 2: Checking RLS policies...');
    
    // Try to query with anon key (what the frontend uses)
    const anonClient = createClient(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    const { error: anonError } = await anonClient
      .from('local_training_jobs')
      .select('id')
      .limit(1);

    if (anonError) {
      console.log('  ❌ Anon access failed:', anonError.message);
      console.log('  This means: Frontend cannot read jobs (RLS issue)');
    } else {
      console.log('  ✓ Anon can read jobs');
    }

    // 3. Check realtime publication (requires service role)
    console.log('\n📋 Step 3: Checking realtime publication...');
    
    const { data: pubData, error: pubError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT tablename 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public'
        AND tablename IN ('local_training_jobs', 'local_training_metrics')
      `
    });

    if (pubError) {
      console.log('  ⚠️  Cannot check publication directly');
      console.log('  Trying alternative method...');
      
      // Alternative: Try to create a test channel
      const testChannel = anonClient
        .channel('test-channel')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'local_training_jobs',
          filter: 'id=eq.test'
        }, () => {})
        .subscribe((status) => {
          console.log('  Test channel status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('  ✓ Realtime is working!');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('  ❌ Realtime subscription failed');
            console.log('  This means: Tables not in realtime publication');
          }
          testChannel.unsubscribe();
        });

      // Wait for subscription attempt
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log('  ✓ Publication data:', pubData);
    }

    // 4. Check for sample training job
    console.log('\n📋 Step 4: Checking sample data...');
    const { data: jobs, error: jobsError } = await supabase
      .from('local_training_jobs')
      .select('id, status, user_id')
      .order('created_at', { ascending: false })
      .limit(1);

    if (jobsError) {
      console.log('  ❌ Cannot query jobs:', jobsError.message);
    } else if (jobs && jobs.length > 0) {
      const job = jobs[0];
      console.log('  ✓ Found job:', job.id);
      console.log('    - Status:', job.status);
      console.log('    - User ID:', job.user_id || '(null)');

      // Check metrics for this job
      const { data: metrics, error: metricsError } = await supabase
        .from('local_training_metrics')
        .select('step, train_loss, eval_loss, perplexity')
        .eq('job_id', job.id)
        .order('step', { ascending: false })
        .limit(1);

      if (metricsError) {
        console.log('  ❌ Cannot query metrics:', metricsError.message);
      } else if (metrics && metrics.length > 0) {
        console.log('  ✓ Found metrics at step:', metrics[0].step);
        console.log('    - train_loss:', metrics[0].train_loss);
        console.log('    - eval_loss:', metrics[0].eval_loss);
        console.log('    - perplexity:', metrics[0].perplexity);
      } else {
        console.log('  ⚠️  No metrics found for this job');
      }
    } else {
      console.log('  ⚠️  No training jobs found');
    }

    // 5. Test actual realtime connection
    console.log('\n📋 Step 5: Testing live realtime connection...');
    console.log('  Creating channel subscription...');
    
    let connectionStatus = 'PENDING';
    let errorReceived: unknown = null;

    const channel = anonClient
      .channel(`test-realtime-${Date.now()}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'local_training_jobs'
      }, () => {})
      .subscribe((status, err) => {
        connectionStatus = status;
        errorReceived = err;
        
        console.log('  Status:', status);
        if (err) {
          console.log('  Error:', JSON.stringify(err, null, 2));
        }
      });

    // Wait for connection attempt
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    channel.unsubscribe();

    if (connectionStatus === 'SUBSCRIBED') {
      console.log('  ✅ Realtime connection successful!');
    } else if (connectionStatus === 'CHANNEL_ERROR') {
      console.log('  ❌ Realtime connection failed');
      console.log('  Error details:', JSON.stringify(errorReceived, null, 2));
    } else {
      console.log('  ⚠️  Connection status:', connectionStatus);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DIAGNOSIS SUMMARY');
    console.log('='.repeat(60));
    
    if (connectionStatus === 'SUBSCRIBED') {
      console.log('✅ Realtime is configured correctly');
      console.log('\n💡 The issue might be:');
      console.log('   1. Frontend token expired - refresh browser');
      console.log('   2. RLS policy mismatch with user_id');
      console.log('   3. Client-side caching issue');
    } else {
      console.log('❌ Realtime is NOT working');
      console.log('\n🔧 Required fixes:');
      console.log('   1. Run in Supabase SQL Editor:');
      console.log('      ALTER PUBLICATION supabase_realtime ADD TABLE local_training_jobs;');
      console.log('      ALTER PUBLICATION supabase_realtime ADD TABLE local_training_metrics;');
      console.log('   2. Grant permissions:');
      console.log('      GRANT SELECT ON local_training_jobs TO anon, authenticated;');
      console.log('      GRANT SELECT ON local_training_metrics TO anon, authenticated;');
      console.log('   3. Check that realtime is enabled in Supabase project settings');
    }

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error);
  }
}

checkRealtimeStatus();
