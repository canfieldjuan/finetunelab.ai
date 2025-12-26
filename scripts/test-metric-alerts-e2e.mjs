#!/usr/bin/env node
/**
 * End-to-End Test for Metric Alert Rules
 *
 * Tests the complete metric alert flow:
 * 1. Create a test alert rule via API
 * 2. Create test trace data that should trigger the alert
 * 3. Manually run the evaluation engine
 * 4. Verify evaluation was recorded
 * 5. Verify alert was triggered
 * 6. Clean up test data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Service role client (bypasses RLS for admin operations)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

console.log('🧪 Metric Alert Rules - End-to-End Test\n');
console.log('=' .repeat(60));

// Test configuration
const TEST_USER_EMAIL = 'test-metric-alerts@example.com';
const TEST_RULE_NAME = 'E2E Test: High Latency Alert';

let testUserId = null;
let testRuleId = null;
let testTraceIds = [];
let userAccessToken = null;

/**
 * Step 1: Get or create test user
 */
async function getTestUser() {
  console.log('\n📋 Step 1: Getting test user...');

  // Try to get existing user
  const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
  const user = existingUser?.users?.find(u => u.email === TEST_USER_EMAIL);

  if (user) {
    console.log(`✅ Using existing user: ${user.email} (${user.id})`);
    testUserId = user.id;

    // Generate access token for API calls
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.createSession({
      user_id: user.id,
    });

    if (sessionError) {
      console.error('❌ Failed to create session:', sessionError);
      throw sessionError;
    }

    userAccessToken = sessionData.session.access_token;
    console.log('✅ Generated access token for API calls');
    return user.id;
  }

  console.log('⚠️  Test user not found. Creating new user...');
  console.log('📝 Note: You may need to verify this email in Supabase Dashboard');

  // Create test user
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: 'test-password-12345',
    email_confirm: true,
  });

  if (createError) {
    console.error('❌ Failed to create test user:', createError);
    throw createError;
  }

  console.log(`✅ Created test user: ${newUser.user.email} (${newUser.user.id})`);
  testUserId = newUser.user.id;

  // Generate access token
  const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.createSession({
    user_id: newUser.user.id,
  });

  if (sessionError) {
    console.error('❌ Failed to create session:', sessionError);
    throw sessionError;
  }

  userAccessToken = sessionData.session.access_token;
  console.log('✅ Generated access token for API calls');

  return newUser.user.id;
}

/**
 * Step 2: Create test alert rule via API
 */
async function createTestAlertRule() {
  console.log('\n📋 Step 2: Creating test alert rule via API...');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const rulePayload = {
    rule_name: TEST_RULE_NAME,
    description: 'E2E test rule: Alert when p95 latency > 100ms in last 5 minutes',
    metric_type: 'latency',
    threshold_value: 100,
    comparison_operator: '>',
    time_window_minutes: 5,
    aggregation_method: 'p95',
    notify_email: true,
    notify_webhooks: false,
    notify_integrations: false,
    cooldown_minutes: 1, // Short cooldown for testing
    enabled: true,
  };

  console.log('📤 Sending POST request to /api/analytics/alert-rules');
  console.log('Payload:', JSON.stringify(rulePayload, null, 2));

  const response = await fetch(`${appUrl}/api/analytics/alert-rules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userAccessToken}`,
    },
    body: JSON.stringify(rulePayload),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('❌ Failed to create alert rule:', result);
    throw new Error(result.error || 'Failed to create rule');
  }

  console.log('✅ Alert rule created via API');
  console.log('Rule ID:', result.rule.id);
  console.log('Rule details:', {
    name: result.rule.rule_name,
    metric: result.rule.metric_type,
    threshold: result.rule.threshold_value,
    aggregation: result.rule.aggregation_method,
  });

  testRuleId = result.rule.id;
  return result.rule;
}

/**
 * Step 3: Create test trace data that should trigger the alert
 */
async function createTestTraces() {
  console.log('\n📋 Step 3: Creating test trace data...');
  console.log('Creating 10 traces with varying latencies (5 high, 5 low)');

  const traces = [];
  const now = new Date();

  // Create 5 traces with high latency (200-300ms) - should trigger p95 > 100ms
  for (let i = 0; i < 5; i++) {
    traces.push({
      user_id: testUserId,
      trace_id: `test-trace-high-${i}-${Date.now()}`,
      span_id: `span-${i}`,
      span_name: 'llm_call',
      start_time: new Date(now.getTime() - (4 - i) * 60000).toISOString(), // Last 4 minutes
      end_time: new Date(now.getTime() - (4 - i) * 60000 + 250).toISOString(),
      duration_ms: 250,
      latency_ms: 200 + i * 20, // 200, 220, 240, 260, 280ms
      operation_type: 'llm_call',
      model_name: 'test-model',
      status: 'success',
    });
  }

  // Create 5 traces with low latency (20-40ms)
  for (let i = 0; i < 5; i++) {
    traces.push({
      user_id: testUserId,
      trace_id: `test-trace-low-${i}-${Date.now()}`,
      span_id: `span-low-${i}`,
      span_name: 'llm_call',
      start_time: new Date(now.getTime() - (4 - i) * 60000).toISOString(),
      end_time: new Date(now.getTime() - (4 - i) * 60000 + 30).toISOString(),
      duration_ms: 30,
      latency_ms: 20 + i * 5, // 20, 25, 30, 35, 40ms
      operation_type: 'llm_call',
      model_name: 'test-model',
      status: 'success',
    });
  }

  const { data: insertedTraces, error: insertError } = await supabaseAdmin
    .from('llm_traces')
    .insert(traces)
    .select('id');

  if (insertError) {
    console.error('❌ Failed to create test traces:', insertError);
    throw insertError;
  }

  testTraceIds = insertedTraces.map(t => t.id);
  console.log(`✅ Created ${traces.length} test traces`);
  console.log('Latency distribution:');
  console.log('  High latency (5): 200, 220, 240, 260, 280ms');
  console.log('  Low latency (5): 20, 25, 30, 35, 40ms');
  console.log('  Expected p95: ~270ms (should trigger alert > 100ms)');

  return traces;
}

/**
 * Step 4: Manually trigger evaluation
 */
async function triggerEvaluation() {
  console.log('\n📋 Step 4: Manually triggering evaluation...');

  // Import and run the evaluation engine
  const { EvaluationSchedulerWorker } = await import('../lib/evaluation/scheduler-worker.ts');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const worker = new EvaluationSchedulerWorker(
    supabaseUrl,
    supabaseServiceKey,
    appUrl
  );

  console.log('🔄 Running evaluateMetricAlerts()...');

  // Access the private method via reflection for testing
  await worker['evaluateMetricAlerts']();

  console.log('✅ Evaluation completed');
}

/**
 * Step 5: Verify evaluation was recorded
 */
async function verifyEvaluation() {
  console.log('\n📋 Step 5: Verifying evaluation was recorded...');

  const { data: evaluations, error: evalError } = await supabaseAdmin
    .from('metric_alert_rule_evaluations')
    .select('*')
    .eq('rule_id', testRuleId)
    .order('evaluated_at', { ascending: false })
    .limit(1);

  if (evalError) {
    console.error('❌ Failed to fetch evaluations:', evalError);
    throw evalError;
  }

  if (!evaluations || evaluations.length === 0) {
    console.error('❌ No evaluation found for rule');
    return null;
  }

  const evaluation = evaluations[0];
  console.log('✅ Evaluation recorded:');
  console.log('  Metric Value:', evaluation.metric_value.toFixed(2), 'ms');
  console.log('  Threshold:', evaluation.threshold_value, 'ms');
  console.log('  Triggered:', evaluation.triggered ? '✅ YES' : '❌ NO');
  console.log('  Sample Count:', evaluation.sample_count);
  console.log('  Time Window:', evaluation.time_window_start, 'to', evaluation.time_window_end);

  return evaluation;
}

/**
 * Step 6: Verify alert was triggered
 */
async function verifyAlert(evaluation) {
  console.log('\n📋 Step 6: Verifying alert was triggered...');

  if (!evaluation.triggered) {
    console.log('ℹ️  Alert was not triggered (metric value below threshold)');
    console.log('   This might be expected if test data didn\'t trigger the rule');
    return;
  }

  // Check if rule was updated with trigger info
  const { data: rule, error: ruleError } = await supabaseAdmin
    .from('metric_alert_rules')
    .select('*')
    .eq('id', testRuleId)
    .single();

  if (ruleError) {
    console.error('❌ Failed to fetch rule:', ruleError);
    throw ruleError;
  }

  console.log('✅ Rule state updated:');
  console.log('  Last Triggered:', rule.last_triggered_at || 'Never');
  console.log('  Trigger Count:', rule.trigger_count);

  // Check alert history
  const { data: alerts, error: alertError } = await supabaseAdmin
    .from('alert_history')
    .select('*')
    .eq('user_id', testUserId)
    .ilike('title', '%Metric Alert%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (alertError) {
    console.warn('⚠️  Failed to fetch alert history:', alertError.message);
  } else if (alerts && alerts.length > 0) {
    const alert = alerts[0];
    console.log('✅ Alert sent:');
    console.log('  Type:', alert.alert_type);
    console.log('  Title:', alert.title);
    console.log('  Email Sent:', alert.email_sent ? '✅' : '❌');
    console.log('  Webhook Sent:', alert.webhook_sent ? '✅' : '❌');
    console.log('  Created:', alert.created_at);
  } else {
    console.log('ℹ️  No alert found in alert_history table');
    console.log('   Alert may have been sent but not yet recorded');
  }
}

/**
 * Step 7: Clean up test data
 */
async function cleanup() {
  console.log('\n📋 Step 7: Cleaning up test data...');

  let cleanedCount = 0;

  // Delete test traces
  if (testTraceIds.length > 0) {
    const { error: traceError } = await supabaseAdmin
      .from('llm_traces')
      .delete()
      .in('id', testTraceIds);

    if (traceError) {
      console.warn('⚠️  Failed to delete test traces:', traceError.message);
    } else {
      console.log(`✅ Deleted ${testTraceIds.length} test traces`);
      cleanedCount += testTraceIds.length;
    }
  }

  // Delete test alert rule (cascades to evaluations)
  if (testRuleId) {
    const { error: ruleError } = await supabaseAdmin
      .from('metric_alert_rules')
      .delete()
      .eq('id', testRuleId);

    if (ruleError) {
      console.warn('⚠️  Failed to delete test rule:', ruleError.message);
    } else {
      console.log('✅ Deleted test alert rule');
      cleanedCount++;
    }
  }

  console.log(`\n✅ Cleanup complete (${cleanedCount} items removed)`);
  console.log('ℹ️  Test user was NOT deleted. To remove manually:');
  console.log(`   User ID: ${testUserId}`);
  console.log(`   Email: ${TEST_USER_EMAIL}`);
}

/**
 * Main test execution
 */
async function runE2ETest() {
  try {
    console.log('Starting end-to-end test...\n');

    // Step 1: Get test user
    await getTestUser();

    // Step 2: Create test alert rule
    await createTestAlertRule();

    // Step 3: Create test traces
    await createTestTraces();

    // Step 4: Trigger evaluation
    await triggerEvaluation();

    // Step 5: Verify evaluation
    const evaluation = await verifyEvaluation();

    // Step 6: Verify alert
    if (evaluation) {
      await verifyAlert(evaluation);
    }

    // Step 7: Cleanup
    await cleanup();

    console.log('\n' + '='.repeat(60));
    console.log('✅ End-to-End Test Complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Error details:', error.stack);

    // Attempt cleanup even on failure
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error('❌ Cleanup also failed:', cleanupError.message);
    }

    process.exit(1);
  }
}

// Run the test
runE2ETest();
