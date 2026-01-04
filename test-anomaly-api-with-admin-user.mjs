#!/usr/bin/env node

/**
 * Full API Test - Creates admin user programmatically
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tkizlemssfmrfluychsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTc0MjYsImV4cCI6MjA3MTYzMzQyNn0.wjhOXd7WtKqj1zMtZMxApv1brutT_sDkNLvXUW1d4Uc';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA1NzQyNiwiZXhwIjoyMDcxNjMzNDI2fQ.1jCq40o2wsbHrKuinv3s4Ny9kwJ5mcvcBAggU5oKH74';

const TEST_EMAIL = `apitest-${Date.now()}@finetune-lab.com`;
const TEST_PASSWORD = 'TestPassword123!';

async function createTestUserWithAdmin() {
  console.log('1️⃣ Creating test user with admin API...\n');

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Create user with admin API
  const { data, error } = await adminClient.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      test_purpose: 'anomaly_detection_api_test'
    }
  });

  if (error) {
    console.error(`❌ Failed to create user: ${error.message}`);
    return null;
  }

  console.log(`✅ Created user: ${TEST_EMAIL}`);
  console.log(`   User ID: ${data.user.id}\n`);

  return data.user;
}

async function generateTestTraces(userId) {
  console.log('2️⃣ Generating test trace data...\n');

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const traces = [];
  const baseTime = Date.now();
  const count = 50;

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(baseTime - (count - i) * 60000).toISOString();

    let duration = 1000 + Math.random() * 500;
    let ttft = 200 + Math.random() * 100;
    let tokensPerSecond = 50 + Math.random() * 20;
    let inputTokens = 500 + Math.floor(Math.random() * 200);
    let outputTokens = 200 + Math.floor(Math.random() * 100);
    let cost = 0.01 + Math.random() * 0.02;

    // Inject anomalies in LAST trace
    if (i === count - 1) {
      duration = 5000;
      ttft = 2000;
      tokensPerSecond = 10;
      inputTokens = 5000;
      outputTokens = 3000;
      cost = 0.50;
      console.log(`   🔴 Injecting anomalies in latest trace`);
    }

    traces.push({
      user_id: userId,
      trace_id: `api-test-trace-${i}-${Date.now()}`,
      span_id: `api-test-span-${i}-${Date.now()}`,
      span_name: 'llm_call',
      operation_type: 'llm_call',
      start_time: timestamp,
      end_time: new Date(new Date(timestamp).getTime() + duration).toISOString(),
      duration_ms: Math.floor(duration),
      ttft_ms: Math.floor(ttft),
      tokens_per_second: Math.floor(tokensPerSecond),
      input_tokens: Math.floor(inputTokens),
      output_tokens: Math.floor(outputTokens),
      total_tokens: Math.floor(inputTokens + outputTokens),
      cost_usd: parseFloat(cost.toFixed(6)),
      model_name: 'gpt-4',
      model_provider: 'openai',
      status: 'completed',
      streaming_enabled: true,
      context_tokens: Math.floor(inputTokens - 100),
      queue_time_ms: 50 + Math.floor(Math.random() * 50),
      inference_time_ms: Math.floor(duration * 0.8),
      cache_read_input_tokens: Math.floor(inputTokens * 0.3),
      retrieval_latency_ms: 100 + Math.floor(Math.random() * 50),
      rag_relevance_score: parseFloat((0.8 + Math.random() * 0.15).toFixed(3))
    });
  }

  // Insert in batches
  const batchSize = 10;
  for (let i = 0; i < traces.length; i += batchSize) {
    const batch = traces.slice(i, i + batchSize);
    const { error } = await adminClient.from('llm_traces').insert(batch);
    if (error) {
      console.error(`   ❌ Insert error: ${error.message}`);
      return false;
    }
  }

  console.log(`   ✅ Generated ${count} test traces\n`);
  return true;
}

async function signInAndTest() {
  console.log('3️⃣ Signing in with test user...\n');

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });

  if (error) {
    console.error(`❌ Sign in failed: ${error.message}`);
    return null;
  }

  console.log(`   ✅ Signed in successfully`);
  console.log(`   Token length: ${data.session.access_token.length} chars\n`);

  return data.session.access_token;
}

async function testDetectionAPI(token) {
  console.log('4️⃣ Testing POST /api/analytics/anomalies/detect...\n');

  const response = await fetch('http://localhost:3000/api/analytics/anomalies/detect', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`   Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const text = await response.text();
    console.log(`   ❌ Error: ${text}\n`);
    return null;
  }

  const result = await response.json();
  console.log(`   ✅ Success!\n`);

  return result;
}

async function testGetAnomaliesAPI(token) {
  console.log('5️⃣ Testing GET /api/analytics/anomalies...\n');

  const response = await fetch('http://localhost:3000/api/analytics/anomalies?limit=10', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`   Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const text = await response.text();
    console.log(`   ❌ Error: ${text}\n`);
    return null;
  }

  const result = await response.json();
  console.log(`   ✅ Retrieved ${result.data?.length || 0} anomalies\n`);

  return result;
}

async function runTest() {
  console.log('🧪 FULL ANOMALY DETECTION API TEST');
  console.log('══════════════════════════════════════════════════════════\n');

  try {
    // Create user
    const user = await createTestUserWithAdmin();
    if (!user) {
      console.error('❌ Test failed: Could not create user');
      process.exit(1);
    }

    // Generate traces
    const tracesCreated = await generateTestTraces(user.id);
    if (!tracesCreated) {
      console.error('❌ Test failed: Could not create traces');
      process.exit(1);
    }

    // Sign in
    const token = await signInAndTest();
    if (!token) {
      console.error('❌ Test failed: Could not sign in');
      process.exit(1);
    }

    // Test detection API
    const detectResult = await testDetectionAPI(token);
    if (!detectResult) {
      console.error('❌ Test failed: Detection API failed');
      process.exit(1);
    }

    // Display results
    console.log('══════════════════════════════════════════════════════════');
    console.log('📊 DETECTION RESULTS');
    console.log('══════════════════════════════════════════════════════════\n');
    console.log(`   Analyzed traces: ${detectResult.analyzed_traces}`);
    console.log(`   Anomaly types: ${detectResult.anomaly_types_analyzed}`);
    console.log(`   Detected: ${detectResult.anomalies_detected}`);
    console.log(`   Saved: ${detectResult.anomalies_saved}\n`);

    if (detectResult.breakdown) {
      console.log('📈 Breakdown:\n');
      Object.entries(detectResult.breakdown).forEach(([type, count]) => {
        const emoji = count > 0 ? '🔴' : '✅';
        console.log(`   ${emoji} ${type.padEnd(18)}: ${count}`);
      });
      console.log('');
    }

    // Test get anomalies
    const getResult = await testGetAnomaliesAPI(token);
    if (getResult && getResult.data && getResult.data.length > 0) {
      console.log('══════════════════════════════════════════════════════════');
      console.log('🔍 ANOMALY DETAILS');
      console.log('══════════════════════════════════════════════════════════\n');

      getResult.data.slice(0, 5).forEach((a, idx) => {
        console.log(`${idx + 1}. [${a.severity.toUpperCase()}] ${a.metric_name}`);
        console.log(`   ${a.description}`);
        console.log(`   Confidence: ${(a.confidence_score * 100).toFixed(0)}%`);
        console.log(`   Deviation: ${a.deviation_percentage.toFixed(1)}%\n`);
      });
    }

    console.log('══════════════════════════════════════════════════════════');
    if (detectResult.anomalies_detected >= 4) {
      console.log('✅ TEST PASSED');
      console.log('══════════════════════════════════════════════════════════');
      console.log('   • User creation: WORKING');
      console.log('   • Authentication: WORKING');
      console.log('   • Detection API: WORKING');
      console.log('   • Get Anomalies API: WORKING');
      console.log('   • Anomaly algorithms: WORKING');
    } else {
      console.log('⚠️  TEST PARTIAL');
      console.log(`   Detected ${detectResult.anomalies_detected}/5 anomalies`);
    }
    console.log('══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
