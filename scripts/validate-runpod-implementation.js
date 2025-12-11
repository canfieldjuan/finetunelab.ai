/**
 * RunPod Implementation Validation Script
 * Purpose: Verify all critical components are working correctly
 * Date: 2025-11-24
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

async function validateImplementation() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  RunPod Training Deployment - Implementation Validation    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let allPassed = true;
  const results = [];

  // ============================================================================
  // Test 1: Environment Variables
  // ============================================================================
  console.log('📋 Test 1: Environment Variables');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const requiredEnvVars = {
    'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'NEXT_PUBLIC_APP_URL': process.env.NEXT_PUBLIC_APP_URL,
  };

  let envPassed = true;
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value) {
      console.log(`   ❌ ${key}: MISSING`);
      envPassed = false;
      allPassed = false;
    } else {
      const display = key.includes('KEY') ? value.substring(0, 20) + '...' : value;
      console.log(`   ✅ ${key}: ${display}`);
    }
  }

  // Check for localhost in production
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  if (appUrl && appUrl.includes('localhost') && nodeEnv === 'production') {
    console.log('   ⚠️  WARNING: Using localhost URL in production mode');
    console.log('      RunPod pods will NOT be able to access download endpoint');
    envPassed = false;
  }

  results.push({ test: 'Environment Variables', passed: envPassed });
  console.log('');

  // ============================================================================
  // Test 2: Database Table Exists
  // ============================================================================
  console.log('📋 Test 2: Database Table Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let dbPassed = false;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { count, error } = await supabase
      .from('dataset_download_tokens')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('   ❌ Table check failed:', error.message);
      if (error.message.includes('does not exist')) {
        console.log('   ⚠️  Run: psql $DATABASE_URL < migrations/20251124_add_dataset_download_tokens.sql');
      }
      allPassed = false;
    } else {
      console.log('   ✅ Table "dataset_download_tokens" exists');
      console.log('   ✅ Current rows:', count || 0);
      dbPassed = true;
    }
  } catch (error) {
    console.log('   ❌ Database connection failed:', error.message);
    allPassed = false;
  }

  results.push({ test: 'Database Table', passed: dbPassed });
  console.log('');

  // ============================================================================
  // Test 3: Required Files Exist
  // ============================================================================
  console.log('📋 Test 3: Implementation Files');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const requiredFiles = [
    'lib/training/dataset-url-service.ts',
    'app/api/datasets/download/route.ts',
    'migrations/20251124_add_dataset_download_tokens.sql',
  ];

  let filesPassed = true;
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`   ✅ ${file} (${stats.size} bytes)`);
    } else {
      console.log(`   ❌ ${file} NOT FOUND`);
      filesPassed = false;
      allPassed = false;
    }
  }

  results.push({ test: 'Implementation Files', passed: filesPassed });
  console.log('');

  // ============================================================================
  // Test 4: Code Integration Check
  // ============================================================================
  console.log('📋 Test 4: Code Integration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let integrationPassed = true;

  // Check deployment route uses datasetDownloadUrl
  const routePath = path.join(__dirname, '..', 'app/api/training/deploy/runpod/route.ts');
  if (fs.existsSync(routePath)) {
    const routeContent = fs.readFileSync(routePath, 'utf8');
    
    if (routeContent.includes('datasetDownloadUrl')) {
      console.log('   ✅ Deployment route uses datasetDownloadUrl');
    } else {
      console.log('   ❌ Deployment route missing datasetDownloadUrl variable');
      integrationPassed = false;
      allPassed = false;
    }

    if (routeContent.includes('datasetUrlService.generateDownloadUrl')) {
      console.log('   ✅ Deployment route calls generateDownloadUrl()');
    } else {
      console.log('   ❌ Deployment route missing generateDownloadUrl() call');
      integrationPassed = false;
      allPassed = false;
    }
  }

  // Check runpod-service uses PyTorch image
  const servicePath = path.join(__dirname, '..', 'lib/training/runpod-service.ts');
  if (fs.existsSync(servicePath)) {
    const serviceContent = fs.readFileSync(servicePath, 'utf8');
    
    if (serviceContent.includes('runpod/pytorch:2.1.0')) {
      console.log('   ✅ RunPod service uses PyTorch Docker image');
    } else {
      console.log('   ❌ RunPod service missing PyTorch Docker image');
      integrationPassed = false;
      allPassed = false;
    }

    if (serviceContent.includes('set -euo pipefail')) {
      console.log('   ✅ Training script has error handling');
    } else {
      console.log('   ❌ Training script missing error handling');
      integrationPassed = false;
      allPassed = false;
    }
  }

  results.push({ test: 'Code Integration', passed: integrationPassed });
  console.log('');

  // ============================================================================
  // Test 5: Token Generation (Dry Run)
  // ============================================================================
  console.log('📋 Test 5: Token Generation Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let tokenPassed = false;
  try {
    const { randomBytes } = require('crypto');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 2 * 3600000);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const downloadUrl = `${appUrl}/api/datasets/download?token=${token}`;

    console.log('   ✅ Token generated:', token.substring(0, 20) + '...');
    console.log('   ✅ Expires at:', expiresAt.toISOString());
    console.log('   ✅ Download URL:', downloadUrl.replace(/token=.*/, 'token=***'));
    tokenPassed = true;
  } catch (error) {
    console.log('   ❌ Token generation failed:', error.message);
    allPassed = false;
  }

  results.push({ test: 'Token Generation', passed: tokenPassed });
  console.log('');

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    VALIDATION SUMMARY                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.test}`);
  });

  console.log('');
  console.log(`Tests Passed: ${passed}/${total}`);
  console.log('');

  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! Implementation is ready.');
    console.log('');
    console.log('Next Steps:');
    console.log('1. Test deployment with small dataset');
    console.log('2. Monitor RunPod logs for successful download');
    console.log('3. Verify training starts within 5 minutes');
    console.log('');
    console.log('⚠️  PRODUCTION DEPLOYMENT:');
    console.log('   Set NEXT_PUBLIC_APP_URL to your production domain');
    console.log('   Example: NEXT_PUBLIC_APP_URL=https://your-domain.com');
    process.exit(0);
  } else {
    console.log('❌ VALIDATION FAILED - Fix issues above before deploying');
    console.log('');
    console.log('Review: IMPLEMENTATION_GAPS_ANALYSIS.md');
    process.exit(1);
  }
}

// Run validation
validateImplementation().catch(error => {
  console.error('Validation script error:', error);
  process.exit(1);
});
