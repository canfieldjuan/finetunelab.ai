/**
 * Email Provider System - Manual Test Script
 * Tests provider abstraction and registry
 * 
 * Run with: npx tsx lib/tools/intelligent_email/test-providers.ts
 * 
 * Requirements:
 * - Set RESEND_API_KEY for Resend provider tests
 */

import { emailProviderRegistry } from './provider.registry';
import { resendProvider } from './resend.provider';
import { smtpProvider } from './smtp.provider';

async function testProviderRegistry() {
  console.log('=== Email Provider Registry - Phase 3 Tests ===\n');

  // Test 1: List registered providers
  console.log('Test 1: List all registered providers');
  const allProviders = emailProviderRegistry.getAllProviders();
  console.log('Total providers:', allProviders.length);
  allProviders.forEach(p => {
    console.log(`  - ${p.name}: configured=${p.isConfigured()}`);
  });
  console.log('\n');

  // Test 2: Get configured providers only
  console.log('Test 2: List configured providers');
  const configuredProviders = emailProviderRegistry.getConfiguredProviders();
  console.log('Configured providers:', configuredProviders.length);
  configuredProviders.forEach(p => {
    console.log(`  - ${p.name}`);
  });
  console.log('\n');

  // Test 3: Provider capabilities
  console.log('Test 3: Check provider capabilities');
  console.log('Resend capabilities:');
  const resendCaps = resendProvider.getCapabilities();
  console.log(JSON.stringify(resendCaps, null, 2));
  console.log('\nSMTP capabilities:');
  const smtpCaps = smtpProvider.getCapabilities();
  console.log(JSON.stringify(smtpCaps, null, 2));
  console.log('\n');

  // Test 4: Get provider by name
  console.log('Test 4: Get specific provider');
  const provider = emailProviderRegistry.getProvider('resend');
  if (provider) {
    console.log('Retrieved provider:', provider.name);
    console.log('Is configured:', provider.isConfigured());
  } else {
    console.log('Provider not found');
  }
  console.log('\n');

  // Test 5: Register additional provider
  console.log('Test 5: Register SMTP provider');
  emailProviderRegistry.register(smtpProvider);
  const allProvidersAfter = emailProviderRegistry.getAllProviders();
  console.log('Total providers after registration:', allProvidersAfter.length);
  console.log('\n');

  // Test 6: Try to send with stub provider
  console.log('Test 6: Attempt to send with SMTP (stub)');
  try {
    const result = await emailProviderRegistry.sendEmail({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Test',
      body: 'Test body',
    }, 'smtp');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('Error:', error instanceof Error ? error.message : error);
  }
  console.log('\n');

  console.log('=== All Provider Registry Tests Completed ===');
}

async function testProviderSelection() {
  console.log('\n=== Provider Selection Tests ===\n');

  // Test: Default provider
  console.log('Test: Send with default provider');
  if (!process.env.RESEND_API_KEY) {
    console.log('SKIPPED: RESEND_API_KEY not set');
  } else if (!process.env.TEST_EMAIL_RECIPIENT) {
    console.log('SKIPPED: TEST_EMAIL_RECIPIENT not set');
  } else {
    try {
      const result = await emailProviderRegistry.sendEmail({
        from: process.env.EMAIL_DEFAULT_FROM || 'test@example.com',
        to: process.env.TEST_EMAIL_RECIPIENT,
        subject: 'Provider Test - Default',
        body: 'Testing default provider selection',
      });
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error:', error);
    }
  }

  console.log('\n=== Provider Selection Tests Completed ===');
}

async function testExtensibility() {
  console.log('\n=== Extensibility Tests ===\n');

  console.log('Test: Provider interface implementation');
  console.log('All providers implement EmailProvider interface:');
  
  const providers = emailProviderRegistry.getAllProviders();
  providers.forEach(provider => {
    const hasRequired = 
      typeof provider.name === 'string' &&
      typeof provider.isConfigured === 'function' &&
      typeof provider.sendEmail === 'function' &&
      typeof provider.getCapabilities === 'function';
    
    console.log(`  ${provider.name}: ${hasRequired ? 'VALID' : 'INVALID'}`);
  });

  console.log('\n=== Extensibility Tests Completed ===');
}

// Run all tests
console.log('Starting provider system tests...\n');
testProviderRegistry()
  .then(() => testProviderSelection())
  .then(() => testExtensibility())
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
