#!/usr/bin/env node

/**
 * VERIFY EPOCH/STEP TOTALS FIX
 * =============================
 * 
 * This script verifies that the RunPod training script now properly sets
 * total_epochs and total_steps in the job status, fixing the UI display
 * issue where it showed "Epoch 3 / 1" and "Step 100 / 0".
 */

console.log('🔍 VERIFYING EPOCH/STEP TOTALS FIX...\n');

const fs = require('fs');

// Test results tracker
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function addTest(name, passed, details) {
    results.tests.push({ name, passed, details });
    if (passed) {
        console.log(`✅ ${name}`);
        results.passed++;
    } else {
        console.log(`❌ ${name}`);
        console.log(`   Details: ${details}`);
        results.failed++;
    }
}

console.log('📝 Testing total_epochs fix in RunPod service...');
try {
    const serviceFile = fs.readFileSync('/home/juan-canfield/Desktop/web-ui/lib/training/runpod-service.ts', 'utf8');
    
    // Test 1: Check that total_epochs is initialized in __init__
    const hasInitTotalEpochs = serviceFile.includes('self.total_epochs = 0');
    addTest(
        'Total Epochs Initialization', 
        hasInitTotalEpochs, 
        hasInitTotalEpochs ? 'total_epochs properly initialized in __init__' : 'Missing total_epochs initialization'
    );
    
    // Test 2: Check that total_epochs is set from args in on_train_begin
    const hasArgsTotalEpochs = serviceFile.includes('self.total_epochs = args.num_train_epochs');
    addTest(
        'Total Epochs from Training Args', 
        hasArgsTotalEpochs, 
        hasArgsTotalEpochs ? 'total_epochs set from args.num_train_epochs' : 'Missing total_epochs from training args'
    );
    
    // Test 3: Check that total_epochs is included in job status update
    const hasJobUpdateTotalEpochs = serviceFile.includes("'total_epochs': self.total_epochs");
    addTest(
        'Total Epochs in Job Status Update', 
        hasJobUpdateTotalEpochs, 
        hasJobUpdateTotalEpochs ? 'total_epochs included in job status update' : 'Missing total_epochs in job status update'
    );
    
    // Test 4: Check that total_steps is still properly handled
    const hasTotalSteps = serviceFile.includes("'total_steps': self.total_steps");
    addTest(
        'Total Steps in Job Status Update', 
        hasTotalSteps, 
        hasTotalSteps ? 'total_steps properly included in job status update' : 'Missing total_steps in job status update'
    );
    
    // Test 5: Check for proper logging
    const hasProperLogging = serviceFile.includes('total steps, {self.total_epochs} total epochs');
    addTest(
        'Improved Logging', 
        hasProperLogging, 
        hasProperLogging ? 'Logging includes both total_steps and total_epochs' : 'Missing improved logging'
    );
    
    // Test 6: Check that current_epoch is still being tracked
    const hasCurrentEpochUpdate = serviceFile.includes("'current_epoch': payload.get('epoch')");
    addTest(
        'Current Epoch Tracking', 
        hasCurrentEpochUpdate, 
        hasCurrentEpochUpdate ? 'current_epoch properly tracked in metrics updates' : 'Missing current_epoch tracking'
    );
    
} catch (error) {
    addTest('RunPod Service File Analysis', false, `Error reading file: ${error.message}`);
}

console.log('\n📝 Testing training configuration consistency...');
try {
    const serviceFile = fs.readFileSync('/home/juan-canfield/Desktop/web-ui/lib/training/runpod-service.ts', 'utf8');
    
    // Test 7: Check that num_train_epochs is properly configured in TrainingArguments
    const hasTrainingArgsEpochs = serviceFile.includes('num_train_epochs=${training?.num_epochs || 3}');
    addTest(
        'Training Arguments Configuration', 
        hasTrainingArgsEpochs, 
        hasTrainingArgsEpochs ? 'num_train_epochs properly configured in TrainingArguments' : 'Missing num_train_epochs configuration'
    );
    
} catch (error) {
    addTest('Training Configuration Analysis', false, `Error reading file: ${error.message}`);
}

// Final results
console.log('\n' + '='.repeat(60));
console.log('📊 EPOCH/STEP TOTALS FIX VERIFICATION RESULTS');
console.log('='.repeat(60));
console.log(`✅ Tests Passed: ${results.passed}`);
console.log(`❌ Tests Failed: ${results.failed}`);
console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

if (results.failed === 0) {
    console.log('\n🎉 ALL EPOCH/STEP TOTALS TESTS PASSED! 🚀');
    console.log('✅ UI should now correctly show:');
    console.log('   • "Epoch X / Y" with proper total epochs');
    console.log('   • "Step X / Y" with proper total steps');
    console.log('   • Accurate progress percentages');
    console.log('\n📋 Summary of fixes applied:');
    console.log('  • total_epochs initialized and tracked in callback');
    console.log('  • total_epochs set from args.num_train_epochs');
    console.log('  • Both total_epochs and total_steps included in job status updates');
    console.log('  • Improved logging shows both totals');
    console.log('  • current_epoch continues to be tracked properly');
} else {
    console.log(`\n⚠️  ${results.failed} test(s) failed - fix required before the UI will show correct totals`);
}

console.log('\n' + '='.repeat(60));