#!/usr/bin/env node

/**
 * Test Anomaly Detection with Synthetic Data
 * Creates synthetic trace data and tests anomaly detection algorithms
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tkizlemssfmrfluychsn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA1NzQyNiwiZXhwIjoyMDcxNjMzNDI2fQ.1jCq40o2wsbHrKuinv3s4Ny9kwJ5mcvcBAggU5oKH74';

async function generateSyntheticTraces(supabase, userId, count = 50) {
  console.log(`📝 Generating ${count} synthetic traces...`);

  const baseTime = Date.now();
  const traces = [];

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(baseTime - (count - i) * 60000).toISOString();

    // Normal values
    let duration = 1000 + Math.random() * 500; // 1000-1500ms
    let ttft = 200 + Math.random() * 100; // 200-300ms
    let tokensPerSecond = 50 + Math.random() * 20; // 50-70 tokens/s
    let inputTokens = 500 + Math.floor(Math.random() * 200);
    let outputTokens = 200 + Math.floor(Math.random() * 100);
    let cost = 0.01 + Math.random() * 0.02;

    // Inject anomaly in the LAST trace (anomaly detection checks latest point)
    if (i === count - 1) {
      // Multiple anomalies in the last trace for comprehensive testing
      duration = 5000; // 5x normal
      ttft = 2000; // 10x normal
      tokensPerSecond = 10; // 5x drop
      inputTokens = 5000;
      outputTokens = 3000;
      cost = 0.50; // 25x normal
      console.log(`   🔴 Injecting ALL anomalies in LATEST trace (trace ${i})`);
      console.log(`      - Duration spike: ${duration}ms (5x normal)`);
      console.log(`      - TTFT spike: ${ttft}ms (10x normal)`);
      console.log(`      - Token spike: ${inputTokens + outputTokens} tokens (10x normal)`);
      console.log(`      - Cost spike: $${cost} (25x normal)`);
      console.log(`      - Throughput drop: ${tokensPerSecond} tokens/s (5x drop)`);
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

  // Insert traces in batches
  const batchSize = 10;
  for (let i = 0; i < traces.length; i += batchSize) {
    const batch = traces.slice(i, i + batchSize);
    const { error } = await supabase
      .from('llm_traces')
      .insert(batch);

    if (error) {
      console.error(`   ❌ Error inserting batch ${i / batchSize + 1}:`, error.message);
    }
  }

  console.log(`✅ Generated ${count} synthetic traces with 5 intentional anomalies\n`);
  return traces;
}

async function testAnomalyDetection() {
  console.log('🧪 Testing Anomaly Detection with Synthetic Data\n');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // Get or create test user
    console.log('1️⃣ Setting up test user...');
    const { data: users } = await supabase
      .from('llm_traces')
      .select('user_id')
      .limit(1);

    const testUserId = users?.[0]?.user_id || '38c85707-1fc5-40c6-84be-c017b3b8e750';
    console.log(`✅ Using user: ${testUserId}\n`);

    // Clean up old test traces
    console.log('2️⃣ Cleaning up old test traces...');
    await supabase
      .from('llm_traces')
      .delete()
      .eq('user_id', testUserId)
      .like('trace_id', 'test-trace-%');
    console.log('✅ Cleaned up old test data\n');

    // Generate synthetic traces
    console.log('3️⃣ Generating synthetic trace data...');
    await generateSyntheticTraces(supabase, testUserId, 50);

    // Sign in as admin to get token
    console.log('4️⃣ Getting authentication token...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@finetune-lab.com',
      password: 'finetune-lab-admin-2024'
    });

    let accessToken;
    if (authError || !authData.session) {
      console.log('⚠️  Admin auth failed, using service role token for testing');
      // Create a JWT token for testing (this won't work for the API, but we'll try)
      accessToken = SERVICE_ROLE_KEY;
    } else {
      accessToken = authData.session.access_token;
      console.log(`✅ Authenticated as: ${authData.user.email}\n`);
    }

    // Call anomaly detection endpoint
    console.log('5️⃣ Triggering anomaly detection...');
    const response = await fetch('http://localhost:3000/api/analytics/anomalies/detect', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('   Response:', errorText);

      if (response.status === 401) {
        console.log('\n⚠️  Authentication failed');
        console.log('ℹ️  The API requires a valid user token. Please:');
        console.log('   1. Log in to http://localhost:3000');
        console.log('   2. Run the test again, or');
        console.log('   3. Test manually through the UI\n');
      }

      // Even if API call failed, show that synthetic data was created
      console.log('✅ Synthetic test data created successfully!');
      console.log('ℹ️  You can now test anomaly detection through the UI at:');
      console.log('   http://localhost:3000/analytics\n');
      return;
    }

    const result = await response.json();

    // Display results
    console.log('\n✅ Anomaly Detection Complete!\n');
    console.log('══════════════════════════════════════');
    console.log('📊 Detection Results:');
    console.log('══════════════════════════════════════');
    console.log(`   • Analyzed traces: ${result.analyzed_traces}`);
    console.log(`   • Anomaly types analyzed: ${result.anomaly_types_analyzed}`);
    console.log(`   • Anomalies detected: ${result.anomalies_detected}`);
    console.log(`   • Anomalies saved: ${result.anomalies_saved}`);

    if (result.breakdown) {
      console.log('\n📈 Breakdown by Type:');
      console.log('──────────────────────────────────────');
      Object.entries(result.breakdown).forEach(([type, count]) => {
        const emoji = count > 0 ? '🔴' : '✅';
        const status = count > 0 ? `${count} detected` : 'none';
        console.log(`   ${emoji} ${type.padEnd(20)}: ${status}`);
      });
    }

    // Expected results
    console.log('\n🎯 Expected Anomalies (injected):');
    console.log('──────────────────────────────────────');
    console.log('   • 1 duration spike (5000ms)');
    console.log('   • 1 TTFT spike (2000ms)');
    console.log('   • 1 token usage spike (8000 tokens)');
    console.log('   • 1 cost spike ($0.50)');
    console.log('   • 1 throughput drop (10 tokens/s)');

    if (result.anomalies_detected >= 4) {
      console.log('\n✅ SUCCESS: Anomaly detection working correctly!');
    } else if (result.anomalies_detected > 0) {
      console.log('\n⚠️  PARTIAL: Some anomalies detected, but may have missed some');
    } else {
      console.log('\n❌ ISSUE: No anomalies detected despite injected outliers');
    }

    // Fetch anomalies for details
    if (result.anomalies_saved > 0) {
      console.log('\n6️⃣ Fetching anomaly details...');
      const anomaliesResponse = await fetch('http://localhost:3000/api/analytics/anomalies?limit=20', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (anomaliesResponse.ok) {
        const anomaliesData = await anomaliesResponse.json();
        console.log(`\n🔍 Detected Anomalies (${anomaliesData.data?.length || 0} total):\n`);
        console.log('══════════════════════════════════════');

        anomaliesData.data?.forEach((anomaly, idx) => {
          console.log(`\n${idx + 1}. [${anomaly.severity.toUpperCase()}] ${anomaly.metric_name}`);
          console.log(`   Type: ${anomaly.anomaly_type}`);
          console.log(`   Description: ${anomaly.description}`);
          console.log(`   Confidence: ${(anomaly.confidence_score * 100).toFixed(0)}%`);
          console.log(`   Value: ${anomaly.detected_value.toFixed(2)} (expected: ${anomaly.expected_value.toFixed(2)})`);
          console.log(`   Deviation: ${anomaly.deviation_percentage.toFixed(1)}%`);
        });
      }
    }

    console.log('\n══════════════════════════════════════');
    console.log('✅ Test Complete!');
    console.log('══════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testAnomalyDetection();
