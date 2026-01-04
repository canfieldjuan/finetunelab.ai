#!/usr/bin/env node

/**
 * Test if anomaly-detection service can be imported
 */

console.log('Testing service import...\n');

try {
  // Try to import the service (this won't work directly in Node ESM)
  // But we can test the API endpoint structure

  console.log('✅ If you see this, the script runs');

  // Simulate what the API does
  const testData = [
    { timestamp: '2024-01-01T00:00:00Z', value: 100 },
    { timestamp: '2024-01-01T00:01:00Z', value: 110 },
    { timestamp: '2024-01-01T00:02:00Z', value: 105 },
    { timestamp: '2024-01-01T00:03:00Z', value: 500 }, // Anomaly
  ];

  console.log(`Test data points: ${testData.length}`);
  console.log(`Last value: ${testData[testData.length - 1].value} (should be anomaly)`);

  // Check environment
  console.log(`\nEnvironment check:`);
  console.log(`- NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing'}`);
  console.log(`- NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'}`);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log(`\n⚠️  Environment variables missing`);
    console.log(`This might cause the API to fail`);
  }

} catch (error) {
  console.error('❌ Error:', error.message);
}
