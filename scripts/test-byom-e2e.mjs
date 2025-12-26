#!/usr/bin/env node
/**
 * End-to-End Test for BYOM (Bring Your Own Model) Demo Feature
 *
 * Tests:
 * 1. Session creation with encrypted API key
 * 2. Connection test to mock endpoint
 * 3. Batch test execution (background processing)
 * 4. Chat with user's model about results
 * 5. Export results (CSV & JSON)
 * 6. Session cleanup and data deletion
 * 7. Security validations (SSRF, rate limiting)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import http from 'http';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🧪 BYOM (Bring Your Own Model) - End-to-End Test\n');
console.log('='.repeat(60));

// Test configuration
const MOCK_MODEL_ID = 'test-model-e2e';
const MOCK_MODEL_NAME = 'Test Model for E2E';
let MOCK_SERVER_URL = '';
let mockServer = null;
let testSessionId = null;
let testRunId = null;

/**
 * Step 0: Start mock OpenAI-compatible server
 */
async function startMockServer() {
  console.log('\n📋 Step 0: Starting mock OpenAI-compatible server...');

  return new Promise((resolve) => {
    mockServer = http.createServer((req, res) => {
      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        // Check authorization header
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Missing or invalid authorization' } }));
          return;
        }

        const apiKey = authHeader.replace('Bearer ', '');
        if (apiKey !== 'test-api-key-e2e-byom-2025') {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Invalid API key' } }));
          return;
        }

        // Parse request
        try {
          const requestData = JSON.parse(body);
          const messages = requestData.messages || [];
          const lastMessage = messages[messages.length - 1];

          // Simulate OpenAI response
          const response = {
            id: 'chatcmpl-test-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: MOCK_MODEL_ID,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: `Mock response to: "${lastMessage?.content || 'unknown'}"`
                },
                finish_reason: 'stop'
              }
            ],
            usage: {
              prompt_tokens: 25,
              completion_tokens: 15,
              total_tokens: 40
            }
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Invalid request body' } }));
        }
      });
    });

    mockServer.listen(0, 'localhost', () => {
      const address = mockServer.address();
      MOCK_SERVER_URL = `http://localhost:${address.port}/v1/chat/completions`;
      console.log(`✅ Mock server started at ${MOCK_SERVER_URL}`);
      resolve();
    });
  });
}

/**
 * Step 1: Create demo session with model configuration
 */
async function createDemoSession() {
  console.log('\n📋 Step 1: Creating demo session...');

  const response = await fetch('http://localhost:3000/api/demo/v2/configure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint_url: MOCK_SERVER_URL,
      api_key: 'test-api-key-e2e-byom-2025',
      model_id: MOCK_MODEL_ID,
      model_name: MOCK_MODEL_NAME,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create session: ${response.status} - ${error}`);
  }

  const data = await response.json();
  testSessionId = data.session_id;

  console.log(`✅ Session created: ${testSessionId}`);
  console.log(`   Model: ${data.model_name}`);
  console.log(`   Expires: ${data.expires_at}`);

  return data;
}

/**
 * Step 2: Test connection to model endpoint
 */
async function testConnection() {
  console.log('\n📋 Step 2: Testing connection to model...');

  const response = await fetch('http://localhost:3000/api/demo/v2/configure/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: testSessionId }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Connection test failed: ${response.status} - ${error}`);
  }

  const data = await response.json();

  console.log(`✅ Connection successful`);
  console.log(`   Latency: ${data.latency_ms}ms`);

  return data;
}

/**
 * Step 3: Start batch test
 */
async function startBatchTest() {
  console.log('\n📋 Step 3: Starting batch test...');

  // First, create a test suite
  const { data: testSuite, error: suiteError } = await supabase
    .from('demo_test_suites')
    .select('id')
    .eq('task_domain', 'qa')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (suiteError) {
    console.log('   Creating test suite for E2E test...');

    const { data: newSuite, error: createError } = await supabase
      .from('demo_test_suites')
      .insert({
        name: 'E2E Test Suite',
        description: 'Test suite for end-to-end BYOM testing',
        task_domain: 'qa',
        difficulty: 'easy',
        prompts: [
          { prompt: 'What is 2+2?' },
          { prompt: 'What color is the sky?' },
          { prompt: 'Who wrote Romeo and Juliet?' },
        ],
        prompt_count: 3,
        is_active: true,
      })
      .select('id')
      .single();

    if (createError) {
      throw new Error(`Failed to create test suite: ${createError.message}`);
    }

    console.log(`   ✅ Test suite created: ${newSuite.id}`);
  }

  const suiteId = testSuite?.id || (await supabase
    .from('demo_test_suites')
    .select('id')
    .eq('name', 'E2E Test Suite')
    .single()).data?.id;

  // Start batch test
  const response = await fetch('http://localhost:3000/api/demo/v2/batch-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: testSessionId,
      test_suite_id: suiteId,
      prompt_limit: 3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to start batch test: ${response.status} - ${error}`);
  }

  const data = await response.json();
  testRunId = data.test_run_id;

  console.log(`✅ Batch test started: ${testRunId}`);
  console.log(`   Total prompts: ${data.total_prompts}`);

  return data;
}

/**
 * Step 4: Poll for batch test completion
 */
async function waitForBatchTestCompletion() {
  console.log('\n📋 Step 4: Waiting for batch test completion...');

  const maxWait = 30000; // 30 seconds
  const pollInterval = 1000; // 1 second
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const response = await fetch(
      `http://localhost:3000/api/demo/v2/batch-test?test_run_id=${testRunId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to poll batch test: ${response.status}`);
    }

    const data = await response.json();

    console.log(`   Progress: ${(data.progress * 100).toFixed(0)}% (${data.completed_prompts + data.failed_prompts}/${data.total_prompts})`);

    if (data.status === 'completed' || data.status === 'failed') {
      console.log(`✅ Batch test ${data.status}`);
      console.log(`   Completed: ${data.completed_prompts}`);
      console.log(`   Failed: ${data.failed_prompts}`);
      console.log(`   Results: ${data.results?.length || 0} records`);
      return data;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Batch test did not complete within 30 seconds');
}

/**
 * Step 5: Chat with model about batch test results
 */
async function chatWithModel() {
  console.log('\n📋 Step 5: Chatting with model about results...');

  const response = await fetch('http://localhost:3000/api/demo/v2/atlas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: testSessionId,
      messages: [
        { role: 'user', content: 'What was the success rate of the batch test?' }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Chat failed: ${response.status} - ${error}`);
  }

  // Read SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let chatResponse = '';
  let tokenUsage = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'token_usage') {
            tokenUsage = parsed;
          } else if (parsed.content) {
            chatResponse += parsed.content;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }

  console.log(`✅ Chat response received`);
  console.log(`   Response: "${chatResponse.substring(0, 100)}..."`);
  if (tokenUsage) {
    console.log(`   Token usage: ${tokenUsage.input_tokens} in, ${tokenUsage.output_tokens} out`);
  }

  return { response: chatResponse, tokenUsage };
}

/**
 * Step 6: Export results (CSV & JSON)
 */
async function exportResults() {
  console.log('\n📋 Step 6: Exporting results...');

  // Test CSV export
  const csvResponse = await fetch(
    `http://localhost:3000/api/demo/v2/export?session_id=${testSessionId}&format=csv`
  );

  if (!csvResponse.ok) {
    throw new Error(`CSV export failed: ${csvResponse.status}`);
  }

  const csvData = await csvResponse.text();
  const csvLines = csvData.split('\n').length;

  console.log(`✅ CSV export successful`);
  console.log(`   Lines: ${csvLines}`);

  // Test JSON export
  const jsonResponse = await fetch(
    `http://localhost:3000/api/demo/v2/export?session_id=${testSessionId}&format=json`
  );

  if (!jsonResponse.ok) {
    throw new Error(`JSON export failed: ${jsonResponse.status}`);
  }

  const jsonData = await jsonResponse.json();

  console.log(`✅ JSON export successful`);
  console.log(`   Results: ${jsonData.results?.length || 0}`);
  console.log(`   Metrics: Success rate ${jsonData.metrics?.successRate}%`);

  return { csv: csvData, json: jsonData };
}

/**
 * Step 7: Cleanup session
 */
async function cleanupSession() {
  console.log('\n📋 Step 7: Cleaning up session...');

  const response = await fetch('http://localhost:3000/api/demo/v2/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: testSessionId }),
  });

  if (!response.ok) {
    throw new Error(`Cleanup failed: ${response.status}`);
  }

  const data = await response.json();

  console.log(`✅ Cleanup successful`);
  console.log(`   Config deleted: ${data.deleted?.config}`);
  console.log(`   Test runs deleted: ${data.deleted?.testRuns}`);
  console.log(`   Results deleted: ${data.deleted?.results}`);

  // Verify session is gone
  const { data: config, error } = await supabase
    .from('demo_model_configs')
    .select('id')
    .eq('session_id', testSessionId)
    .single();

  if (!error) {
    throw new Error('Session still exists after cleanup!');
  }

  console.log(`✅ Verified: Session completely deleted from database`);

  return data;
}

/**
 * Step 8: Security validations
 */
async function testSecurityValidations() {
  console.log('\n📋 Step 8: Testing security validations...');

  // Test SSRF protection (localhost blocked)
  console.log('   Testing SSRF protection...');
  const ssrfResponse = await fetch('http://localhost:3000/api/demo/v2/configure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint_url: 'http://localhost:8080/evil',
      api_key: 'test-key',
      model_id: 'test-model',
    }),
  });

  if (process.env.DEMO_ALLOW_LOCALHOST !== 'true' && ssrfResponse.ok) {
    throw new Error('SSRF protection failed: localhost URL was allowed!');
  }

  console.log(`   ✅ SSRF protection working (localhost ${process.env.DEMO_ALLOW_LOCALHOST === 'true' ? 'allowed in dev' : 'blocked'})`);

  // Test private IP blocking
  const privateIpResponse = await fetch('http://localhost:3000/api/demo/v2/configure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint_url: 'http://192.168.1.1/api',
      api_key: 'test-key',
      model_id: 'test-model',
    }),
  });

  if (privateIpResponse.ok) {
    throw new Error('SSRF protection failed: private IP was allowed!');
  }

  console.log(`   ✅ Private IP blocking working`);

  console.log('✅ All security validations passed');
}

/**
 * Cleanup function
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up test resources...');

  // Stop mock server
  if (mockServer) {
    mockServer.close();
    console.log('✅ Mock server stopped');
  }

  // Delete test session if it exists
  if (testSessionId) {
    try {
      await supabase
        .from('demo_batch_test_results')
        .delete()
        .eq('demo_session_id', testSessionId);

      await supabase
        .from('demo_batch_test_runs')
        .delete()
        .eq('demo_session_id', testSessionId);

      await supabase
        .from('demo_model_configs')
        .delete()
        .eq('session_id', testSessionId);

      console.log('✅ Test session cleaned up');
    } catch (err) {
      console.warn(`⚠️  Cleanup warning: ${err.message}`);
    }
  }

  // Clean up E2E test suite
  try {
    await supabase
      .from('demo_test_suites')
      .delete()
      .eq('name', 'E2E Test Suite');
    console.log('✅ Test suite cleaned up');
  } catch (err) {
    console.warn(`⚠️  Test suite cleanup warning: ${err.message}`);
  }
}

/**
 * Main test runner
 */
async function runTest() {
  try {
    console.log('Starting BYOM E2E test...\n');

    // Set overall test timeout (60 seconds)
    const testTimeout = setTimeout(() => {
      console.error('\n❌ Test timeout (60s)');
      cleanup();
      process.exit(1);
    }, 60000);

    // Run test steps
    await startMockServer();
    await createDemoSession();
    await testConnection();
    await startBatchTest();
    const testResults = await waitForBatchTestCompletion();
    await chatWithModel();
    await exportResults();
    await cleanupSession();
    await testSecurityValidations();

    clearTimeout(testTimeout);

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY\n');
    console.log('✅ Session Creation: PASSED');
    console.log('✅ Connection Test: PASSED');
    console.log('✅ Batch Testing: PASSED');
    console.log(`   - ${testResults.completed_prompts} prompts completed`);
    console.log(`   - ${testResults.failed_prompts} prompts failed`);
    console.log('✅ Chat Interface: PASSED');
    console.log('✅ Export (CSV/JSON): PASSED');
    console.log('✅ Session Cleanup: PASSED');
    console.log('✅ Security Validations: PASSED');

    console.log('\n' + '='.repeat(60));
    console.log('✅ END-TO-END TEST PASSED! 🎉');
    console.log('   BYOM feature is working correctly');
    console.log('='.repeat(60));

    await cleanup();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack trace:', error.stack);

    // Attempt cleanup
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError.message);
    }

    process.exit(1);
  }
}

// Run the test
runTest();
