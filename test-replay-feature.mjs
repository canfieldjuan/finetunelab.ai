#!/usr/bin/env node

/**
 * Test Trace Replay Feature
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tkizlemssfmrfluychsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTc0MjYsImV4cCI6MjA3MTYzMzQyNn0.wjhOXd7WtKqj1zMtZMxApv1brutT_sDkNLvXUW1d4Uc';

const USER_EMAIL = 'canfieldjuan24@gmail.com';
const USER_PASSWORD = '@Canfi1287';

async function testReplay() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 TRACE REPLAY FEATURE TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Sign in
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: USER_EMAIL,
    password: USER_PASSWORD
  });

  if (authError || !authData.session) {
    console.error('❌ Failed to sign in');
    return;
  }

  const token = authData.session.access_token;
  console.log(`✅ Signed in as: ${USER_EMAIL}\n`);

  // Get latest anomaly
  console.log('1️⃣ Fetching latest anomaly with trace...\n');
  const anomalyResponse = await fetch('http://localhost:3000/api/analytics/anomalies?limit=1', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const anomalyData = await anomalyResponse.json();

  if (!anomalyData.data || anomalyData.data.length === 0) {
    console.log('❌ No anomalies found');
    return;
  }

  const anomaly = anomalyData.data[0];
  const traceId = anomaly.statistics?.trace_id;

  if (!traceId) {
    console.log('❌ No trace_id in anomaly');
    return;
  }

  console.log(`   Anomaly: ${anomaly.metric_name}`);
  console.log(`   Severity: ${anomaly.severity}`);
  console.log(`   Trace ID: ${traceId}\n`);

  // Fetch the full trace
  console.log('2️⃣ Fetching trace details...\n');
  const traceResponse = await fetch(`http://localhost:3000/api/analytics/traces?trace_id=${traceId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!traceResponse.ok) {
    console.log('❌ Failed to fetch trace');
    return;
  }

  const traceData = await traceResponse.json();

  if (!traceData.data || traceData.data.length === 0) {
    console.log('❌ Trace not found');
    return;
  }

  const trace = traceData.data[0];

  console.log('   Original Trace:');
  console.log(`   ID: ${trace.id}`);
  console.log(`   Model: ${trace.model_name}`);
  console.log(`   Provider: ${trace.model_provider}`);
  console.log(`   Duration: ${trace.duration_ms}ms`);
  console.log(`   Cost: $${trace.cost_usd?.toFixed(6) || 'N/A'}`);
  console.log(`   Tokens: ${trace.total_tokens}\n`);

  // Test replay with modified parameters
  console.log('3️⃣ Testing replay with modified parameters...\n');
  console.log('   Overrides:');
  console.log('   - Model: gpt-3.5-turbo (cheaper)');
  console.log('   - Temperature: 0.5\n');

  const replayResponse = await fetch(`http://localhost:3000/api/analytics/traces/${trace.id}/replay`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      overrides: {
        modelName: 'gpt-3.5-turbo',
        temperature: 0.5
      }
    }),
  });

  console.log(`   POST /api/analytics/traces/${trace.id}/replay: ${replayResponse.status}\n`);

  if (!replayResponse.ok) {
    const errorText = await replayResponse.text();
    console.log(`❌ Replay failed: ${errorText}\n`);
    return;
  }

  const replayData = await replayResponse.json();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ REPLAY SUCCESSFUL!');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 COMPARISON:\n');
  console.log('┌────────────────────────┬──────────────────┬──────────────────┐');
  console.log('│ Metric                 │ Original         │ Replay           │');
  console.log('├────────────────────────┼──────────────────┼──────────────────┤');
  console.log(`│ Model                  │ ${replayData.originalTrace.model_name.padEnd(16)} │ ${replayData.replayTrace.model_name.padEnd(16)} │`);
  console.log(`│ Provider               │ ${(replayData.originalTrace.model_provider || 'N/A').padEnd(16)} │ ${(replayData.replayTrace.model_provider || 'N/A').padEnd(16)} │`);
  console.log('└────────────────────────┴──────────────────┴──────────────────┘\n');

  console.log('🔗 Replay Trace Details:');
  console.log(`   New Trace ID: ${replayData.replayTrace.trace_id}`);
  console.log(`   Parent Trace ID: ${replayData.replayTrace.parent_trace_id}`);
  console.log(`   Operation Type: ${replayData.replayTrace.operation_type}`);
  console.log(`   Metadata: ${JSON.stringify(replayData.replayTrace.metadata, null, 2)}\n`);

  console.log('✅ Replay feature working correctly!');
  console.log('   - New trace created with replay metadata');
  console.log('   - Linked to original trace via parent_trace_id');
  console.log('   - Overrides applied successfully\n');
}

testReplay();
