#!/usr/bin/env node
/**
 * Check the endpoint configuration for the custom HuggingFace model
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hyfpnalmmwtfjovtmvlg.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZnBuYWxtbXd0ZmpvdnRtdmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA2NjU1NzQsImV4cCI6MjA0NjI0MTU3NH0.B-Eiiy7KTw0EgM4qOmoBl_YXHQ1V-LXCNQR5FnwKn60';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkModelEndpoint() {
  console.log('Checking HuggingFace model configuration...\n');
  
  // Get the custom model
  const { data: models, error } = await supabase
    .from('llm_models')
    .select('*')
    .eq('model_id', 'Canfield/llama-3-2-3b-instruct-new-atlas-dataset')
    .single();
  
  if (error) {
    console.error('Error fetching model:', error);
    return;
  }
  
  if (!models) {
    console.log('❌ Model not found in database');
    return;
  }
  
  console.log('Model Configuration:');
  console.log('-------------------');
  console.log('Model ID:', models.model_id);
  console.log('Provider:', models.provider);
  console.log('Base URL:', models.base_url);
  console.log('Model Name:', models.name);
  console.log('Description:', models.description);
  console.log('Is Active:', models.is_active);
  console.log('\n');
  
  // Check if base_url is correct
  if (models.base_url === 'https://router.huggingface.co/v1') {
    console.log('⚠️  PROBLEM FOUND:');
    console.log('   Your model is using the HuggingFace Router endpoint.');
    console.log('   The Router only supports third-party providers (OpenAI, Anthropic, etc.)');
    console.log('   Custom fine-tuned models need the Inference API endpoint.\n');
    console.log('✅ SOLUTION:');
    console.log('   Change base_url to: https://api-inference.huggingface.co/models');
    console.log('   Or use: https://api-inference.huggingface.co');
  } else if (models.base_url?.includes('api-inference')) {
    console.log('✅ Base URL looks correct for custom models');
  } else {
    console.log('⚠️  Unknown base URL:', models.base_url);
  }
}

checkModelEndpoint().catch(console.error);
