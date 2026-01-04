#!/usr/bin/env node

/**
 * Anomaly Detection Test - Juan's Account
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tkizlemssfmrfluychsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTc0MjYsImV4cCI6MjA3MTYzMzQyNn0.wjhOXd7WtKqj1zMtZMxApv1brutT_sDkNLvXUW1d4Uc';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA1NzQyNiwiZXhwIjoyMDcxNjMzNDI2fQ.1jCq40o2wsbHrKuinv3s4Ny9kwJ5mcvcBAggU5oKH74';

// Juan's account credentials
const USER_EMAIL = 'canfieldjuan24@gmail.com';
const USER_PASSWORD = '@Canfi1287';

async function signIn() {
  console.log('🔐 Signing in as Juan...\n');

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await client.auth.signInWithPassword({
    email: USER_EMAIL,
    password: USER_PASSWORD
  });

  if (error) {
    console.error(`❌ Sign in failed: ${error.message}`);
    return null;
  }

  console.log(`✅ Signed in: ${data.user.email}`);
  console.log(`   User ID: ${data.user.id}\n`);

  return {
    token: data.session.access_token,
    userId: data.user.id
  };
}

async function generateTestTraces(userId) {
  console.log('📝 Generating test trace data...\n');

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Clean old test traces
  await adminClient
    .from('llm_traces')
    .delete()
    .eq('user_id', userId)
    .like('trace_id', 'anomaly-test-%');

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

    // Inject anomalies in LAST trace for detection
    if (i === count - 1) {
      duration = 5000; // 5x normal
      ttft = 2000; // 10x normal
      tokensPerSecond = 10; // 5x drop
      inputTokens = 5000;
      outputTokens = 3000;
      cost = 0.50; // 25x normal
      console.log(`   🔴 Injecting anomalies in latest trace:`);
      console.log(`      • Duration: ${duration}ms (5x normal)`);
      console.log(`      • TTFT: ${ttft}ms (10x normal)`);
      console.log(`      • Tokens: ${inputTokens + outputTokens} (10x normal)`);
      console.log(`      • Cost: $${cost} (25x normal)`);
      console.log(`      • Throughput: ${tokensPerSecond} tokens/s (5x drop)\n`);
    }

    traces.push({
      user_id: userId,
      trace_id: `anomaly-test-${i}-${Date.now()}`,
      span_id: `anomaly-test-span-${i}`,
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

async function testDetectionAPI(token) {
  console.log('🔬 Testing Anomaly Detection API...\n');

  const response = await fetch('http://localhost:3000/api/analytics/anomalies/detect', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`   POST /api/analytics/anomalies/detect: ${response.status}`);

  if (!response.ok) {
    const text = await response.text();
    console.log(`   ❌ Error: ${text}\n`);
    return null;
  }

  const result = await response.json();
  console.log(`   ✅ Detection successful\n`);

  return result;
}

async function getAnomalies(token) {
  console.log('📊 Fetching detected anomalies...\n');

  const response = await fetch('http://localhost:3000/api/analytics/anomalies?limit=20', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`   GET /api/analytics/anomalies: ${response.status}`);

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
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 ANOMALY DETECTION TEST - JUAN\'S ACCOUNT');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Sign in
    const auth = await signIn();
    if (!auth) {
      console.error('❌ Test failed: Could not sign in');
      process.exit(1);
    }

    // Step 2: Generate test data
    const tracesCreated = await generateTestTraces(auth.userId);
    if (!tracesCreated) {
      console.error('❌ Test failed: Could not create test traces');
      process.exit(1);
    }

    // Step 3: Run detection
    const detectResult = await testDetectionAPI(auth.token);
    if (!detectResult) {
      console.error('❌ Test failed: Detection API failed');
      process.exit(1);
    }

    // Step 4: Get anomalies
    const getResult = await getAnomalies(auth.token);

    // Display results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 DETECTION RESULTS');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`   Traces Analyzed: ${detectResult.analyzed_traces}`);
    console.log(`   Anomaly Types: ${detectResult.anomaly_types_analyzed}`);
    console.log(`   Anomalies Detected: ${detectResult.anomalies_detected}`);
    console.log(`   Anomalies Saved: ${detectResult.anomalies_saved}\n`);

    if (detectResult.breakdown) {
      console.log('📈 Breakdown by Type:\n');
      Object.entries(detectResult.breakdown).forEach(([type, count]) => {
        if (count > 0) {
          const icon = '🔴';
          console.log(`   ${icon} ${type.padEnd(18)}: ${count} anomaly(ies)`);
        }
      });
      console.log('');
    }

    if (getResult && getResult.data && getResult.data.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 DETECTED ANOMALIES (Top 5)');
      console.log('═══════════════════════════════════════════════════════════\n');

      getResult.data.slice(0, 5).forEach((a, idx) => {
        console.log(`${idx + 1}. [${a.severity.toUpperCase()}] ${a.metric_name}`);
        console.log(`   ${a.description}`);
        console.log(`   Confidence: ${(a.confidence_score * 100).toFixed(0)}%`);
        console.log(`   Detected: ${a.detected_value.toFixed(2)}`);
        console.log(`   Expected: ${a.expected_value.toFixed(2)}`);
        console.log(`   Deviation: ${Math.abs(a.deviation_percentage).toFixed(1)}%`);
        console.log(`   Status: ${a.resolution_status}`);
        console.log('');
      });
    }

    console.log('═══════════════════════════════════════════════════════════');
    if (detectResult.anomalies_detected >= 4) {
      console.log('✅ TEST PASSED - ANOMALY DETECTION WORKING!');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('\n💡 Next Steps:');
      console.log('   1. Log in to http://localhost:3000');
      console.log(`   2. Email: ${USER_EMAIL}`);
      console.log('   3. Navigate to Analytics → Errors tab');
      console.log('   4. View your detected anomalies in real-time!\n');
    } else {
      console.log(`⚠️  PARTIAL: ${detectResult.anomalies_detected}/5 anomalies detected`);
      console.log('═══════════════════════════════════════════════════════════\n');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
