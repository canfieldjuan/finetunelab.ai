#!/usr/bin/env node

/**
 * Test the analytics assistant's ability to use the traces tool for NLP-based analysis
 */

// Hardcoded credentials for testing
const supabaseUrl = 'https://tkizlemssfmrfluychsn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA1NzQyNiwiZXhwIjoyMDcxNjMzNDI2fQ.1jCq40o2wsbHrKuinv3s4Ny9kwJ5mcvcBAggU5oKH74';
const authToken = 'eyJhbGciOiJIUzI1NiIsImtpZCI6Ik5oaUNDcmgrM05TaCtHUGYiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3RraXpsZW1zc2ZtcmZsdXljaHNuLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzOGM4NTcwNy0xZmM1LTQwYzYtODRiZS1jMDE3YjNiOGU3NTAiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYwODI0NDAwLCJpYXQiOjE3NjA4MjA4MDAsImVtYWlsIjoiY2FuZmllbGRqdWFuMjRAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6ImNhbmZpZWxkanVhbjI0QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmaXJzdF9uYW1lIjoianVhbiIsImxhc3RfbmFtZSI6ImNhbmZpZWxkIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiIzOGM4NTcwNy0xZmM1LTQwYzYtODRiZS1jMDE3YjNiOGU3NTAifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc2MDgyMDgwMH1dLCJzZXNzaW9uX2lkIjoiODdiMzFlZGUtODczYS00NGQyLThhMTUtZjUzNWQ2MDE3NjM0IiwiaXNfYW5vbnltb3VzIjpmYWxzZX0._hMwRa3ntZ4xhHaYiUOwG5k0rFBo0f0V8ooHqCPmbx4';

async function testTracesAssistant() {
  console.log('🧪 Testing Analytics Assistant - Traces Tool\n');
  
  // Test 1: Ask assistant to list trace operations
  console.log('Test 1: Ask assistant about trace operations');
  console.log('Query: "What trace analysis operations can you perform?"\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/analytics/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: 'What trace analysis operations can you perform? List all the operations available in the get_traces tool.'
        }],
        sessionId: 'test-traces-' + Date.now()
      })
    });

    if (!response.ok) {
      console.error('❌ API request failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ Assistant Response:');
    console.log(data.content || data.message || JSON.stringify(data, null, 2));
    console.log('\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return;
  }

  // Test 2: Ask assistant to explain trace comparison
  console.log('Test 2: Ask assistant about comparing traces');
  console.log('Query: "How can I compare multiple traces to find performance differences?"\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/analytics/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: 'How can I compare multiple traces to find performance differences? What comparison modes are available?'
        }],
        sessionId: 'test-traces-' + Date.now()
      })
    });

    if (!response.ok) {
      console.error('❌ API request failed:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    console.log('✅ Assistant Response:');
    console.log(data.content || data.message || JSON.stringify(data, null, 2));
    console.log('\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('🎉 Tests Complete!\n');
}

testTracesAssistant().catch(console.error);
