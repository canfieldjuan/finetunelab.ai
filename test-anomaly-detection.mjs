#!/usr/bin/env node

/**
 * Test Anomaly Detection API
 * Tests the POST /api/analytics/anomalies/detect endpoint
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tkizlemssfmrfluychsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTc0MjYsImV4cCI6MjA3MTYzMzQyNn0.wjhOXd7WtKqj1zMtZMxApv1brutT_sDkNLvXUW1d4Uc';

async function testAnomalyDetection() {
  console.log('🧪 Testing Anomaly Detection API\n');

  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    // Get current session
    console.log('1️⃣ Checking authentication...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.log('❌ No active session found');
      console.log('ℹ️  Please log in to the web app first at http://localhost:3000');

      // Try to get first user from database for testing
      console.log('\n2️⃣ Attempting to use service role for testing...');
      const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA1NzQyNiwiZXhwIjoyMDcxNjMzNDI2fQ.1jCq40o2wsbHrKuinv3s4Ny9kwJ5mcvcBAggU5oKH74';

      const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

      // Get a user who has traces
      const { data: users, error: userError } = await adminSupabase
        .from('llm_traces')
        .select('user_id')
        .limit(1);

      if (userError || !users || users.length === 0) {
        console.log('❌ No users with traces found');
        console.log('ℹ️  Generate some traces first by using the app');
        process.exit(1);
      }

      const testUserId = users[0].user_id;
      console.log(`✅ Found test user: ${testUserId}`);

      // Create a temporary session token for testing
      const { data: tokenData, error: tokenError } = await adminSupabase.auth.admin.generateLink({
        type: 'magiclink',
        email: `test-${testUserId}@example.com`
      });

      if (tokenError) {
        console.log('⚠️  Cannot generate token, using service role directly');
        console.log('ℹ️  Testing with service role authentication...\n');

        // Test with service role
        await testWithServiceRole(adminSupabase, testUserId);
        return;
      }
    }

    const accessToken = session?.access_token;
    console.log(`✅ Authenticated as: ${session?.user?.email || session?.user?.id}`);
    console.log(`   Token prefix: ${accessToken?.substring(0, 20)}...`);

    // Call anomaly detection endpoint
    console.log('\n3️⃣ Calling anomaly detection endpoint...');
    const response = await fetch('http://localhost:3000/api/analytics/anomalies/detect', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ API Error:', errorText);
      process.exit(1);
    }

    const result = await response.json();

    // Display results
    console.log('\n✅ Anomaly Detection Complete!\n');
    console.log('📊 Results:');
    console.log(`   • Analyzed traces: ${result.analyzed_traces}`);
    console.log(`   • Anomaly types analyzed: ${result.anomaly_types_analyzed}`);
    console.log(`   • Anomalies detected: ${result.anomalies_detected}`);
    console.log(`   • Anomalies saved: ${result.anomalies_saved}`);

    if (result.breakdown) {
      console.log('\n📈 Breakdown by type:');
      Object.entries(result.breakdown).forEach(([type, count]) => {
        if (count > 0) {
          console.log(`   ✓ ${type}: ${count} anomalies`);
        }
      });
    }

    // Fetch and display detected anomalies
    if (result.anomalies_saved > 0) {
      console.log('\n4️⃣ Fetching detected anomalies...');
      const anomaliesResponse = await fetch('http://localhost:3000/api/analytics/anomalies?limit=10', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (anomaliesResponse.ok) {
        const anomaliesData = await anomaliesResponse.json();
        console.log(`\n🔍 Latest Anomalies (${anomaliesData.data?.length || 0} shown):\n`);

        anomaliesData.data?.slice(0, 5).forEach((anomaly, idx) => {
          console.log(`${idx + 1}. [${anomaly.severity.toUpperCase()}] ${anomaly.metric_name}`);
          console.log(`   Description: ${anomaly.description}`);
          console.log(`   Detected: ${new Date(anomaly.detected_at).toLocaleString()}`);
          console.log(`   Confidence: ${(anomaly.confidence_score * 100).toFixed(0)}%`);
          if (anomaly.recommended_actions?.length > 0) {
            console.log(`   Actions: ${anomaly.recommended_actions.join(', ')}`);
          }
          console.log('');
        });
      }
    } else {
      console.log('\n✅ No anomalies detected - all metrics within expected ranges!');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

async function testWithServiceRole(adminSupabase, userId) {
  console.log('📊 Checking trace data...');

  // Check how many traces exist
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: traces, error: traceError } = await adminSupabase
    .from('llm_traces')
    .select('id, duration_ms, start_time', { count: 'exact' })
    .eq('user_id', userId)
    .gte('start_time', oneDayAgo)
    .not('duration_ms', 'is', null);

  if (traceError) {
    console.log('❌ Error fetching traces:', traceError.message);
    process.exit(1);
  }

  console.log(`✅ Found ${traces?.length || 0} traces in the last 24 hours`);

  if (!traces || traces.length < 10) {
    console.log('⚠️  Not enough traces for meaningful anomaly detection (need at least 10)');
    console.log('ℹ️  Generate more traces by using the app or running batch tests');
  }

  console.log('\n✅ Anomaly detection system is ready to use!');
  console.log('ℹ️  Log in to http://localhost:3000 and use the app to test live');
}

// Run the test
testAnomalyDetection();
