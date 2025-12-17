/**
 * Rate Limiting Test
 * Tests the 50 schedule per user limit using service role
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testRateLimiting() {
  console.log('🧪 Testing Rate Limiting (50 Schedule Max)\n');
  console.log('═══════════════════════════════════════════\n');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get or create a test user
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

  if (listError || !users || users.length === 0) {
    console.log('❌ No users found in database');
    console.log('   Please create a user account first');
    return;
  }

  const testUser = users[0];
  console.log(`Using user: ${testUser.email}`);
  console.log();

  // Check current schedule count
  const { count: currentCount, error: countError } = await supabase
    .from('scheduled_evaluations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', testUser.id)
    .eq('is_active', true);

  if (countError) {
    console.log('❌ Error checking schedule count:', countError.message);
    return;
  }

  console.log(`Current active schedules: ${currentCount || 0} / 50`);
  console.log();

  // Get a test suite
  const { data: testSuites } = await supabase
    .from('test_suites')
    .select('id')
    .limit(1);

  const testSuiteId = testSuites?.[0]?.id || 'test-suite-id';

  if ((currentCount || 0) < 50) {
    console.log('Creating schedules to test limit...');
    console.log('(This may take a moment)\n');

    const schedulesToCreate = 50 - (currentCount || 0);
    const batchSize = 10;
    let created = 0;
    const createdIds: string[] = [];

    for (let i = 0; i < schedulesToCreate; i += batchSize) {
      const batch = Array.from({ length: Math.min(batchSize, schedulesToCreate - i) }, (_, j) => ({
        user_id: testUser.id,
        name: `Rate Limit Test ${i + j + 1}`,
        schedule_type: 'daily',
        timezone: 'UTC',
        test_suite_id: testSuiteId,
        model_id: 'gpt-4',
        batch_test_config: { model_name: 'gpt-4' },
        is_active: true,
        next_run_at: new Date(Date.now() + 86400000).toISOString(),
      }));

      const { data, error } = await supabase
        .from('scheduled_evaluations')
        .insert(batch)
        .select('id');

      if (error) {
        console.log(`❌ Error creating schedules: ${error.message}`);
        break;
      }

      if (data) {
        created += data.length;
        createdIds.push(...data.map(s => s.id));
        process.stdout.write(`\r   Created ${created} / ${schedulesToCreate} schedules...`);
      }
    }

    console.log('\n');
    console.log(`✅ Created ${created} schedules, now at 50/50 limit`);
    console.log();

    // Now try to create one more (should fail)
    console.log('Attempting to create 51st schedule (should fail)...');

    const { data: extraSchedule, error: limitError } = await supabase
      .from('scheduled_evaluations')
      .insert({
        user_id: testUser.id,
        name: 'This Should Fail',
        schedule_type: 'daily',
        timezone: 'UTC',
        test_suite_id: testSuiteId,
        model_id: 'gpt-4',
        batch_test_config: { model_name: 'gpt-4' },
        is_active: true,
        next_run_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .select();

    if (limitError) {
      console.log('✅ Database trigger correctly rejected 51st schedule!');
      console.log(`   Error message: ${limitError.message}`);
    } else {
      console.log('❌ FAILED: 51st schedule was created when it should have been rejected');
      if (extraSchedule?.[0]?.id) {
        createdIds.push(extraSchedule[0].id);
      }
    }

    // Clean up test schedules
    console.log();
    console.log('Cleaning up test schedules...');

    const { error: deleteError } = await supabase
      .from('scheduled_evaluations')
      .delete()
      .in('id', createdIds);

    if (deleteError) {
      console.log(`⚠️  Error cleaning up: ${deleteError.message}`);
      console.log(`   You may need to manually delete ${createdIds.length} test schedules`);
    } else {
      console.log(`✅ Cleaned up ${createdIds.length} test schedules`);
    }

  } else if ((currentCount || 0) === 50) {
    console.log('Already at 50/50 limit. Testing rejection...');

    const { error: limitError } = await supabase
      .from('scheduled_evaluations')
      .insert({
        user_id: testUser.id,
        name: 'This Should Fail',
        schedule_type: 'daily',
        timezone: 'UTC',
        test_suite_id: testSuiteId,
        model_id: 'gpt-4',
        batch_test_config: { model_name: 'gpt-4' },
        is_active: true,
        next_run_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .select();

    if (limitError) {
      console.log('✅ Database trigger correctly rejected schedule!');
      console.log(`   Error: ${limitError.message}`);
    } else {
      console.log('❌ FAILED: Schedule was created despite being at limit');
    }

  } else {
    console.log(`⚠️  User has ${currentCount} schedules (more than 50)`);
    console.log('   This suggests the limit was already exceeded before the fix');
    console.log('   The trigger will prevent creating new ones going forward');
  }

  console.log();
  console.log('═══════════════════════════════════════════');
  console.log('✅ Rate limiting test completed!');
  console.log('═══════════════════════════════════════════');
}

testRateLimiting().catch(console.error);
