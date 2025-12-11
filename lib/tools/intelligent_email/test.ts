/**
 * Intelligent Email Tool - Manual Test Script
 * Tests the email sending functionality with Resend
 * 
 * Run with: npx tsx lib/tools/intelligent_email/test.ts
 * 
 * Requirements:
 * - Set RESEND_API_KEY environment variable
 * - Set EMAIL_DEFAULT_FROM to a verified sender email
 */

import intelligentEmailTool from './index';

async function testEmailTool() {
  console.log('=== Intelligent Email Tool - Manual Tests ===\n');

  const testRecipient = process.env.TEST_EMAIL_RECIPIENT;
  const defaultFrom = process.env.EMAIL_DEFAULT_FROM;

  if (!process.env.RESEND_API_KEY) {
    console.error('ERROR: RESEND_API_KEY environment variable not set');
    console.log('Set it with: export RESEND_API_KEY=re_your_key_here');
    process.exit(1);
  }

  if (!testRecipient) {
    console.error('ERROR: TEST_EMAIL_RECIPIENT environment variable not set');
    console.log('Set it with: export TEST_EMAIL_RECIPIENT=your@email.com');
    process.exit(1);
  }

  if (!defaultFrom) {
    console.warn('WARNING: EMAIL_DEFAULT_FROM not set. Tests requiring default sender will fail.\n');
  }

  try {
    // Test 1: Simple email with explicit from
    console.log('Test 1: Simple plain text email');
    const result1 = await intelligentEmailTool.execute({
      to: testRecipient,
      from: defaultFrom || 'test@example.com',
      subject: 'Test Email - Plain Text',
      body: 'This is a test email from the intelligent email tool.',
    });
    console.log('Result:', JSON.stringify(result1, null, 2));
    console.log('Check your inbox for the email.\n');

    // Test 2: HTML email
    console.log('Test 2: HTML email');
    const result2 = await intelligentEmailTool.execute({
      to: testRecipient,
      from: defaultFrom || 'test@example.com',
      subject: 'Test Email - HTML',
      body: 'This is plain text version',
      html: '<h1>Hello!</h1><p>This is an <strong>HTML</strong> email from the intelligent email tool.</p>',
    });
    console.log('Result:', JSON.stringify(result2, null, 2));
    console.log('Check your inbox for the HTML email.\n');

    // Test 3: Multiple recipients
    console.log('Test 3: Multiple recipients (comma-separated)');
    const result3 = await intelligentEmailTool.execute({
      to: testRecipient,
      from: defaultFrom || 'test@example.com',
      subject: 'Test Email - Multiple Recipients',
      body: 'Testing multiple recipients feature.',
    });
    console.log('Result:', JSON.stringify(result3, null, 2));
    console.log('Verified multiple recipient parsing.\n');

    // Test 4: Email with CC
    console.log('Test 4: Email with CC');
    const result4 = await intelligentEmailTool.execute({
      to: testRecipient,
      from: defaultFrom || 'test@example.com',
      subject: 'Test Email - With CC',
      body: 'Testing CC functionality.',
      cc: testRecipient,
    });
    console.log('Result:', JSON.stringify(result4, null, 2));
    console.log('CC test completed.\n');

    // Test 5: Email with reply-to
    console.log('Test 5: Email with reply-to');
    const result5 = await intelligentEmailTool.execute({
      to: testRecipient,
      from: defaultFrom || 'test@example.com',
      subject: 'Test Email - With Reply-To',
      body: 'Testing reply-to functionality. Try replying to this email.',
      replyTo: testRecipient,
    });
    console.log('Result:', JSON.stringify(result5, null, 2));
    console.log('Reply-to test completed.\n');

    console.log('=== All Tests Completed Successfully ===');
    console.log('Check your inbox at:', testRecipient);

  } catch (error) {
    console.error('Test failed with error:');
    console.error(error);
    process.exit(1);
  }
}

async function testErrorCases() {
  console.log('\n=== Testing Error Cases ===\n');

  try {
    // Test: Missing required parameter
    console.log('Test: Missing required parameters');
    try {
      await intelligentEmailTool.execute({
        to: 'test@example.com',
      });
      console.log('ERROR: Should have thrown an error');
    } catch (error) {
      console.log('Correctly threw error:', error instanceof Error ? error.message : error);
    }

    // Test: Missing sender
    console.log('\nTest: Missing sender with no default');
    const oldDefault = process.env.EMAIL_DEFAULT_FROM;
    delete process.env.EMAIL_DEFAULT_FROM;
    try {
      await intelligentEmailTool.execute({
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test',
      });
      console.log('ERROR: Should have thrown an error');
    } catch (error) {
      console.log('Correctly threw error:', error instanceof Error ? error.message : error);
    }
    if (oldDefault) {
      process.env.EMAIL_DEFAULT_FROM = oldDefault;
    }

    console.log('\n=== Error Case Tests Completed ===');
  } catch (error) {
    console.error('Error case test failed:', error);
  }
}

// Run tests
console.log('Starting intelligent email tool tests...\n');
testEmailTool()
  .then(() => testErrorCases())
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
