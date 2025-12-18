#!/usr/bin/env node
/**
 * Real-world user scenario: Capture and query production analytics
 * An ML engineer wants to track production inference metrics and traces
 */

import { FinetuneLabClient } from './dist/index.js';

// User's API key (with 'production' or 'all' scope)
const API_KEY = 'wak_J1E8DNQiJsiJdocIkTXOTLxQdBQMFtNJ';  // Has 'all' scope
const BASE_URL = 'http://localhost:3000';

console.log("=".repeat(70));
console.log("📈 PRODUCTION ANALYTICS MONITORING");
console.log("=".repeat(70));
console.log(`\nUsing API: ${BASE_URL}\n`);

// Initialize the SDK
const client = new FinetuneLabClient({ apiKey: API_KEY, baseUrl: BASE_URL });

try {
  // Scenario 1: Create a trace for production inference
  console.log("1️⃣  Logging a production inference trace...");
  console.log("-".repeat(70));

  const traceId = `trace_${Date.now()}`;
  const spanId = `span_${Date.now()}`;

  const now = new Date().toISOString();

  const traceData = {
    traceId,
    spanId,
    spanName: "chat_completion",
    startTime: now,
    endTime: now,
    durationMs: 1250,
    operationType: "llm_call",  // Valid types: llm_call, tool_call, etc.
    modelName: "gpt-4",
    modelProvider: "openai",
    inputTokens: 150,
    outputTokens: 200,
    status: "completed",  // Valid statuses: completed, failed, pending
    metadata: {
      user_message: "Explain fine-tuning",
      temperature: 0.7,
      max_tokens: 500
    }
  };

  const createResult = await client.analytics.createTrace(traceData);
  const traceIdCreated = createResult.data?.id || createResult.id || 'unknown';
  console.log(`✓ Created trace: ${traceIdCreated}`);
  console.log(`   • Model: ${traceData.modelName}`);
  console.log(`   • Duration: ${traceData.durationMs}ms`);
  console.log(`   • Tokens: ${traceData.inputTokens} in, ${traceData.outputTokens} out`);
  console.log();

  // Scenario 2: Query recent traces
  console.log("\n2️⃣  Querying recent production traces...");
  console.log("-".repeat(70));

  const traces = await client.analytics.traces({ limit: 5 });
  const tracesList = traces.data || traces.traces || [];
  console.log(`✓ Retrieved ${tracesList.length} recent traces`);

  if (tracesList.length > 0) {
    console.log();
    for (let i = 0; i < Math.min(3, tracesList.length); i++) {
      const trace = tracesList[i];
      console.log(`   Trace ${i + 1}:`);
      console.log(`   • ID: ${trace.trace_id || 'N/A'}`);
      console.log(`   • Model: ${trace.model_name || 'N/A'}`);
      console.log(`   • Operation: ${trace.operation_type || 'N/A'}`);
      console.log(`   • Duration: ${trace.duration_ms || 'N/A'}ms`);
      console.log(`   • Status: ${trace.status || 'N/A'}`);
      console.log(`   • Created: ${trace.created_at || 'N/A'}`);
      console.log();
    }
  } else {
    console.log("   No traces found. Create some inference traces first!");
    console.log();
  }

  // Scenario 3: Get aggregated analytics data
  console.log("\n3️⃣  Fetching aggregated analytics metrics...");
  console.log("-".repeat(70));

  // Get analytics for the last 7 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  const analytics = await client.analytics.data({
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    granularity: 'day'
  });
  console.log(`✓ Retrieved analytics data`);

  if (analytics.timeseries && analytics.timeseries.length > 0) {
    console.log(`   • Data points: ${analytics.timeseries.length}`);
    console.log();

    // Show summary stats
    if (analytics.summary) {
      const summary = analytics.summary;
      console.log("   Summary Statistics:");
      console.log(`   • Total traces: ${summary.total_traces || 0}`);
      console.log(`   • Average duration: ${(summary.avg_duration_ms || 0).toFixed(0)}ms`);
      console.log(`   • Total tokens: ${summary.total_tokens || 0}`);
      console.log(`   • Error rate: ${((summary.error_rate || 0) * 100).toFixed(2)}%`);
      console.log();
    }

    // Show recent data points
    console.log("   Recent activity:");
    for (const point of analytics.timeseries.slice(0, 3)) {
      console.log(`   • ${point.timestamp || 'N/A'}: ${point.count || 0} traces`);
    }
  } else {
    console.log("   No analytics data available yet.");
    console.log("   Create some traces first to see aggregated metrics!");
  }
  console.log();

  // Scenario 4: Filter traces by conversation
  console.log("\n4️⃣  Demonstrating trace filtering...");
  console.log("-".repeat(70));

  // Query with pagination
  const page1 = await client.analytics.traces({ limit: 10, offset: 0 });
  const page1List = page1.data || page1.traces || [];

  console.log(`✓ Pagination working:`);
  console.log(`   • Retrieved ${page1List.length} traces (limit: 10)`);
  console.log(`   • Use offset parameter to fetch more`);
  console.log();

  // Example of filtering by specific trace
  if (page1List.length > 0) {
    const sampleTraceId = page1List[0].trace_id;
    if (sampleTraceId) {
      const filtered = await client.analytics.traces({ traceId: sampleTraceId });
      const filteredList = filtered.data || filtered.traces || [];
      console.log(`✓ Filtered by trace_id:`);
      console.log(`   • Found ${filteredList.length} matching trace(s)`);
      console.log();
    }
  }

  console.log("=".repeat(70));
  console.log("✅ Analytics monitoring complete!");
  console.log("=".repeat(70));
  console.log("\n💡 Use cases demonstrated:");
  console.log("   • Log production inference traces");
  console.log("   • Query and filter traces");
  console.log("   • View aggregated analytics metrics");
  console.log("   • Pagination and filtering");
  console.log();

} catch (error) {
  console.error(`\n✗ Error: ${error.message}`);
  if (error.statusCode) {
    console.error(`   Status code: ${error.statusCode}`);
  }
  if (error.details) {
    console.error(`   Details:`, error.details);
  }
  process.exit(1);
}
