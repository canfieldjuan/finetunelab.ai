#!/usr/bin/env node

/**
 * Script to check training_method data in llm_models table
 * Helps debug why Training Method Effectiveness card is blank
 */

const { createClient } = require('@supabase/supabase-js');

// Load from .env.local
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrainingMethods() {
  console.log('🔍 Checking llm_models table for training_method data...\n');

  // Get all models
  const { data: models, error: modelsError } = await supabase
    .from('llm_models')
    .select('id, model_id, name, provider, training_method, base_model, created_at, user_id')
    .order('created_at', { ascending: false });

  if (modelsError) {
    console.error('❌ Error fetching models:', modelsError);
    return;
  }

  console.log(`📊 Total models in database: ${models?.length || 0}\n`);

  if (!models || models.length === 0) {
    console.log('⚠️  No models found in llm_models table');
    console.log('   This is why Training Method Effectiveness is blank!\n');
    console.log('💡 To fix:');
    console.log('   1. Register models in LLM Registry (Models page)');
    console.log('   2. Set training_method field (sft, dpo, rlhf, or base)');
    return;
  }

  // Group by training_method
  const byMethod = {};
  const noMethod = [];

  models.forEach(m => {
    const method = m.training_method || 'none';
    if (!m.training_method) {
      noMethod.push(m);
    }
    if (!byMethod[method]) {
      byMethod[method] = [];
    }
    byMethod[method].push(m);
  });

  console.log('📋 Models by training_method:\n');
  Object.entries(byMethod).forEach(([method, modelList]) => {
    const displayMethod = method === 'none' ? '❌ NO METHOD SET' : `✅ ${method.toUpperCase()}`;
    console.log(`${displayMethod}: ${modelList.length} model(s)`);
    modelList.forEach(m => {
      console.log(`   - ${m.name || m.model_id || m.id}`);
    });
    console.log('');
  });

  // Check messages linked to models
  console.log('\n🔗 Checking messages linked to models...\n');

  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('id, model_id, role, created_at')
    .eq('role', 'assistant')
    .not('model_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (messagesError) {
    console.error('❌ Error fetching messages:', messagesError);
    return;
  }

  console.log(`📨 Total assistant messages with model_id: ${messages?.length || 0}\n`);

  if (!messages || messages.length === 0) {
    console.log('⚠️  No assistant messages have model_id populated');
    console.log('   This is why Training Method Effectiveness is blank!\n');
    console.log('💡 To fix:');
    console.log('   1. Use registered models in conversations');
    console.log('   2. Ensure messages.model_id links to llm_models.id');
    return;
  }

  // Count messages per model
  const messagesByModel = {};
  messages.forEach(m => {
    if (m.model_id) {
      messagesByModel[m.model_id] = (messagesByModel[m.model_id] || 0) + 1;
    }
  });

  console.log('📊 Messages per model:\n');
  const modelMap = new Map(models.map(m => [m.id, m]));
  Object.entries(messagesByModel).forEach(([modelId, count]) => {
    const model = modelMap.get(modelId);
    if (model) {
      const method = model.training_method || 'none';
      console.log(`   ${model.name || model.model_id || modelId} (${method}): ${count} messages`);
    } else {
      console.log(`   ⚠️  Unknown model ${modelId}: ${count} messages (orphaned)`);
    }
  });

  // Check evaluations
  console.log('\n⭐ Checking evaluations...\n');

  const messageIds = messages.map(m => m.id);
  const { data: evaluations, error: evalsError } = await supabase
    .from('message_evaluations')
    .select('id, message_id, rating, success')
    .in('message_id', messageIds);

  if (evalsError) {
    console.error('❌ Error fetching evaluations:', evalsError);
    return;
  }

  console.log(`⭐ Total evaluations: ${evaluations?.length || 0}\n`);

  if (!evaluations || evaluations.length === 0) {
    console.log('⚠️  No evaluations found for these messages');
    console.log('   Training Method Effectiveness will show 0.0 ratings\n');
    console.log('💡 To fix:');
    console.log('   1. Rate responses using thumbs up/down in chat');
    console.log('   2. Add judgments to predictions');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📝 SUMMARY\n');
  console.log(`Models in registry: ${models.length}`);
  console.log(`Models with training_method: ${models.length - noMethod.length}`);
  console.log(`Models missing training_method: ${noMethod.length}`);
  console.log(`Messages with model_id: ${messages.length}`);
  console.log(`Evaluations: ${evaluations?.length || 0}`);
  console.log('');

  if (noMethod.length > 0) {
    console.log('⚠️  ISSUE: Some models missing training_method field');
    console.log('   Models without training_method will be grouped as "base"');
    console.log('');
  }

  if (models.length > 0 && messages.length > 0) {
    console.log('✅ Training Method Effectiveness should have data');
    console.log('   If still blank, check:');
    console.log('   - Analytics page filters (may be excluding data)');
    console.log('   - Console logs: [Analytics] Training effectiveness calculated');
    console.log('   - Browser console for errors');
  } else {
    console.log('❌ Training Method Effectiveness will be blank');
    console.log('   Missing required data (models or messages)');
  }

  console.log('='.repeat(60));
}

checkTrainingMethods().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
