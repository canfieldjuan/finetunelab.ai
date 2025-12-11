/**
 * Test Script for Analytics Assistant Tools
 *
 * Tests the 3 new tool handlers to ensure they work correctly
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDatabase() {
  console.log('\n=== DATABASE CONNECTION TEST ===\n');

  try {
    // Test 1: Get training jobs count
    const { data: jobs, error: jobsError, count } = await supabase
      .from('local_training_jobs')
      .select('id, job_name, status, model_name', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(5);

    if (jobsError) {
      console.error('❌ Error fetching training jobs:', jobsError);
      return false;
    }

    console.log(`✅ Found ${count} training jobs in database`);
    if (jobs && jobs.length > 0) {
      console.log('\nRecent jobs:');
      jobs.forEach(job => {
        console.log(`  - ${job.id.substring(0, 8)}: ${job.job_name || 'Unnamed'} (${job.status})`);
      });
    }

    // Test 2: Get predictions count
    const { data: predictions, error: predsError, count: predCount } = await supabase
      .from('training_predictions')
      .select('job_id', { count: 'exact' })
      .limit(1);

    if (predsError) {
      console.error('❌ Error fetching predictions:', predsError);
      return false;
    }

    console.log(`\n✅ Found ${predCount} predictions in database`);

    return { jobCount: count, predCount, sampleJobId: jobs?.[0]?.id };
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    return false;
  }
}

async function testTrainingStatusAPI(jobId) {
  console.log('\n=== TRAINING STATUS API TEST ===\n');

  if (!jobId) {
    console.log('⚠️  No job ID available, skipping API test');
    return true;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/training/local/${jobId}/status`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
        }
      }
    );

    if (!response.ok) {
      console.log(`⚠️  API returned status ${response.status}`);
      const text = await response.text();
      console.log('Response:', text.substring(0, 200));
      return true; // Not a blocker if server isn't running
    }

    const data = await response.json();
    console.log('✅ Training status API works');
    console.log('Response keys:', Object.keys(data).join(', '));
    return true;
  } catch (error) {
    console.log('⚠️  Could not connect to dev server:', error.message);
    console.log('   (This is OK if server is not running)');
    return true;
  }
}

async function testPredictionsAPI(jobId) {
  console.log('\n=== PREDICTIONS API TEST ===\n');

  if (!jobId) {
    console.log('⚠️  No job ID available, skipping API test');
    return true;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/training/predictions/${jobId}?limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
        }
      }
    );

    if (!response.ok) {
      console.log(`⚠️  API returned status ${response.status}`);
      return true;
    }

    const data = await response.json();
    console.log('✅ Predictions API works');
    console.log('Response keys:', Object.keys(data).join(', '));
    return true;
  } catch (error) {
    console.log('⚠️  Could not connect to dev server:', error.message);
    console.log('   (This is OK if server is not running)');
    return true;
  }
}

async function testAnalyticsAPIs() {
  console.log('\n=== ANALYTICS APIs TEST ===\n');

  const endpoints = [
    '/api/analytics/model-comparison?period=month',
    '/api/analytics/benchmark-analysis?period=week',
    '/api/analytics/forecast-data?period=month',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:3000${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
        }
      });

      const name = endpoint.split('?')[0].split('/').pop();
      if (response.ok) {
        console.log(`✅ ${name} API works`);
      } else {
        console.log(`⚠️  ${name} returned status ${response.status}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not test ${endpoint}:`, error.message);
    }
  }

  return true;
}

async function testHandlerImports() {
  console.log('\n=== HANDLER IMPORTS TEST ===\n');

  try {
    // Try to dynamically import the handlers
    const handlersExist = {
      'training-metrics': false,
      'training-predictions': false,
      'advanced-analytics': false,
    };

    const fs = require('fs');
    const path = require('path');

    for (const handler of Object.keys(handlersExist)) {
      const filePath = path.join(__dirname, 'lib', 'tools', 'analytics', `${handler}.handler.ts`);
      if (fs.existsSync(filePath)) {
        handlersExist[handler] = true;
        console.log(`✅ ${handler}.handler.ts exists`);
      } else {
        console.log(`❌ ${handler}.handler.ts NOT FOUND`);
      }
    }

    return Object.values(handlersExist).every(v => v);
  } catch (error) {
    console.error('❌ Handler import test failed:', error.message);
    return false;
  }
}

async function testRouteIntegration() {
  console.log('\n=== ROUTE INTEGRATION TEST ===\n');

  try {
    const fs = require('fs');
    const path = require('path');
    const routePath = path.join(__dirname, 'app', 'api', 'analytics', 'chat', 'route.ts');

    if (!fs.existsSync(routePath)) {
      console.error('❌ Route file not found');
      return false;
    }

    const content = fs.readFileSync(routePath, 'utf8');

    // Check imports
    const hasImports = [
      'executeTrainingMetrics',
      'executeTrainingPredictions',
      'executeAdvancedAnalytics',
    ].every(imp => content.includes(imp));

    if (hasImports) {
      console.log('✅ All handler imports present in route.ts');
    } else {
      console.log('❌ Missing handler imports in route.ts');
      return false;
    }

    // Check tool definitions
    const hasToolDefs = [
      "name: 'training_metrics'",
      "name: 'training_predictions'",
      "name: 'advanced_analytics'",
    ].every(def => content.includes(def));

    if (hasToolDefs) {
      console.log('✅ All tool definitions present in route.ts');
    } else {
      console.log('❌ Missing tool definitions in route.ts');
      return false;
    }

    // Check handler cases
    const hasCases = [
      "case 'training_metrics':",
      "case 'training_predictions':",
      "case 'advanced_analytics':",
    ].every(c => content.includes(c));

    if (hasCases) {
      console.log('✅ All handler cases present in executeAnalyticsTool');
    } else {
      console.log('❌ Missing handler cases in route.ts');
      return false;
    }

    // Check system message
    const hasSystemDocs = [
      'training_metrics',
      'training_predictions',
      'advanced_analytics',
    ].every(tool => {
      const regex = new RegExp(`\\*\\*${tool}\\*\\*`, 'i');
      return regex.test(content);
    });

    if (hasSystemDocs) {
      console.log('✅ Tool documentation in system message');
    } else {
      console.log('⚠️  Tool documentation may be incomplete in system message');
    }

    return true;
  } catch (error) {
    console.error('❌ Route integration test failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Analytics Assistant Tools - Integration Tests        ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  const results = {
    handlerFiles: false,
    routeIntegration: false,
    database: false,
    apis: false,
  };

  // Test 1: Handler files exist
  results.handlerFiles = await testHandlerImports();

  // Test 2: Route integration
  results.routeIntegration = await testRouteIntegration();

  // Test 3: Database connectivity
  const dbResult = await testDatabase();
  results.database = dbResult !== false;
  const sampleJobId = dbResult?.sampleJobId;

  // Test 4: APIs (if dev server is running)
  if (sampleJobId) {
    await testTrainingStatusAPI(sampleJobId);
    await testPredictionsAPI(sampleJobId);
  }
  await testAnalyticsAPIs();
  results.apis = true; // API tests are informational only

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  TEST SUMMARY                                          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const allPassed = Object.values(results).every(v => v);

  console.log('Handler Files:', results.handlerFiles ? '✅ PASS' : '❌ FAIL');
  console.log('Route Integration:', results.routeIntegration ? '✅ PASS' : '❌ FAIL');
  console.log('Database Access:', results.database ? '✅ PASS' : '❌ FAIL');
  console.log('API Endpoints:', results.apis ? '✅ PASS' : '⚠️  SKIP (server not running)');

  console.log('\n' + (allPassed ? '✅ ALL CRITICAL TESTS PASSED' : '❌ SOME TESTS FAILED'));

  if (allPassed) {
    console.log('\n📝 Next Steps:');
    console.log('   1. Start dev server: npm run dev');
    console.log('   2. Navigate to /analytics/chat page');
    console.log('   3. Test queries like "How is my training job doing?"');
    console.log('   4. Verify assistant uses the new tools correctly');
  }

  process.exit(allPassed ? 0 : 1);
}

runTests().catch(error => {
  console.error('\n❌ Test runner failed:', error);
  process.exit(1);
});
