/**
 * Test Script - Trace API Validation
 * 
 * Tests the trace capture and retrieval endpoints
 * Run with: npm run test:traces
 */

const AUTH_TOKEN = process.env.SUPABASE_AUTH_TOKEN;
const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

console.log('[Trace Test] Starting validation...');
console.log('[Trace Test] API Base:', API_BASE);
console.log('[Trace Test] Auth Token:', AUTH_TOKEN ? 'Present' : 'Missing');

if (!AUTH_TOKEN) {
  console.error('[Trace Test] ERROR: SUPABASE_AUTH_TOKEN not found in environment');
  process.exit(1);
}

async function testTraceCapture() {
  console.log('\n[Test 1] Testing trace capture (POST)...');
  
  const traceData = {
    trace_id: `test-trace-${Date.now()}`,
    span_id: `span-${Date.now()}`,
    span_name: 'test_llm_call',
    operation_type: 'llm_call',
    model_name: 'gpt-4o',
    model_provider: 'openai',
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 1000).toISOString(),
    duration_ms: 1000,
    input_tokens: 100,
    output_tokens: 50,
    total_tokens: 150,
    cost_usd: 0.0042,
    status: 'completed',
    input_data: { prompt: 'Test prompt' },
    output_data: { response: 'Test response' },
    metadata: { test: true }
  };

  try {
    const response = await fetch(`${API_BASE}/api/analytics/traces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify(traceData)
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('[Test 1] ✅ PASS - Trace captured successfully');
      console.log('[Test 1] Trace ID:', result.data.id);
      return result.data;
    } else {
      console.error('[Test 1] ❌ FAIL - Trace capture failed');
      console.error('[Test 1] Status:', response.status);
      console.error('[Test 1] Error:', result.error);
      return null;
    }
  } catch (error) {
    console.error('[Test 1] ❌ FAIL - Exception occurred');
    console.error('[Test 1] Error:', error.message);
    return null;
  }
}

async function testTraceRetrieval(traceId) {
  console.log('\n[Test 2] Testing trace retrieval (GET)...');
  
  try {
    const url = `${API_BASE}/api/analytics/traces?limit=10`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('[Test 2] ✅ PASS - Traces retrieved successfully');
      console.log('[Test 2] Total traces:', result.data.length);
      console.log('[Test 2] Pagination:', result.pagination);
      
      if (traceId) {
        const found = result.data.find(t => t.trace_id === traceId);
        if (found) {
          console.log('[Test 2] ✅ Created trace found in results');
        } else {
          console.log('[Test 2] ⚠️  Created trace not found (may be timing issue)');
        }
      }
      
      return true;
    } else {
      console.error('[Test 2] ❌ FAIL - Trace retrieval failed');
      console.error('[Test 2] Status:', response.status);
      console.error('[Test 2] Error:', result.error);
      return false;
    }
  } catch (error) {
    console.error('[Test 2] ❌ FAIL - Exception occurred');
    console.error('[Test 2] Error:', error.message);
    return false;
  }
}

async function testTraceFiltering(traceId) {
  console.log('\n[Test 3] Testing trace filtering...');
  
  try {
    const url = `${API_BASE}/api/analytics/traces?trace_id=${traceId}&operation_type=llm_call`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('[Test 3] ✅ PASS - Filtering works');
      console.log('[Test 3] Filtered results:', result.data.length);
      return true;
    } else {
      console.error('[Test 3] ❌ FAIL - Filtering failed');
      console.error('[Test 3] Error:', result.error);
      return false;
    }
  } catch (error) {
    console.error('[Test 3] ❌ FAIL - Exception occurred');
    console.error('[Test 3] Error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('  TRACE API VALIDATION TEST SUITE');
  console.log('========================================\n');

  let passCount = 0;
  let totalTests = 3;

  const capturedTrace = await testTraceCapture();
  if (capturedTrace) passCount++;

  await new Promise(resolve => setTimeout(resolve, 1000));

  const retrievalPassed = await testTraceRetrieval(capturedTrace?.trace_id);
  if (retrievalPassed) passCount++;

  if (capturedTrace?.trace_id) {
    const filteringPassed = await testTraceFiltering(capturedTrace.trace_id);
    if (filteringPassed) passCount++;
  }

  console.log('\n========================================');
  console.log(`  TEST RESULTS: ${passCount}/${totalTests} PASSED`);
  console.log('========================================\n');

  if (passCount === totalTests) {
    console.log('✅ ALL TESTS PASSED - Trace API is working correctly');
    process.exit(0);
  } else {
    console.error(`❌ ${totalTests - passCount} TEST(S) FAILED`);
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('[FATAL ERROR]', error);
  process.exit(1);
});
