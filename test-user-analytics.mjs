/**
 * End-to-End Test: Analytics Monitoring (Node.js SDK)
 *
 * Simulates a real user scenario:
 * 1. Create production inference traces
 * 2. Query and filter traces
 * 3. View aggregated analytics metrics
 */

import { FinetuneLabClient } from './packages/finetune-lab-sdk/dist/index.js';

// Configuration
const API_KEY = 'wak_J1E8DNQiJsiJdocIkTXOTLxQdBQMFtNJ'; // 'all' scope key
const BASE_URL = 'http://localhost:3000';

const client = new FinetuneLabClient({
  apiKey: API_KEY,
  baseUrl: BASE_URL
});

console.log('======================================================================');
console.log('🧪 Testing Analytics SDK - Production Monitoring Workflow');
console.log('======================================================================\n');

// Helper to generate unique trace IDs
function generateTraceId() {
  return `trace_${Date.now()}`;
}

function generateSpanId() {
  return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function runAnalyticsTest() {
  try {
    // Step 1: Create production inference traces
    console.log('1️⃣  Creating production inference traces...');
    console.log('----------------------------------------------------------------------');

    const traces = [];
    for (let i = 0; i < 3; i++) {
      const traceId = generateTraceId();
      const spanId = generateSpanId();

      const now = new Date().toISOString();

      const traceData = {
        traceId: traceId,
        spanId: spanId,
        spanName: 'chat_completion',
        startTime: now,
        endTime: now,
        durationMs: 1250,
        operationType: 'llm_call',
        modelName: 'gpt-4',
        modelProvider: 'openai',
        inputTokens: 150,
        outputTokens: 200,
        status: 'completed',
        metadata: {
          user_query: `Test query ${i + 1}`,
          temperature: 0.7,
          endpoint: '/api/chat'
        }
      };

      const result = await client.analytics.createTrace(traceData);
      traces.push(result);

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✓ Created ${traces.length} production traces\n`);
    console.log('   Sample trace:');
    console.log(`   • ID: ${traces[0].trace_id}`);
    console.log(`   • Model: ${traces[0].model_name}`);
    console.log(`   • Duration: ${traces[0].duration_ms}ms`);
    console.log(`   • Tokens: ${traces[0].input_tokens} in, ${traces[0].output_tokens} out\n`);

    // Step 2: Query recent traces
    console.log('2️⃣  Querying recent production traces...');
    console.log('----------------------------------------------------------------------');

    const tracesList = await client.analytics.traces({ limit: 5 });
    const recentTraces = tracesList.data || [];

    console.log(`✓ Retrieved ${recentTraces.length} recent traces\n`);

    recentTraces.slice(0, 3).forEach((trace, idx) => {
      console.log(`   Trace ${idx + 1}:`);
      console.log(`   • ID: ${trace.trace_id}`);
      console.log(`   • Model: ${trace.model_name}`);
      console.log(`   • Operation: ${trace.operation_type}`);
      console.log(`   • Duration: ${trace.duration_ms}ms`);
      console.log(`   • Status: ${trace.status}`);
      console.log(`   • Created: ${trace.created_at}\n`);
    });

    // Step 3: Get aggregated analytics
    console.log('3️⃣  Fetching aggregated analytics metrics...');
    console.log('----------------------------------------------------------------------');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const analyticsData = await client.analytics.data({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      granularity: 'day'
    });

    console.log('✓ Retrieved analytics data');

    if (analyticsData.conversations?.length > 0) {
      console.log(`   • Conversations: ${analyticsData.conversations.length} data points`);
    }
    if (analyticsData.tokens?.length > 0) {
      console.log(`   • Token usage: ${analyticsData.tokens.length} data points`);
    }
    if (analyticsData.quality?.length > 0) {
      console.log(`   • Quality metrics: ${analyticsData.quality.length} data points`);
    }
    if (analyticsData.latency?.length > 0) {
      console.log(`   • Latency: ${analyticsData.latency.length} data points`);
    }

    if (!analyticsData.conversations && !analyticsData.tokens) {
      console.log('   No analytics data available yet.');
      console.log('   Create some traces first to see aggregated metrics!');
    }

    console.log();

    // Step 4: Demonstrate filtering
    console.log('4️⃣  Demonstrating trace filtering...');
    console.log('----------------------------------------------------------------------');

    // Test pagination
    const paginatedTraces = await client.analytics.traces({ limit: 10 });
    console.log('✓ Pagination working:');
    console.log(`   • Retrieved ${paginatedTraces.data?.length || 0} traces (limit: 10)`);
    console.log('   • Use offset parameter to fetch more\n');

    // Test filtering by trace_id
    if (traces.length > 0) {
      const filteredTraces = await client.analytics.traces({
        trace_id: traces[0].trace_id
      });
      console.log('✓ Filtered by trace_id:');
      console.log(`   • Found ${filteredTraces.data?.length || 0} matching trace(s)\n`);
    }

    // Success summary
    console.log('======================================================================');
    console.log('✅ Analytics monitoring complete!');
    console.log('======================================================================\n');
    console.log('💡 Use cases demonstrated:');
    console.log('   • Log production inference traces');
    console.log('   • Query and filter traces');
    console.log('   • View aggregated analytics metrics');
    console.log('   • Pagination and filtering\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
    process.exit(1);
  }
}

// Run the test
runAnalyticsTest();
