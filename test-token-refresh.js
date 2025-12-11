/**
 * Test script for token refresh endpoint
 *
 * Usage:
 * 1. Make sure Next.js is running (npm run dev)
 * 2. Get your access token from browser:
 *    - Open DevTools → Application → Local Storage
 *    - Find supabase.auth.token
 *    - Copy the access_token value
 * 3. Run: node test-token-refresh.js YOUR_TOKEN_HERE
 */

const TOKEN = process.argv[2];

if (!TOKEN) {
  console.error('❌ Error: Please provide a token as argument');
  console.log('\nUsage: node test-token-refresh.js YOUR_TOKEN_HERE');
  console.log('\nTo get your token:');
  console.log('1. Open browser DevTools → Application → Local Storage');
  console.log('2. Find supabase.auth.token');
  console.log('3. Copy the access_token value');
  process.exit(1);
}

async function testTokenRefresh() {
  console.log('[Test] Testing token refresh endpoint...');
  console.log('[Test] Token preview:', TOKEN.substring(0, 20) + '...');

  try {
    const response = await fetch('http://localhost:3000/api/training/refresh-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[Test] Response status:', response.status);

    const data = await response.json();
    console.log('[Test] Response data:', JSON.stringify(data, null, 2));

    if (response.status === 200) {
      console.log('\n✅ SUCCESS! Token refresh endpoint is working');
      console.log('New token preview:', data.access_token?.substring(0, 20) + '...');
      console.log('Expires at:', new Date(data.expires_at * 1000).toISOString());
      console.log('Expires in:', data.expires_in, 'seconds');
    } else {
      console.log('\n❌ FAILED! Unexpected status code');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.log('\nMake sure:');
    console.log('1. Next.js dev server is running (npm run dev)');
    console.log('2. Server is accessible at http://localhost:3000');
    console.log('3. Token is valid and from an active session');
  }
}

testTokenRefresh();
