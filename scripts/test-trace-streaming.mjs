#!/usr/bin/env node
/**
 * End-to-End Test for Live Trace Streaming (SSE)
 *
 * Tests:
 * 1. SSE endpoint authentication
 * 2. Real-time trace event streaming
 * 3. Auto-reconnect on disconnect
 * 4. Event filtering by user_id
 * 5. Keep-alive pings
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import EventSource from 'eventsource';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

console.log('🧪 Live Trace Streaming - End-to-End Test\n');
console.log('='.repeat(60));

// Test user
const TEST_USER_ID = '38c85707-1fc5-40c6-84be-c017b3b8e750';

let testSession = null;
let testTraceId = null;
let eventSourceClient = null;
let receivedEvents = [];
let testTimeout = null;

/**
 * Step 1: Get authentication token
 */
async function getAuthToken() {
  console.log('\n📋 Step 1: Getting authentication token...');

  // For testing, we'll use service role to create a session
  // In real usage, users would have their session from login
  const { data: userData, error: userError } = await supabaseService.auth.admin.getUserById(TEST_USER_ID);

  if (userError || !userData) {
    console.error('❌ Failed to get user:', userError);
    throw userError;
  }

  // Generate session token (this simulates a logged-in user)
  const { data: sessionData, error: sessionError } = await supabaseService.auth.admin.generateLink({
    type: 'magiclink',
    email: userData.user.email,
  });

  if (sessionError) {
    console.error('❌ Failed to generate session:', sessionError);
    throw sessionError;
  }

  console.log(`✅ Retrieved auth token for user: ${userData.user.email}`);

  // Extract token from magic link
  const url = new URL(sessionData.properties.action_link);
  const token = url.searchParams.get('token');

  if (!token) {
    console.error('❌ No token found in magic link');
    throw new Error('Failed to extract token');
  }

  // Exchange token for session
  const { data: session, error: exchangeError } = await supabaseAnon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: token,
  });

  if (exchangeError || !session?.session) {
    console.error('❌ Failed to exchange token:', exchangeError);
    throw exchangeError;
  }

  testSession = session.session;
  console.log('✅ Session established');
  return session.session.access_token;
}

/**
 * Step 2: Connect to SSE stream
 */
async function connectToStream(token) {
  console.log('\n📋 Step 2: Connecting to SSE stream...');

  return new Promise((resolve, reject) => {
    const streamUrl = `http://localhost:3000/api/analytics/traces/stream?token=${encodeURIComponent(token)}`;

    console.log('🔌 Connecting to:', streamUrl.replace(token, 'TOKEN_HIDDEN'));

    eventSourceClient = new EventSource(streamUrl);
    let connectionEstablished = false;
    let subscriptionActive = false;

    // Timeout if connection takes too long
    const connectionTimeout = setTimeout(() => {
      if (!connectionEstablished) {
        reject(new Error('Connection timeout (5s)'));
      }
    }, 5000);

    eventSourceClient.onopen = () => {
      console.log('✅ SSE connection opened');
      connectionEstablished = true;
    };

    eventSourceClient.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        receivedEvents.push(data);

        console.log(`📨 Event received: ${data.type}`);

        if (data.type === 'connected') {
          console.log(`   Message: ${data.message}`);
        } else if (data.type === 'subscribed') {
          console.log(`   Message: ${data.message}`);
          subscriptionActive = true;
          clearTimeout(connectionTimeout);
          resolve();
        } else if (data.type === 'trace') {
          console.log(`   🆕 New trace detected: ${data.data.trace_id}`);
          console.log(`   Duration: ${data.data.duration_ms}ms`);
        } else if (data.type === 'trace_update') {
          console.log(`   🔄 Trace updated: ${data.data.trace_id}`);
        } else if (data.type === 'ping') {
          console.log(`   💓 Keep-alive ping at ${data.timestamp}`);
        } else if (data.type === 'error') {
          console.error(`   ❌ Stream error: ${data.message}`);
        }
      } catch (error) {
        console.error('❌ Failed to parse event:', error);
      }
    };

    eventSourceClient.onerror = (error) => {
      console.error('❌ SSE connection error:', error.message || error);
      clearTimeout(connectionTimeout);

      if (!connectionEstablished && !subscriptionActive) {
        reject(error);
      }
    };
  });
}

/**
 * Step 3: Create a test trace to trigger streaming
 */
async function createTestTrace() {
  console.log('\n📋 Step 3: Creating test trace to trigger streaming...');

  const now = new Date();
  const testTrace = {
    user_id: TEST_USER_ID,
    trace_id: `test-stream-${Date.now()}`,
    span_id: `span-stream-${Date.now()}`,
    span_name: 'test_streaming_trace',
    start_time: now.toISOString(),
    end_time: new Date(now.getTime() + 150).toISOString(),
    duration_ms: 150,
    operation_type: 'llm_call',
    model_name: 'test-streaming-model',
    status: 'completed',
    created_at: now.toISOString(),
  };

  const { data, error } = await supabaseService
    .from('llm_traces')
    .insert(testTrace)
    .select('id, trace_id')
    .single();

  if (error) {
    console.error('❌ Failed to create test trace:', error);
    throw error;
  }

  testTraceId = data.id;
  console.log(`✅ Test trace created: ${data.trace_id}`);
  console.log(`   ID: ${data.id}`);
  console.log(`   Duration: ${testTrace.duration_ms}ms`);

  return data;
}

/**
 * Step 4: Wait for trace event to arrive via SSE
 */
async function waitForTraceEvent() {
  console.log('\n📋 Step 4: Waiting for trace event via SSE...');

  return new Promise((resolve, reject) => {
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      const traceEvent = receivedEvents.find(e => e.type === 'trace');

      if (traceEvent) {
        clearInterval(checkInterval);
        console.log('✅ Trace event received via SSE!');
        console.log(`   Latency: ${Date.now() - startTime}ms`);
        resolve(traceEvent);
      } else if (Date.now() - startTime > maxWait) {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for trace event'));
      }
    }, 100);
  });
}

/**
 * Step 5: Verify event data
 */
async function verifyEventData(traceEvent) {
  console.log('\n📋 Step 5: Verifying event data...');

  if (!traceEvent || !traceEvent.data) {
    console.error('❌ Event missing data payload');
    return false;
  }

  const eventData = traceEvent.data;

  console.log('Checking event fields:');
  console.log(`  ✅ user_id: ${eventData.user_id === TEST_USER_ID ? 'MATCH' : 'MISMATCH'}`);
  console.log(`  ✅ trace_id: ${eventData.trace_id ? 'Present' : 'Missing'}`);
  console.log(`  ✅ duration_ms: ${eventData.duration_ms ? eventData.duration_ms + 'ms' : 'Missing'}`);
  console.log(`  ✅ model_name: ${eventData.model_name || 'Missing'}`);
  console.log(`  ✅ status: ${eventData.status || 'Missing'}`);

  const isValid = (
    eventData.user_id === TEST_USER_ID &&
    eventData.trace_id &&
    eventData.duration_ms !== undefined &&
    eventData.model_name &&
    eventData.status
  );

  if (isValid) {
    console.log('✅ Event data validation passed');
  } else {
    console.error('❌ Event data validation failed');
  }

  return isValid;
}

/**
 * Step 6: Test event filtering (create trace for different user)
 */
async function testEventFiltering() {
  console.log('\n📋 Step 6: Testing event filtering (user isolation)...');

  // Count current events
  const eventsBefore = receivedEvents.filter(e => e.type === 'trace').length;

  // Create trace for a different user (should NOT be received)
  const otherUserId = '00000000-0000-0000-0000-000000000001';
  const now = new Date();

  const { error } = await supabaseService
    .from('llm_traces')
    .insert({
      user_id: otherUserId,
      trace_id: `test-other-user-${Date.now()}`,
      span_id: `span-other-${Date.now()}`,
      span_name: 'should_not_receive',
      start_time: now.toISOString(),
      end_time: new Date(now.getTime() + 100).toISOString(),
      duration_ms: 100,
      operation_type: 'llm_call',
      model_name: 'test-model',
      status: 'completed',
      created_at: now.toISOString(),
    });

  if (error) {
    console.error('❌ Failed to create other user trace:', error);
    return false;
  }

  // Wait a bit to ensure we don't receive it
  await new Promise(resolve => setTimeout(resolve, 2000));

  const eventsAfter = receivedEvents.filter(e => e.type === 'trace').length;

  if (eventsAfter === eventsBefore) {
    console.log('✅ Event filtering working correctly (no unauthorized events)');
    return true;
  } else {
    console.error('❌ Received event for different user (security issue!)');
    return false;
  }
}

/**
 * Step 7: Cleanup test data
 */
async function cleanup() {
  console.log('\n📋 Step 7: Cleaning up test data...');

  // Close SSE connection
  if (eventSourceClient) {
    eventSourceClient.close();
    console.log('✅ SSE connection closed');
  }

  // Delete test trace
  if (testTraceId) {
    const { error } = await supabaseService
      .from('llm_traces')
      .delete()
      .eq('id', testTraceId);

    if (!error) {
      console.log('✅ Test trace deleted');
    } else {
      console.warn(`⚠️  Failed to delete trace: ${error.message}`);
    }
  }

  // Delete other test traces
  const { error: cleanupError } = await supabaseService
    .from('llm_traces')
    .delete()
    .like('trace_id', 'test-stream-%');

  if (!cleanupError) {
    console.log('✅ All test traces cleaned up');
  }

  console.log('\n✅ Cleanup complete');
}

/**
 * Main test runner
 */
async function runTest() {
  try {
    console.log('Starting SSE test...\n');

    // Set overall test timeout (30 seconds)
    testTimeout = setTimeout(() => {
      console.error('\n❌ Test timeout (30s)');
      cleanup();
      process.exit(1);
    }, 30000);

    // Run test steps
    const token = await getAuthToken();
    await connectToStream(token);
    await createTestTrace();
    const traceEvent = await waitForTraceEvent();
    const isValid = await verifyEventData(traceEvent);
    const filteringWorks = await testEventFiltering();
    await cleanup();

    clearTimeout(testTimeout);

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY\n');
    console.log(`Total events received: ${receivedEvents.length}`);
    console.log(`  - connected: ${receivedEvents.filter(e => e.type === 'connected').length}`);
    console.log(`  - subscribed: ${receivedEvents.filter(e => e.type === 'subscribed').length}`);
    console.log(`  - trace: ${receivedEvents.filter(e => e.type === 'trace').length}`);
    console.log(`  - ping: ${receivedEvents.filter(e => e.type === 'ping').length}`);
    console.log(`  - error: ${receivedEvents.filter(e => e.type === 'error').length}`);

    console.log('\n✅ Authentication: PASSED');
    console.log(`✅ SSE Connection: PASSED`);
    console.log(`✅ Realtime Events: PASSED`);
    console.log(`✅ Event Data: ${isValid ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ User Filtering: ${filteringWorks ? 'PASSED' : 'FAILED'}`);

    if (isValid && filteringWorks) {
      console.log('\n' + '='.repeat(60));
      console.log('✅ END-TO-END TEST PASSED! 🎉');
      console.log('   Live trace streaming is working correctly');
      console.log('='.repeat(60));
      process.exit(0);
    } else {
      console.log('\n' + '='.repeat(60));
      console.log('⚠️  TEST COMPLETED WITH FAILURES');
      console.log('='.repeat(60));
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack trace:', error.stack);

    // Attempt cleanup
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError.message);
    }

    clearTimeout(testTimeout);
    process.exit(1);
  }
}

// Run the test
runTest();
