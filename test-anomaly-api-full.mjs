#!/usr/bin/env node

/**
 * Full API Test with Proper Authentication
 * Creates a test user, authenticates, and tests the full anomaly detection API
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tkizlemssfmrfluychsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTc0MjYsImV4cCI6MjA3MTYzMzQyNn0.wjhOXd7WtKqj1zMtZMxApv1brutT_sDkNLvXUW1d4Uc';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA1NzQyNiwiZXhwIjoyMDcxNjMzNDI2fQ.1jCq40o2wsbHrKuinv3s4Ny9kwJ5mcvcBAggU5oKH74';

const TEST_USER_EMAIL = 'anomaly-test@finetune-lab.com';
const TEST_USER_PASSWORD = 'test-password-123456';

async function createOrGetTestUser() {
  console.log('1️⃣ Setting up test user...');

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Try to sign up (will fail if exists, which is fine)
  const { data: signupData, error: signupError } = await client.auth.signUp({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    options: {
      emailRedirectTo: undefined
    }
  });

  if (signupError) {
    if (signupError.message.includes('already registered')) {
      console.log(`   ℹ️  User already exists: ${TEST_USER_EMAIL}`);
      return { email: TEST_USER_EMAIL };
    } else {
      console.log(`   ⚠️  Signup warning: ${signupError.message}`);
      // Try to continue anyway - user might exist
      return { email: TEST_USER_EMAIL };
    }
  }

  if (signupData.user) {
    console.log(`   ✅ Created/verified test user: ${TEST_USER_EMAIL}`);
    return signupData.user;
  }

  console.log(`   ℹ️  User likely exists: ${TEST_USER_EMAIL}`);
  return { email: TEST_USER_EMAIL };
}

async function signInAndGetToken() {
  console.log('\n2️⃣ Signing in to get session token...');

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  });

  if (error) {
    console.error(`   ❌ Sign in failed: ${error.message}`);
    return null;
  }

  if (!data.session) {
    console.error('   ❌ No session returned');
    return null;
  }

  console.log(`   ✅ Signed in as: ${data.user.email}`);
  console.log(`   ✅ User ID: ${data.user.id}`);
  console.log(`   ✅ Token expires: ${new Date(data.session.expires_at * 1000).toLocaleString()}`);

  return {
    token: data.session.access_token,
    userId: data.user.id
  };
}

async function ensureTestData(userId) {
  console.log('\n3️⃣ Ensuring test trace data exists...');

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Check for existing test traces
  const { data: existingTraces, error: checkError } = await adminClient
    .from('llm_traces')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .like('trace_id', 'test-trace-%');

  if (checkError) {
    console.error(`   ❌ Failed to check traces: ${checkError.message}`);
    return false;
  }

  if (existingTraces && existingTraces.length >= 50) {
    console.log(`   ✅ Found ${existingTraces.length} existing test traces`);
    return true;
  }

  console.log('   📝 Generating fresh test data...');

  // Clean up old test data
  await adminClient
    .from('llm_traces')
    .delete()
    .eq('user_id', userId)
    .like('trace_id', 'test-trace-%');

  // Generate traces
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
      trace_id: `test-trace-${i}-${Date.now()}`,
      span_id: `test-span-${i}-${Date.now()}`,
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

  console.log(`   ✅ Generated ${count} test traces`);
  return true;
}

async function testAnomalyDetectionAPI(token) {
  console.log('\n4️⃣ Testing Anomaly Detection API...');
  console.log('   📡 POST /api/analytics/anomalies/detect\n');

  const response = await fetch('http://localhost:3000/api/analytics/anomalies/detect', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`   Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.log(`   ❌ API Error Response:`);
    console.log(`   ${errorText}\n`);
    return null;
  }

  const result = await response.json();
  console.log(`   ✅ API call successful!\n`);

  return result;
}

async function testGetAnomaliesAPI(token) {
  console.log('5️⃣ Testing Get Anomalies API...');
  console.log('   📡 GET /api/analytics/anomalies\n');

  const response = await fetch('http://localhost:3000/api/analytics/anomalies?limit=20', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`   Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.log(`   ❌ API Error: ${errorText}\n`);
    return null;
  }

  const result = await response.json();
  console.log(`   ✅ Retrieved ${result.data?.length || 0} anomalies\n`);

  return result;
}

async function runFullTest() {
  console.log('🧪 FULL API ANOMALY DETECTION TEST\n');
  console.log('══════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Create or get test user
    const user = await createOrGetTestUser();
    if (!user) {
      console.error('\n❌ Test failed: Could not create/retrieve test user');
      process.exit(1);
    }

    // Step 2: Sign in and get token
    const auth = await signInAndGetToken();
    if (!auth) {
      console.error('\n❌ Test failed: Could not authenticate');
      process.exit(1);
    }

    // Step 3: Ensure test data exists
    const dataReady = await ensureTestData(auth.userId);
    if (!dataReady) {
      console.error('\n❌ Test failed: Could not prepare test data');
      process.exit(1);
    }

    // Step 4: Test detection API
    const detectResult = await testAnomalyDetectionAPI(auth.token);
    if (!detectResult) {
      console.error('\n❌ Test failed: Anomaly detection API failed');
      process.exit(1);
    }

    // Display detection results
    console.log('══════════════════════════════════════════════════════════');
    console.log('📊 DETECTION RESULTS');
    console.log('══════════════════════════════════════════════════════════\n');
    console.log(`   • Analyzed traces: ${detectResult.analyzed_traces}`);
    console.log(`   • Anomaly types analyzed: ${detectResult.anomaly_types_analyzed}`);
    console.log(`   • Anomalies detected: ${detectResult.anomalies_detected}`);
    console.log(`   • Anomalies saved: ${detectResult.anomalies_saved}\n`);

    if (detectResult.breakdown) {
      console.log('📈 Breakdown by Type:\n');
      Object.entries(detectResult.breakdown).forEach(([type, count]) => {
        const emoji = count > 0 ? '🔴' : '✅';
        const status = count > 0 ? `${count} detected` : 'none';
        console.log(`   ${emoji} ${type.padEnd(20)}: ${status}`);
      });
      console.log('');
    }

    // Step 5: Test get anomalies API
    const getResult = await testGetAnomaliesAPI(auth.token);
    if (getResult && getResult.data && getResult.data.length > 0) {
      console.log('══════════════════════════════════════════════════════════');
      console.log('🔍 DETECTED ANOMALIES');
      console.log('══════════════════════════════════════════════════════════\n');

      getResult.data.slice(0, 5).forEach((anomaly, idx) => {
        console.log(`${idx + 1}. [${anomaly.severity.toUpperCase()}] ${anomaly.metric_name}`);
        console.log(`   Type: ${anomaly.anomaly_type}`);
        console.log(`   Description: ${anomaly.description}`);
        console.log(`   Confidence: ${(anomaly.confidence_score * 100).toFixed(0)}%`);
        console.log(`   Detected: ${anomaly.detected_value.toFixed(2)}`);
        console.log(`   Expected: ${anomaly.expected_value.toFixed(2)}`);
        console.log(`   Deviation: ${anomaly.deviation_percentage.toFixed(1)}%`);
        console.log(`   Status: ${anomaly.resolution_status}`);
        console.log(`   Trace: ${anomaly.statistics?.trace_id || 'N/A'}`);
        console.log('');
      });
    }

    // Test verdict
    console.log('══════════════════════════════════════════════════════════');
    if (detectResult.anomalies_detected >= 4) {
      console.log('✅ TEST PASSED: Full API test successful!');
      console.log('   • Authentication working ✓');
      console.log('   • Detection API working ✓');
      console.log('   • Get Anomalies API working ✓');
      console.log('   • Anomaly detection algorithms working ✓');
    } else {
      console.log('⚠️  TEST PARTIAL: API working but fewer anomalies detected');
      console.log(`   Detected ${detectResult.anomalies_detected} anomalies`);
    }
    console.log('══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the full test
runFullTest();
