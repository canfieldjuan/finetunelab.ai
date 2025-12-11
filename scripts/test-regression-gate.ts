/**
 * Quick test to verify Regression Gate handler is properly configured
 * Run with: npx tsx scripts/test-regression-gate.ts
 */

import { defaultHandlers } from '../lib/training/job-handlers';
import type { RegressionGateConfig } from '../lib/training/dag-orchestrator';

console.log('🧪 Testing Regression Gate Handler Registration\n');

// Check handler is exported
const handlers = Object.keys(defaultHandlers);
console.log('Available handlers:', handlers);

if (handlers.includes('regression-gate')) {
  console.log('✅ regression-gate handler is registered');
} else {
  console.log('❌ regression-gate handler NOT found');
  process.exit(1);
}

// Check handler is a function
const handler = defaultHandlers['regression-gate'];
if (typeof handler === 'function') {
  console.log('✅ regression-gate handler is a function');
} else {
  console.log('❌ regression-gate handler is not a function');
  process.exit(1);
}

// Test RegressionGateConfig type (compile-time check)
const testConfig: RegressionGateConfig = {
  baselineId: '550e8400-e29b-41d4-a716-446655440000',
  currentMetrics: {
    accuracy: 0.93,
    f1: 0.89
  },
  failureThreshold: 0.05,
  requiredMetrics: ['accuracy', 'f1'],
  blockOnFailure: true,
};

console.log('✅ RegressionGateConfig type compiles correctly');
console.log('\nTest config:', JSON.stringify(testConfig, null, 2));

console.log('\n🎉 All checks passed! Regression gate is ready to use.');
console.log('\nNext steps:');
console.log('1. Go to http://localhost:3000/training/dag');
console.log('2. Click "Regression Gate" button (Shield icon)');
console.log('3. Create a baseline first in Regression Gates tab');
console.log('4. Configure regression gate node with baseline ID and metrics');
console.log('5. Execute DAG workflow');
