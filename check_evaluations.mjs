import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

// Check test suites
const { data: testSuites, error: suitesError } = await supabase
  .from('test_suites')
  .select('id, name, prompt_count, created_at')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

console.log('\n=== TEST SUITES ===');
if (suitesError) {
  console.error('Error:', suitesError.message);
} else if (!testSuites || testSuites.length === 0) {
  console.log('❌ NO TEST SUITES FOUND');
  console.log('You need to create test suites with prompts first!');
} else {
  console.log('✅ Found', testSuites.length, 'test suites:');
  testSuites.forEach(s => {
    console.log('  -', s.name, '(' + s.prompt_count, 'prompts) - Created:', s.created_at.split('T')[0]);
  });
}

// Check scheduled evaluations
const { data: schedules, error: schedError } = await supabase
  .from('scheduled_evaluations')
  .select('id, name, is_active, schedule_type, next_run_at, last_run_at, test_suite_id, model_id')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

console.log('\n=== SCHEDULED EVALUATIONS ===');
if (schedError) {
  console.error('Error:', schedError.message);
} else if (!schedules || schedules.length === 0) {
  console.log('❌ NO SCHEDULED EVALUATIONS FOUND');
  console.log('You need to create scheduled evaluations in the UI!');
} else {
  console.log('✅ Found', schedules.length, 'scheduled evaluations:');
  schedules.forEach(s => {
    console.log('\n  -', s.name);
    console.log('    Active:', s.is_active ? '✅ Yes' : '❌ No');
    console.log('    Schedule:', s.schedule_type);
    console.log('    Next run:', s.next_run_at);
    console.log('    Last run:', s.last_run_at || 'Never');
    console.log('    Test suite ID:', s.test_suite_id);
    console.log('    Model ID:', s.model_id);
  });
}

// Check for recent runs
const { data: recentRuns } = await supabase
  .from('scheduled_evaluation_runs')
  .select('id, status, triggered_at, completed_at, error')
  .eq('user_id', userId)
  .order('triggered_at', { ascending: false })
  .limit(5);

console.log('\n=== RECENT EVALUATION RUNS ===');
if (!recentRuns || recentRuns.length === 0) {
  console.log('❌ NO RUNS FOUND');
  console.log('Worker has never triggered any evaluations');
} else {
  console.log('✅ Found', recentRuns.length, 'recent runs:');
  recentRuns.forEach(r => {
    console.log('\n  Run', r.id);
    console.log('    Status:', r.status);
    console.log('    Triggered:', r.triggered_at);
    console.log('    Completed:', r.completed_at || 'Not yet');
    if (r.error) console.log('    Error:', r.error);
  });
}

console.log('\n');
