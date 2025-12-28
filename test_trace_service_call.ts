
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

console.log(`Testing fetch to ${baseUrl}/api/analytics/traces`);
console.log(`Using key: ${serviceKey?.substring(0, 10)}...`);

async function testFetch() {
  try {
    const response = await fetch(`${baseUrl}/api/analytics/traces`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trace_id: `test_fetch_${Date.now()}`,
        span_id: `test_span_${Date.now()}`,
        span_name: 'test_fetch',
        operation_type: 'test',
        user_id: '38c85707-1fc5-40c6-84be-c017b3b8e750',
        start_time: new Date().toISOString(),
        status: 'completed'
      }),
    });

    console.log(`Response status: ${response.status}`);
    const text = await response.text();
    console.log(`Response body: ${text}`);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testFetch();
