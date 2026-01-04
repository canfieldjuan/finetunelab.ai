#!/usr/bin/env node

/**
 * Test Anomaly to Trace Linkage
 * Verifies that anomalies link back to the exact request/model/Q&A
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tkizlemssfmrfluychsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTc0MjYsImV4cCI6MjA3MTYzMzQyNn0.wjhOXd7WtKqj1zMtZMxApv1brutT_sDkNLvXUW1d4Uc';

const USER_EMAIL = 'canfieldjuan24@gmail.com';
const USER_PASSWORD = '@Canfi1287';

async function demonstrateLinkage() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔗 ANOMALY TO TRACE LINKAGE DEMONSTRATION');
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
  console.log('1️⃣ Fetching latest anomaly...\n');
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

  console.log('📊 ANOMALY DETAILS:');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`   Severity: ${anomaly.severity.toUpperCase()}`);
  console.log(`   Metric: ${anomaly.metric_name}`);
  console.log(`   Description: ${anomaly.description}`);
  console.log(`   Model: ${anomaly.model_id || 'N/A'}`);
  console.log(`   Confidence: ${(anomaly.confidence_score * 100).toFixed(0)}%`);
  console.log(`   Detected Value: ${anomaly.detected_value.toFixed(2)}`);
  console.log(`   Expected Value: ${anomaly.expected_value.toFixed(2)}`);
  console.log(`   Deviation: ${Math.abs(anomaly.deviation_percentage).toFixed(1)}%`);

  // Extract trace_id
  const traceId = anomaly.statistics?.trace_id;

  if (!traceId) {
    console.log('\n⚠️  No trace_id found in anomaly');
    return;
  }

  console.log(`   Trace ID: ${traceId}`);
  console.log('');

  // Fetch the linked trace
  console.log('2️⃣ Fetching linked trace details...\n');
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

  console.log('🔍 LINKED TRACE DETAILS:');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`   Trace ID: ${trace.trace_id}`);
  console.log(`   Model: ${trace.model_name || 'N/A'}`);
  console.log(`   Provider: ${trace.model_provider || 'N/A'}`);
  console.log(`   Operation: ${trace.operation_type || 'N/A'}`);
  console.log(`   Status: ${trace.status || 'N/A'}`);
  console.log(`   Duration: ${trace.duration_ms}ms`);
  console.log(`   TTFT: ${trace.ttft_ms}ms`);
  console.log(`   Tokens: ${trace.total_tokens} (${trace.input_tokens} in, ${trace.output_tokens} out)`);
  console.log(`   Cost: $${trace.cost_usd?.toFixed(6) || '0'}`);
  console.log(`   Timestamp: ${new Date(trace.start_time).toLocaleString()}`);
  console.log('');

  // Show input/output data (Q&A)
  if (trace.input_data || trace.output_data) {
    console.log('💬 REQUEST/RESPONSE DATA:');
    console.log('───────────────────────────────────────────────────────────');

    if (trace.input_data) {
      console.log('   📥 INPUT (Question/Prompt):');
      if (typeof trace.input_data === 'object') {
        const inputStr = JSON.stringify(trace.input_data, null, 2);
        const preview = inputStr.length > 200 ? inputStr.substring(0, 200) + '...' : inputStr;
        console.log(`      ${preview.replace(/\n/g, '\n      ')}`);
      } else {
        console.log(`      ${trace.input_data}`);
      }
      console.log('');
    }

    if (trace.output_data) {
      console.log('   📤 OUTPUT (Answer/Response):');
      if (typeof trace.output_data === 'object') {
        const outputStr = JSON.stringify(trace.output_data, null, 2);
        const preview = outputStr.length > 200 ? outputStr.substring(0, 200) + '...' : outputStr;
        console.log(`      ${preview.replace(/\n/g, '\n      ')}`);
      } else {
        console.log(`      ${trace.output_data}`);
      }
      console.log('');
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ LINKAGE VERIFIED!');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📋 HOW USERS ACCESS THIS IN THE UI:');
  console.log('');
  console.log('1. Go to http://localhost:3000/analytics');
  console.log('2. Click "Errors" tab');
  console.log('3. Click on any anomaly in the feed');
  console.log('4. Click "View Trace" button (blue button)');
  console.log('5. See the FULL trace details including:');
  console.log('   • Model name and provider');
  console.log('   • Input data (the exact question/prompt)');
  console.log('   • Output data (the exact response/answer)');
  console.log('   • All performance metrics');
  console.log('   • Timing breakdown');
  console.log('   • Token usage');
  console.log('   • Cost information');
  console.log('');
}

demonstrateLinkage();
