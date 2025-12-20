import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const jobId = 'cf921fa5-ef19-4ae5-9d00-3608f6f60531';

const { data: job, error } = await supabase
  .from('local_training_jobs')
  .select('total_samples, train_samples, val_samples, total_steps, expected_total_steps, dataset_path, status, config')
  .eq('id', jobId)
  .single();

if (error) {
  console.error('Error:', error);
} else {
  console.log('Job Data:');
  console.log('total_samples:', job.total_samples);
  console.log('train_samples:', job.train_samples);
  console.log('val_samples:', job.val_samples);
  console.log('total_steps:', job.total_steps);
  console.log('expected_total_steps:', job.expected_total_steps);
  console.log('dataset_path:', job.dataset_path);
  console.log('status:', job.status);
  console.log('\nConfig training section:');
  console.log('batch_size:', job.config?.training?.batch_size);
  console.log('gradient_accumulation_steps:', job.config?.training?.gradient_accumulation_steps);
  console.log('num_epochs:', job.config?.training?.num_epochs);
}
