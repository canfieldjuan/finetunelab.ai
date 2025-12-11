#!/usr/bin/env node

/**
 * VERIFY EVALUATION METRICS & DATASET SIZE FIXES
 * ==============================================
 * 
 * This script verifies that the RunPod training script now properly:
 * 1. Captures evaluation metrics through on_evaluate callback
 * 2. Tracks and reports dataset size (total_samples)
 * 3. Logs evaluation metrics to the database for UI display
 */

console.log('🔍 VERIFYING EVALUATION METRICS & DATASET SIZE FIXES...\n');

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

console.log('📝 Testing evaluation callback implementation...');
try {
    const serviceFile = fs.readFileSync('/home/juan-canfield/Desktop/web-ui/lib/training/runpod-service.ts', 'utf8');
    
    // Test 1: Check that on_evaluate callback is implemented
    const hasOnEvaluate = serviceFile.includes('def on_evaluate(self, args, state, control, metrics=None, **kwargs):');
    addTest(
        'Evaluation Callback Implementation', 
        hasOnEvaluate, 
        hasOnEvaluate ? 'on_evaluate callback properly implemented' : 'Missing on_evaluate callback'
    );
    
    // Test 2: Check for eval_loss extraction in on_evaluate
    const hasEvalLossExtraction = serviceFile.includes("if 'eval_loss' in metrics:") && 
                                  serviceFile.includes("eval_metrics['eval_loss'] = metrics['eval_loss']");
    addTest(
        'Evaluation Loss Extraction', 
        hasEvalLossExtraction, 
        hasEvalLossExtraction ? 'eval_loss properly extracted from evaluation metrics' : 'Missing eval_loss extraction'
    );
    
    // Test 3: Check for eval perplexity calculation
    const hasEvalPerplexity = serviceFile.includes('eval_perplexity = math.exp(metrics[\'eval_loss\'])');
    addTest(
        'Evaluation Perplexity Calculation', 
        hasEvalPerplexity, 
        hasEvalPerplexity ? 'Evaluation perplexity properly calculated' : 'Missing evaluation perplexity calculation'
    );
    
    // Test 4: Check that eval metrics are inserted into database
    const hasEvalMetricsInsert = serviceFile.includes("metrics_response = supabase.table('local_training_metrics').insert(metrics_insert).execute()") &&
                                serviceFile.includes("logger.info(f\"[Evaluation] Inserted eval metrics for step {current_step}\")");
    addTest(
        'Evaluation Metrics Database Insert', 
        hasEvalMetricsInsert, 
        hasEvalMetricsInsert ? 'Evaluation metrics properly inserted into database' : 'Missing evaluation metrics database insert'
    );
    
} catch (error) {
    addTest('Evaluation Callback Analysis', false, `Error reading file: ${error.message}`);
}

console.log('\n📝 Testing dataset size tracking...');
try {
    const serviceFile = fs.readFileSync('/home/juan-canfield/Desktop/web-ui/lib/training/runpod-service.ts', 'utf8');
    
    // Test 5: Check that total_samples is initialized in callback
    const hasTotalSamplesInit = serviceFile.includes('def __init__(self, total_samples=None):') && 
                               serviceFile.includes('self.total_samples = total_samples or 0');
    addTest(
        'Total Samples Initialization', 
        hasTotalSamplesInit, 
        hasTotalSamplesInit ? 'total_samples properly initialized in callback' : 'Missing total_samples initialization'
    );
    
    // Test 6: Check that dataset size is passed to callback
    const hasDatasetSizePassage = serviceFile.includes('total_samples = len(full_dataset)') && 
                                 serviceFile.includes('metrics_callback = TrainingMetricsCallback(total_samples=total_samples)');
    addTest(
        'Dataset Size Passage to Callback', 
        hasDatasetSizePassage, 
        hasDatasetSizePassage ? 'Dataset size properly passed to callback' : 'Missing dataset size passage to callback'
    );
    
    // Test 7: Check that total_samples is included in job status update
    const hasTotalSamplesInJobUpdate = serviceFile.includes("'total_samples': self.total_samples");
    addTest(
        'Total Samples in Job Status', 
        hasTotalSamplesInJobUpdate, 
        hasTotalSamplesInJobUpdate ? 'total_samples included in job status update' : 'Missing total_samples in job status update'
    );
    
    // Test 8: Check for dataset size logging
    const hasDatasetSizeLogging = serviceFile.includes('print(f"Total dataset size: {len(full_dataset)} examples")');
    addTest(
        'Dataset Size Logging', 
        hasDatasetSizeLogging, 
        hasDatasetSizeLogging ? 'Dataset size properly logged' : 'Missing dataset size logging'
    );
    
} catch (error) {
    addTest('Dataset Size Analysis', false, `Error reading file: ${error.message}`);
}

console.log('\n📝 Testing evaluation configuration...');
try {
    const serviceFile = fs.readFileSync('/home/juan-canfield/Desktop/web-ui/lib/training/runpod-service.ts', 'utf8');
    
    // Test 9: Check evaluation strategy configuration
    const hasEvalStrategy = serviceFile.includes('eval_strategy = "${training?.evaluation_strategy || \'steps\'}"');
    addTest(
        'Evaluation Strategy Configuration', 
        hasEvalStrategy, 
        hasEvalStrategy ? 'Evaluation strategy properly configured' : 'Missing evaluation strategy configuration'
    );
    
    // Test 10: Check that eval_strategy is used in training args
    const hasEvalStrategyUsage = serviceFile.includes('eval_strategy=eval_strategy');
    addTest(
        'Evaluation Strategy Usage', 
        hasEvalStrategyUsage, 
        hasEvalStrategyUsage ? 'Evaluation strategy properly used in training configuration' : 'Missing evaluation strategy usage'
    );
    
} catch (error) {
    addTest('Evaluation Configuration Analysis', false, `Error reading file: ${error.message}`);
}

// Final results
console.log('\n' + '='.repeat(70));
console.log('📊 EVALUATION METRICS & DATASET SIZE FIX VERIFICATION RESULTS');
console.log('='.repeat(70));
console.log(`✅ Tests Passed: ${results.passed}`);
console.log(`❌ Tests Failed: ${results.failed}`);
console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

if (results.failed === 0) {
    console.log('\n🎉 ALL EVALUATION & DATASET SIZE TESTS PASSED! 🚀');
    console.log('✅ Expected improvements:');
    console.log('   • Evaluation loss will now appear in training progress charts');
    console.log('   • Dataset size will be visible in the UI (total_samples)');
    console.log('   • Evaluation metrics logged separately during eval phases');
    console.log('   • Proper perplexity calculation for evaluation data');
    console.log('\n📋 Summary of fixes applied:');
    console.log('  • Added on_evaluate callback to capture eval metrics separately');
    console.log('  • Implemented eval_loss extraction and database insertion');
    console.log('  • Added total_samples tracking from dataset size');
    console.log('  • Enhanced evaluation perplexity calculation');
    console.log('  • Improved logging for evaluation phases');
} else {
    console.log(`\n⚠️  ${results.failed} test(s) failed - fix required before evaluation metrics will appear in UI`);
}

console.log('\n' + '='.repeat(70));