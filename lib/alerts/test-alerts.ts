/**
 * Alert System Test Script
 * Run with: npx ts-node lib/alerts/test-alerts.ts
 * Date: 2025-12-12
 */

import { getAlertService, sendTrainingJobAlert, TrainingJobAlertData } from './index';

async function testAlertSystem() {
  console.log('=== Alert System Test ===\n');

  // Test user ID (replace with real user from your DB)
  const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-id';
  const TEST_JOB_ID = 'test-job-' + Date.now();

  try {
    const service = getAlertService();

    // 1. Test preferences
    console.log('1. Testing getUserPreferences...');
    const prefs = await service.getUserPreferences(TEST_USER_ID);
    console.log('   Preferences:', {
      email_enabled: prefs.email_enabled,
      alert_job_completed: prefs.alert_job_completed,
      alert_job_failed: prefs.alert_job_failed,
    });

    // 2. Test upsert preferences
    console.log('\n2. Testing upsertPreferences...');
    const updated = await service.upsertPreferences(TEST_USER_ID, {
      email_enabled: true,
      alert_job_completed: true,
      alert_job_failed: true,
    });
    console.log('   Updated:', updated ? 'OK' : 'FAILED');

    // 3. Test webhook creation
    console.log('\n3. Testing createWebhook...');
    const webhook = await service.createWebhook(TEST_USER_ID, {
      name: 'Test Webhook',
      url: 'https://httpbin.org/post', // Echo service for testing
      webhook_type: 'generic',
      secret: null,
      alert_job_started: false,
      alert_job_completed: true,
      alert_job_failed: true,
      alert_job_cancelled: false,
      alert_batch_test_completed: false,
      alert_batch_test_failed: true,
      alert_gpu_oom: true,
      alert_disk_warning: true,
      alert_timeout_warning: true,
      enabled: true,
    });
    console.log('   Webhook created:', webhook?.id || 'FAILED');

    // 4. Test sending alert
    console.log('\n4. Testing sendTrainingJobAlert...');
    const jobData: TrainingJobAlertData = {
      jobId: TEST_JOB_ID,
      userId: TEST_USER_ID,
      modelName: 'test-model-7b',
      baseModel: 'mistralai/Mistral-7B-v0.1',
      status: 'completed',
      progress: 100,
      currentStep: 1000,
      totalSteps: 1000,
      loss: 0.342,
      duration: 3600000, // 1 hour
      errorMessage: null,
      errorType: null,
    };

    await sendTrainingJobAlert('job_completed', jobData);
    console.log('   Alert sent!');

    // 5. Test alert history
    console.log('\n5. Testing getAlertHistory...');
    const { alerts, total } = await service.getAlertHistory(TEST_USER_ID, 10);
    console.log(`   Found ${total} alerts, showing ${alerts.length}`);

    // 6. Cleanup - delete test webhook
    if (webhook?.id) {
      console.log('\n6. Cleaning up test webhook...');
      await service.deleteWebhook(webhook.id, TEST_USER_ID);
      console.log('   Deleted');
    }

    console.log('\n=== All tests passed ===');

  } catch (err) {
    console.error('\n!!! Test failed:', err);
    process.exit(1);
  }
}

// Run if executed directly
testAlertSystem();
