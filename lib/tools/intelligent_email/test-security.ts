// Intelligent Email Tool - Security Tests
// Phase 4.3: Comprehensive tests for PII, spam, and sentiment analysis
// Date: October 24, 2025

import { emailSecurityService } from './security.service';
import { emailSecurityTool } from './security.tool';
import type { EmailMessage } from './types';

// Type for tool execution results
interface SecurityToolResult {
  success: boolean;
  message: string;
  [key: string]: unknown;
}

/**
 * Test email messages with various security scenarios
 */
const testEmails: Record<string, EmailMessage> = {
  // Clean email - no security issues
  clean: {
    from: 'alice@company.com',
    to: ['bob@company.com'],
    subject: 'Project Update',
    body: 'Hi Bob, the project is going well. Let me know if you need anything.',
  },

  // PII detection tests
  piiEmail: {
    from: 'user@example.com',
    to: ['admin@company.com'],
    subject: 'User Registration',
    body: `
      New user registration:
      Name: John Smith
      Email: john.smith@example.com
      Phone: +1 (555) 123-4567
      SSN: 123-45-6789
      Credit Card: 4532-1234-5678-9012
    `,
  },

  piiMinimal: {
    from: 'contact@business.com',
    to: ['sales@company.com'],
    subject: 'Contact Information',
    body: 'Please reach me at contact@business.com or call (555) 987-6543',
  },

  // Spam/phishing tests
  phishing: {
    from: 'security@paypa1.com', // Note: fake PayPal domain
    to: ['victim@example.com'],
    subject: 'URGENT: Verify your account immediately!',
    body: `
      Dear valued customer,
      
      Your account has been SUSPENDED due to suspicious activity!
      Click here immediately to verify your account or it will be PERMANENTLY CLOSED!
      
      Verify now: http://paypa1-verify.suspicious.com/login
      
      Enter your password, SSN, and credit card to restore access.
      
      Act fast - you have 24 hours!
    `,
  },

  spam: {
    from: 'offers@promotional-spam.com',
    to: ['user@example.com'],
    subject: 'YOU WON $1,000,000!!!',
    body: `
      CONGRATULATIONS!!!
      
      You've been selected as our LUCKY WINNER!
      Claim your $1,000,000 prize NOW!
      
      Click here: http://totally-legit-prizes.scam
      
      This is a LIMITED TIME offer! ACT NOW!!!
    `,
  },

  legitimate: {
    from: 'support@github.com',
    to: ['developer@company.com'],
    subject: 'Pull request merged',
    body: 'Your pull request #1234 has been successfully merged into main.',
  },

  // Sentiment analysis tests
  veryPositive: {
    from: 'customer@example.com',
    to: ['support@company.com'],
    subject: 'Amazing Service!',
    body: `
      I am absolutely thrilled with your product! The customer service was
      exceptional, and the quality exceeded all my expectations. I'm so happy
      and grateful for the wonderful experience. Thank you so much!
    `,
  },

  positive: {
    from: 'colleague@company.com',
    to: ['team@company.com'],
    subject: 'Great work team',
    body: 'Nice job on the presentation today. The client seemed pleased.',
  },

  neutral: {
    from: 'admin@company.com',
    to: ['all@company.com'],
    subject: 'Office hours update',
    body: 'Please note that office hours will change to 9-5 starting Monday.',
  },

  negative: {
    from: 'customer@example.com',
    to: ['support@company.com'],
    subject: 'Issue with order',
    body: `
      I'm disappointed with my recent purchase. The product arrived late
      and doesn't match the description. I expected better quality.
    `,
  },

  veryNegative: {
    from: 'angry-customer@example.com',
    to: ['complaints@company.com'],
    subject: 'TERRIBLE SERVICE',
    body: `
      This is absolutely UNACCEPTABLE! I am furious about the way I was treated.
      Your company is the WORST I've ever dealt with. I demand a full refund
      immediately or I will report you to the authorities and leave negative
      reviews everywhere!
    `,
  },

  urgent: {
    from: 'boss@company.com',
    to: ['employee@company.com'],
    subject: 'URGENT: Client presentation TODAY',
    body: `
      The client presentation has been moved to 2 PM today. We need the slides
      ready ASAP. This is critical - please prioritize this immediately.
    `,
  },

  aggressive: {
    from: 'competitor@rival.com',
    to: ['sales@company.com'],
    subject: 'Your pricing is ridiculous',
    body: `
      I can't believe you're charging that much. Our prices are way better
      and our product is superior. You should be ashamed of ripping off customers.
    `,
  },

  friendly: {
    from: 'coworker@company.com',
    to: ['team@company.com'],
    subject: 'Coffee break? ☕',
    body: `
      Hey everyone! Want to grab coffee at 3? Would love to catch up and
      hear how everyone's weekend was. Let me know! 😊
    `,
  },
};

/**
 * Run all security tests
 */
async function runAllTests() {
  console.log('\n========================================');
  console.log('EMAIL SECURITY SERVICE - COMPREHENSIVE TESTS');
  console.log('========================================\n');

  // Test 1: PII Detection
  console.log('\n--- TEST 1: PII DETECTION ---');
  await testPIIDetection();

  // Test 2: Spam/Phishing Detection
  console.log('\n--- TEST 2: SPAM/PHISHING DETECTION ---');
  await testSpamPhishingDetection();

  // Test 3: Sentiment Analysis
  console.log('\n--- TEST 3: SENTIMENT ANALYSIS ---');
  await testSentimentAnalysis();

  // Test 4: Tool Integration
  console.log('\n--- TEST 4: TOOL INTEGRATION ---');
  await testToolIntegration();

  console.log('\n========================================');
  console.log('ALL TESTS COMPLETE');
  console.log('========================================\n');
}

/**
 * Test PII detection functionality
 */
async function testPIIDetection() {
  const tests = [
    { name: 'Clean Email (no PII)', email: testEmails.clean, expectedPII: false },
    { name: 'PII-Heavy Email', email: testEmails.piiEmail, expectedPII: true },
    { name: 'Minimal PII Email', email: testEmails.piiMinimal, expectedPII: true },
  ];

  for (const test of tests) {
    console.log(`\nTesting: ${test.name}`);
    const result = await emailSecurityService.detectPII(test.email);
    
    console.log(`✓ Has PII: ${result.hasPII}`);
    console.log(`✓ Risk Level: ${result.riskLevel}`);
    console.log(`✓ PII Types: ${result.piiTypes.join(', ') || 'none'}`);
    console.log(`✓ Detected Items: ${result.detectedItems.length}`);
    
    if (result.detectedItems.length > 0) {
      console.log('  Items:');
      result.detectedItems.forEach(item => {
        console.log(`    - ${item.type}: ${item.masked} (${item.location})`);
      });
    }
    
    console.log('  Recommendations:');
    result.recommendations.forEach(rec => console.log(`    - ${rec}`));
    
    if (result.hasPII !== test.expectedPII) {
      console.warn(`⚠️  WARNING: Expected hasPII=${test.expectedPII}, got ${result.hasPII}`);
    }
  }
}

/**
 * Test spam/phishing detection functionality
 */
async function testSpamPhishingDetection() {
  const tests = [
    { name: 'Clean Email', email: testEmails.clean, expectedSafe: true },
    { name: 'Phishing Email', email: testEmails.phishing, expectedSafe: false },
    { name: 'Spam Email', email: testEmails.spam, expectedSafe: false },
    { name: 'Legitimate Email', email: testEmails.legitimate, expectedSafe: true },
  ];

  for (const test of tests) {
    console.log(`\nTesting: ${test.name}`);
    const result = await emailSecurityService.detectSpamPhishing(test.email);
    
    console.log(`✓ Is Spam: ${result.isSpam}`);
    console.log(`✓ Is Phishing: ${result.isPhishing}`);
    console.log(`✓ Risk Level: ${result.riskLevel}`);
    console.log(`✓ Confidence: ${result.confidenceScore}%`);
    
    if (result.indicators.length > 0) {
      console.log('  Indicators:');
      result.indicators.forEach(ind => console.log(`    - ${ind}`));
    }
    
    console.log('  Recommendations:');
    result.recommendations.forEach(rec => console.log(`    - ${rec}`));
    
    const isSafe = result.riskLevel === 'safe';
    if (isSafe !== test.expectedSafe) {
      console.warn(`⚠️  WARNING: Expected safe=${test.expectedSafe}, got ${isSafe}`);
    }
  }
}

/**
 * Test sentiment analysis functionality
 */
async function testSentimentAnalysis() {
  const tests = [
    { name: 'Very Positive', email: testEmails.veryPositive, expectedSentiment: 'very_positive' },
    { name: 'Positive', email: testEmails.positive, expectedSentiment: 'positive' },
    { name: 'Neutral', email: testEmails.neutral, expectedSentiment: 'neutral' },
    { name: 'Negative', email: testEmails.negative, expectedSentiment: 'negative' },
    { name: 'Very Negative', email: testEmails.veryNegative, expectedSentiment: 'very_negative' },
    { name: 'Urgent Tone', email: testEmails.urgent, expectedTone: 'urgent' },
    { name: 'Aggressive Tone', email: testEmails.aggressive, expectedTone: 'aggressive' },
    { name: 'Friendly Tone', email: testEmails.friendly, expectedTone: 'friendly' },
  ];

  for (const test of tests) {
    console.log(`\nTesting: ${test.name}`);
    const result = await emailSecurityService.analyzeSentiment(test.email);
    
    console.log(`✓ Sentiment: ${result.sentiment}`);
    console.log(`✓ Tone: ${result.tone}`);
    console.log(`✓ Confidence: ${result.confidenceScore}%`);
    
    if (result.emotions.length > 0) {
      console.log(`✓ Emotions: ${result.emotions.join(', ')}`);
    }
    
    if (result.keyPhrases.length > 0) {
      console.log('  Key Phrases:');
      result.keyPhrases.slice(0, 3).forEach(phrase => console.log(`    - "${phrase}"`));
    }
  }
}

/**
 * Test tool integration
 */
async function testToolIntegration() {
  console.log('\nTesting security tool handler...');
  
  // Test PII detection via tool
  console.log('\n1. PII Detection via tool:');
  const piiResult = await emailSecurityTool.execute({
    action: 'detect_pii',
    email: testEmails.piiEmail,
  }) as SecurityToolResult;
  console.log(`✓ Success: ${piiResult.success}`);
  console.log(`✓ Message: ${piiResult.message}`);
  
  // Test spam detection via tool
  console.log('\n2. Spam Detection via tool:');
  const spamResult = await emailSecurityTool.execute({
    action: 'detect_spam',
    email: testEmails.phishing,
  }) as SecurityToolResult;
  console.log(`✓ Success: ${spamResult.success}`);
  console.log(`✓ Message: ${spamResult.message}`);
  
  // Test sentiment analysis via tool
  console.log('\n3. Sentiment Analysis via tool:');
  const sentimentResult = await emailSecurityTool.execute({
    action: 'analyze_sentiment',
    email: testEmails.veryPositive,
  }) as SecurityToolResult;
  console.log(`✓ Success: ${sentimentResult.success}`);
  console.log(`✓ Message: ${sentimentResult.message}`);
}

/**
 * Run specific test by name
 */
export async function runSecurityTest(testName?: string) {
  if (!testName) {
    await runAllTests();
    return;
  }

  switch (testName) {
    case 'pii':
      await testPIIDetection();
      break;
    case 'spam':
      await testSpamPhishingDetection();
      break;
    case 'sentiment':
      await testSentimentAnalysis();
      break;
    case 'tool':
      await testToolIntegration();
      break;
    default:
      console.log(`Unknown test: ${testName}`);
      console.log('Available tests: pii, spam, sentiment, tool');
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests, testEmails };
