/**
 * Check PC Expert Model Training Metrics
 * Verifies that the 50k dataset training captured useful metrics
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPCExpertMetrics() {
  console.log('=== Checking PC Expert Model Training Metrics ===\n');

  // 1. Find the PC Expert training job
  console.log('1. Searching for PC Expert training job...');
  const { data: jobs, error: jobsError } = await supabase
    .from('local_training_jobs')
    .select('*')
    .or('model_name.ilike.%PC%expert%,model_name.ilike.%qwen%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (jobsError) {
    console.error('Error fetching jobs:', jobsError);
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log('❌ No PC Expert training jobs found');
    console.log('\nTrying to search all training jobs...');

    const { data: allJobs, error: allError } = await supabase
      .from('local_training_jobs')
      .select('id, model_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (allError) {
      console.error('Error fetching all jobs:', allError);
      return;
    }

    console.log('\nRecent training jobs:');
    allJobs.forEach(job => {
      console.log(`  - ${job.model_name} (${job.status}) - ${new Date(job.created_at).toLocaleString()}`);
    });
    return;
  }

  console.log(`✅ Found ${jobs.length} training job(s)\n`);

  // Display each job
  for (const job of jobs) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Job ID: ${job.id}`);
    console.log(`Model: ${job.model_name}`);
    console.log(`Status: ${job.status}`);
    console.log(`Created: ${new Date(job.created_at).toLocaleString()}`);

    if (job.started_at) {
      console.log(`Started: ${new Date(job.started_at).toLocaleString()}`);
    }
    if (job.completed_at) {
      console.log(`Completed: ${new Date(job.completed_at).toLocaleString()}`);

      // Calculate duration
      const duration = new Date(job.completed_at) - new Date(job.started_at);
      const hours = Math.floor(duration / 3600000);
      const minutes = Math.floor((duration % 3600000) / 60000);
      console.log(`Duration: ${hours}h ${minutes}m`);
    }

    console.log(`\nTraining Configuration:`);
    console.log(`  Total Epochs: ${job.total_epochs || 'N/A'}`);
    console.log(`  Total Steps: ${job.total_steps || 'N/A'}`);
    console.log(`  Dataset: ${job.dataset_path || 'N/A'}`);

    console.log(`\nFinal Metrics:`);
    console.log(`  Final Loss: ${job.final_loss || 'N/A'}`);
    console.log(`  Final Eval Loss: ${job.final_eval_loss || 'N/A'}`);
    console.log(`  Best Eval Loss: ${job.best_eval_loss || 'N/A'}`);
    console.log(`  Best Epoch: ${job.best_epoch || 'N/A'}`);
    console.log(`  Best Step: ${job.best_step || 'N/A'}`);

    // 2. Get metrics count for this job
    console.log(`\n${'─'.repeat(70)}`);
    console.log('Metrics Time-Series Data:');

    const { count: metricsCount, error: countError } = await supabase
      .from('local_training_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', job.id);

    if (countError) {
      console.error('Error counting metrics:', countError);
    } else {
      console.log(`  Total metric points: ${metricsCount || 0}`);

      if (metricsCount > 0) {
        // Get sample metrics
        const { data: sampleMetrics, error: sampleError } = await supabase
          .from('local_training_metrics')
          .select('*')
          .eq('job_id', job.id)
          .order('step', { ascending: true })
          .limit(5);

        if (!sampleError && sampleMetrics) {
          console.log(`\n  First 5 metric points:`);
          sampleMetrics.forEach((m, idx) => {
            console.log(`    ${idx + 1}. Step ${m.step} (Epoch ${m.epoch}):`);
            console.log(`       Train Loss: ${m.train_loss}`);
            console.log(`       Eval Loss: ${m.eval_loss || 'N/A'}`);
            console.log(`       Learning Rate: ${m.learning_rate || 'N/A'}`);
            console.log(`       GPU Memory: ${m.gpu_memory_allocated_gb ? m.gpu_memory_allocated_gb + ' GB' : 'N/A'}`);
          });
        }

        // Get statistics
        const { data: stats, error: statsError } = await supabase
          .from('local_training_metrics')
          .select('train_loss, eval_loss, learning_rate, gpu_memory_allocated_gb')
          .eq('job_id', job.id);

        if (!statsError && stats && stats.length > 0) {
          console.log(`\n  Metrics Summary:`);

          const trainLosses = stats.map(s => s.train_loss).filter(l => l !== null);
          const evalLosses = stats.map(s => s.eval_loss).filter(l => l !== null);
          const lrs = stats.map(s => s.learning_rate).filter(l => l !== null);
          const gpuMems = stats.map(s => s.gpu_memory_allocated_gb).filter(m => m !== null);

          if (trainLosses.length > 0) {
            console.log(`    Train Loss: ${Math.min(...trainLosses).toFixed(4)} to ${Math.max(...trainLosses).toFixed(4)}`);
          }
          if (evalLosses.length > 0) {
            console.log(`    Eval Loss: ${Math.min(...evalLosses).toFixed(4)} to ${Math.max(...evalLosses).toFixed(4)}`);
          }
          if (lrs.length > 0) {
            console.log(`    Learning Rate: ${Math.min(...lrs).toExponential(2)} to ${Math.max(...lrs).toExponential(2)}`);
          }
          if (gpuMems.length > 0) {
            console.log(`    GPU Memory: ${Math.min(...gpuMems).toFixed(2)} GB to ${Math.max(...gpuMems).toFixed(2)} GB`);
          }
        }
      } else {
        console.log('  ⚠️  No time-series metrics found for this job');
      }
    }
  }

  console.log(`\n${'='.repeat(70)}\n`);
}

checkPCExpertMetrics().catch(console.error);
