/**
 * Test Advanced Demo Export API
 * Tests all persona-based export formats
 * Usage: node BYOM-Demo-Test-Page/test-advanced-export.mjs [session_id]
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const BASE_URL = 'http://localhost:3000';

/**
 * Test single export
 */
async function testExport(sessionId, format, audience = null) {
  const audienceLabel = audience || 'N/A';
  const testName = `${format.toUpperCase()} - ${audienceLabel}`;

  let url = `${BASE_URL}/api/demo/v2/export/advanced?session_id=${sessionId}&format=${format}`;
  if (audience) {
    url += `&audience=${audience}`;
  }

  console.log(`\n🧪 Testing: ${testName}`);
  console.log(`   URL: ${url}`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      console.error(`   ❌ FAILED: ${response.status} ${response.statusText}`);
      console.error(`   Response: ${text.substring(0, 200)}...`);
      return false;
    }

    const contentType = response.headers.get('content-type');
    const contentDisposition = response.headers.get('content-disposition');

    console.log(`   ✅ SUCCESS: ${response.status}`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Content-Disposition: ${contentDisposition}`);

    // Save file for manual inspection
    const buffer = await response.arrayBuffer();
    const filename = `test-output-${format}-${audienceLabel}.${format}`;
    writeFileSync(filename, Buffer.from(buffer));
    console.log(`   📄 Saved to: ${filename}`);

    return true;
  } catch (error) {
    console.error(`   ❌ ERROR: ${error.message}`);
    return false;
  }
}

/**
 * Find or create a demo session for testing
 */
async function getTestSession() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Try to find an existing session with test data
  const { data: sessions, error } = await supabase
    .from('demo_model_configs')
    .select('session_id, model_name')
    .gt('expires_at', new Date().toISOString())
    .limit(1);

  if (error) {
    console.error('❌ Error querying sessions:', error);
    return null;
  }

  if (sessions && sessions.length > 0) {
    console.log('✅ Found existing demo session:');
    console.log(`   Session ID: ${sessions[0].session_id}`);
    console.log(`   Model: ${sessions[0].model_name || 'Unknown'}`);
    return sessions[0].session_id;
  }

  console.log('⚠️  No active demo sessions found');
  console.log('   Please run a batch test on the demo page first:');
  console.log('   http://localhost:3000/demo/test-model');
  return null;
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('         Advanced Demo Export API Test Suite              ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get session ID from args or database
  let sessionId = process.argv[2];

  if (!sessionId) {
    console.log('No session_id provided as argument, searching database...\n');
    sessionId = await getTestSession();

    if (!sessionId) {
      console.log('\n❌ Cannot run tests without a demo session.');
      console.log('   Usage: node test-advanced-export.mjs <session_id>');
      process.exit(1);
    }
  }

  console.log(`\n📋 Testing with session: ${sessionId}\n`);
  console.log('───────────────────────────────────────────────────────────');

  const results = {
    passed: 0,
    failed: 0,
  };

  // Test CSV (redirect)
  if (await testExport(sessionId, 'csv')) results.passed++;
  else results.failed++;

  // Test JSON (redirect)
  if (await testExport(sessionId, 'json')) results.passed++;
  else results.failed++;

  // Test HTML - Executive
  if (await testExport(sessionId, 'html', 'executive')) results.passed++;
  else results.failed++;

  // Test HTML - Engineering
  if (await testExport(sessionId, 'html', 'engineering')) results.passed++;
  else results.failed++;

  // Test HTML - Onboarding
  if (await testExport(sessionId, 'html', 'onboarding')) results.passed++;
  else results.failed++;

  // Test PDF - Executive
  if (await testExport(sessionId, 'pdf', 'executive')) results.passed++;
  else results.failed++;

  // Test PDF - Engineering
  if (await testExport(sessionId, 'pdf', 'engineering')) results.passed++;
  else results.failed++;

  // Test PDF - Onboarding
  if (await testExport(sessionId, 'pdf', 'onboarding')) results.passed++;
  else results.failed++;

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                     TEST RESULTS                          ');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   📊 Total:  ${results.passed + results.failed}`);

  if (results.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!\n');
    console.log('Next steps:');
    console.log('1. Review generated files in current directory');
    console.log('2. Open HTML files in browser to verify formatting');
    console.log('3. Open PDF files to verify persona-specific content');
    console.log('4. Test via UI at http://localhost:3000/demo/test-model');
  } else {
    console.log(`\n⚠️  ${results.failed} test(s) failed. Review errors above.\n`);
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

runTests().catch(console.error);
