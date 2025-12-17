/**
 * Test Worker Graceful Shutdown
 * Verifies that the worker handles SIGTERM/SIGINT correctly
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

console.log('🧪 Testing Worker Graceful Shutdown\n');
console.log('═══════════════════════════════════════════\n');

console.log('Instructions:');
console.log('1. The scheduler worker should be running in another terminal');
console.log('2. Press Ctrl+C in the worker terminal');
console.log('3. Verify you see this message:');
console.log('   "[EvaluationSchedulerWorker] Shutting down gracefully..."');
console.log('4. Verify the worker exits cleanly without errors\n');

console.log('What to look for:');
console.log('✅ Graceful shutdown message appears');
console.log('✅ Worker stops polling for new schedules');
console.log('✅ No error stack traces');
console.log('✅ Process exits with code 0');
console.log();

console.log('Testing signal handlers programmatically...\n');

// Test that signal handlers are properly configured
console.log('Checking signal handler registration:');

const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

for (const signal of signals) {
  const listenerCount = process.listenerCount(signal);
  if (listenerCount > 0) {
    console.log(`✅ ${signal} handler registered (${listenerCount} listener(s))`);
  } else {
    console.log(`⚠️  ${signal} handler NOT found`);
  }
}

console.log();
console.log('═══════════════════════════════════════════');
console.log('Manual Test Required:');
console.log('═══════════════════════════════════════════');
console.log();
console.log('To complete this test:');
console.log('1. Find the worker process: ps aux | grep start-scheduler-worker');
console.log('2. Send SIGTERM: kill -TERM <pid>');
console.log('3. OR use Ctrl+C in the worker terminal');
console.log('4. Verify clean shutdown');
console.log();
console.log('Expected output in worker terminal:');
console.log('  [EvaluationSchedulerWorker] Shutting down gracefully...');
console.log('  [EvaluationSchedulerWorker] Scheduler stopped');
console.log('  [EvaluationSchedulerWorker] Worker shutdown complete');
console.log();
