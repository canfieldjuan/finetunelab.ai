/**
 * Email Analysis Tool - Manual Test Script
 * Tests AI-powered email analysis features
 * 
 * Run with: npx tsx lib/tools/intelligent_email/test-analysis.ts
 * 
 * Requirements:
 * - Set OPENAI_API_KEY environment variable
 */

import emailAnalysisTool from './analysis.tool';

async function testEmailAnalysis() {
  console.log('=== Email Analysis Tool - Phase 2 Tests ===\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY environment variable not set');
    console.log('Set it with: export OPENAI_API_KEY=sk_your_key_here');
    process.exit(1);
  }

  try {
    // Test 1: Summarize email thread
    console.log('Test 1: Email thread summarization');
    const testThread = {
      subject: 'Q4 Project Planning',
      messages: [
        {
          from: 'alice@company.com',
          to: ['team@company.com'],
          subject: 'Q4 Project Planning',
          body: 'Hi team, I wanted to start planning for Q4. We need to finalize our roadmap by end of month. Can we schedule a meeting next week?',
          date: '2025-10-20T10:00:00Z',
        },
        {
          from: 'bob@company.com',
          to: ['team@company.com'],
          subject: 'Re: Q4 Project Planning',
          body: 'Good idea Alice. I am available Tuesday or Wednesday afternoon. Also, we should review the budget constraints before the meeting.',
          date: '2025-10-20T14:30:00Z',
        },
        {
          from: 'carol@company.com',
          to: ['team@company.com'],
          subject: 'Re: Q4 Project Planning',
          body: 'Tuesday works for me. I will prepare the current project status report. Should we invite the stakeholders too?',
          date: '2025-10-21T09:15:00Z',
        },
      ],
    };

    const result1 = await emailAnalysisTool.execute({
      action: 'summarize_thread',
      emailThread: JSON.stringify(testThread),
    });

    console.log('Result:', JSON.stringify(result1, null, 2));
    console.log('\n');

    // Test 2: Smart reply suggestions
    console.log('Test 2: Smart reply suggestions');
    const testEmail = {
      from: 'customer@example.com',
      to: ['support@company.com'],
      subject: 'Question about invoice #12345',
      body: 'Hello, I received invoice #12345 but I think there might be an error. The amount seems higher than expected. Can you please review and let me know? Thanks!',
    };

    const result2 = await emailAnalysisTool.execute({
      action: 'suggest_replies',
      email: JSON.stringify(testEmail),
    });

    console.log('Result:', JSON.stringify(result2, null, 2));
    console.log('\n');

    // Test 3: Summarize longer thread
    console.log('Test 3: Complex thread with urgent sentiment');
    const urgentThread = {
      subject: 'URGENT: Production Issue',
      messages: [
        {
          from: 'ops@company.com',
          to: ['dev-team@company.com'],
          subject: 'URGENT: Production Issue',
          body: 'We are experiencing a critical issue in production. Users are reporting errors when trying to checkout. This needs immediate attention!',
          date: '2025-10-24T15:00:00Z',
        },
        {
          from: 'dev@company.com',
          to: ['ops@company.com'],
          subject: 'Re: URGENT: Production Issue',
          body: 'Looking into it now. Can you send me the error logs? Also, how many users are affected?',
          date: '2025-10-24T15:05:00Z',
        },
        {
          from: 'ops@company.com',
          to: ['dev@company.com'],
          subject: 'Re: URGENT: Production Issue',
          body: 'Logs attached. Approximately 50 users in the last 10 minutes. Revenue impact is significant.',
          date: '2025-10-24T15:08:00Z',
        },
      ],
    };

    const result3 = await emailAnalysisTool.execute({
      action: 'summarize_thread',
      emailThread: JSON.stringify(urgentThread),
    });

    console.log('Result:', JSON.stringify(result3, null, 2));
    console.log('\n');

    console.log('=== All Tests Completed Successfully ===');

  } catch (error) {
    console.error('Test failed with error:');
    console.error(error);
    process.exit(1);
  }
}

async function testErrorCases() {
  console.log('\n=== Testing Error Cases ===\n');

  try {
    // Test: Missing action
    console.log('Test: Missing action parameter');
    try {
      await emailAnalysisTool.execute({});
      console.log('ERROR: Should have thrown an error');
    } catch (error) {
      console.log('Correctly threw error:', error instanceof Error ? error.message : error);
    }

    // Test: Invalid JSON
    console.log('\nTest: Invalid JSON for email thread');
    try {
      await emailAnalysisTool.execute({
        action: 'summarize_thread',
        emailThread: 'not valid json',
      });
      console.log('ERROR: Should have thrown an error');
    } catch (error) {
      console.log('Correctly threw error:', error instanceof Error ? error.message : error);
    }

    // Test: Missing required fields
    console.log('\nTest: Missing messages in thread');
    try {
      await emailAnalysisTool.execute({
        action: 'summarize_thread',
        emailThread: JSON.stringify({ subject: 'Test' }),
      });
      console.log('ERROR: Should have thrown an error');
    } catch (error) {
      console.log('Correctly threw error:', error instanceof Error ? error.message : error);
    }

    console.log('\n=== Error Case Tests Completed ===');
  } catch (error) {
    console.error('Error case test failed:', error);
  }
}

// Run tests
console.log('Starting email analysis tool tests...\n');
testEmailAnalysis()
  .then(() => testErrorCases())
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
