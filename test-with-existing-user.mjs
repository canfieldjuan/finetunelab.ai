#!/usr/bin/env node

/**
 * Test using existing confirmed user
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tkizlemssfmrfluychsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTc0MjYsImV4cCI6MjA3MTYzMzQyNn0.wjhOXd7WtKqj1zMtZMxApv1brutT_sDkNLvXUW1d4Uc';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA1NzQyNiwiZXhwIjoyMDcxNjMzNDI2fQ.1jCq40o2wsbHrKuinv3s4Ny9kwJ5mcvcBAggU5oKH74';

// Use existing confirmed test user
const TEST_USER_ID = 'ae810f59-f31c-4567-9cd6-c3eb767d46ee'; // testuser123@gmail.com
const TEST_EMAIL = 'testuser123@gmail.com';
const NEW_PASSWORD = 'TestPassword123!';

async function setupTestUser() {
  console.log('1️⃣ Setting up existing test user...\n');

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Update password for existing user
  const { data, error } = await adminClient.auth.admin.updateUserById(
    TEST_USER_ID,
    { password: NEW_PASSWORD }
  );

  if (error) {
    console.error(`❌ Failed to update password: ${error.message}`);
    return null;
  }

  console.log(`✅ Updated password for: ${TEST_EMAIL}`);
  console.log(`   User ID: ${TEST_USER_ID}\n`);

  return { id: TEST_USER_ID, email: TEST_EMAIL };
}

async function generateTestTraces(userId) {
  console.log('2️⃣ Generating test trace data...\n');

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Clean old test traces
  await adminClient
    .from('llm_traces')
    .delete()
    .eq('user_id', userId)
    .like('trace_id', 'api-test-trace-%');

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
  console.log('3️⃣ Signing in...\n');

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: NEW_PASSWORD
  });

  if (error) {
    console.error(`❌ Sign in failed: ${error.message}`);
    return null;
  }

  console.log(`   ✅ Signed in as: ${data.user.email}`);
  console.log(`   User ID: ${data.user.id}\n`);

  return data.session.access_token;
}

async function testAPI(token) {
  console.log('4️⃣ Testing Anomaly Detection API...\n');

  // Test detection
  const detectResponse = await fetch('http://localhost:3000/api/analytics/anomalies/detect', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`   POST /api/analytics/anomalies/detect: ${detectResponse.status}`);

  if (!detectResponse.ok) {
    const text = await detectResponse.text();
    console.log(`   ❌ Error Response: ${text}`);

    // Try to parse as JSON to get more details
    try {
      const errorJson = JSON.parse(text);
      console.log(`   Error details:`, JSON.stringify(errorJson, null, 2));
    } catch (e) {
      // Not JSON, already logged as text
    }
    console.log('');
    return null;
  }

  const detectResult = await detectResponse.json();
  console.log(`   ✅ Detection successful`);

  // Test get anomalies
  const getResponse = await fetch('http://localhost:3000/api/analytics/anomalies?limit=10', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`   GET /api/analytics/anomalies: ${getResponse.status}\n`);

  const getResult = await getResponse.json();

  return { detectResult, getResult };
}

async function runTest() {
  console.log('🧪 ANOMALY DETECTION API TEST');
  console.log('══════════════════════════════════════════════════════════\n');

  try {
    const user = await setupTestUser();
    if (!user) process.exit(1);

    const tracesCreated = await generateTestTraces(user.id);
    if (!tracesCreated) process.exit(1);

    const token = await signInAndTest();
    if (!token) process.exit(1);

    const results = await testAPI(token);
    if (!results) process.exit(1);

    const { detectResult, getResult } = results;

    console.log('══════════════════════════════════════════════════════════');
    console.log('📊 RESULTS');
    console.log('══════════════════════════════════════════════════════════\n');
    console.log(`   Traces analyzed: ${detectResult.analyzed_traces}`);
    console.log(`   Anomalies detected: ${detectResult.anomalies_detected}`);
    console.log(`   Anomalies saved: ${detectResult.anomalies_saved}\n`);

    if (detectResult.breakdown) {
      Object.entries(detectResult.breakdown).forEach(([type, count]) => {
        if (count > 0) {
          console.log(`   🔴 ${type}: ${count}`);
        }
      });
      console.log('');
    }

    if (getResult.data && getResult.data.length > 0) {
      console.log(`🔍 Top Anomaly:\n`);
      const a = getResult.data[0];
      console.log(`   [${a.severity.toUpperCase()}] ${a.metric_name}`);
      console.log(`   ${a.description}`);
      console.log(`   Confidence: ${(a.confidence_score * 100).toFixed(0)}%\n`);
    }

    console.log('══════════════════════════════════════════════════════════');
    if (detectResult.anomalies_detected >= 4) {
      console.log('✅ FULL API TEST PASSED');
    } else {
      console.log(`⚠️  PARTIAL: ${detectResult.anomalies_detected}/5 anomalies`);
    }
    console.log('══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTest();
