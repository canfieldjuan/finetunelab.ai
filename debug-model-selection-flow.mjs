import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== MODEL SELECTION FLOW ANALYSIS ===\n');

// The problematic conversation
const convId = '97d38df4-8078-481c-b475-9659dbfcc3c1';

// Get conversation
const { data: conv } = await supabase
  .from('conversations')
  .select('*')
  .eq('id', convId)
  .single();

console.log('CONVERSATION DATA:');
console.log('  llm_model_id:', conv.llm_model_id);
console.log('  widget_session_id:', conv.widget_session_id);
console.log('');

// Simulate chat API model selection logic
console.log('=== SIMULATING CHAT API MODEL SELECTION ===\n');

// From batch testing, the request body should have:
const mockRequestBody = {
  messages: [{ role: 'user', content: 'test' }],
  modelId: 'd700335c-50ed-4f6a-9257-2ec5075c4819', // From batch test config
  widgetSessionId: conv.widget_session_id,
  forceNonStreaming: true
};

console.log('Request body modelId:', mockRequestBody.modelId);
console.log('');

// Chat API model selection logic:
let selectedModelId = null;
const modelId = mockRequestBody.modelId;
const conversationId = convId;
const userId = conv.user_id;

console.log('Step 1: Initialize selectedModelId = null');
console.log('  selectedModelId:', selectedModelId);
console.log('');

console.log('Step 2: Check if modelId from request exists');
if (modelId) {
  console.log('  ✓ modelId from request exists:', modelId);
  selectedModelId = modelId;
  console.log('  → selectedModelId set to:', selectedModelId);
} else {
  console.log('  ✗ No modelId from request');
  console.log('  → Checking conversationId:', conversationId);

  if (conversationId && userId) {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('llm_model_id')
      .eq('id', conversationId)
      .single();

    if (conversation?.llm_model_id) {
      console.log('  ✓ Using model from conversation:', conversation.llm_model_id);
      selectedModelId = conversation.llm_model_id;
    }
  }
}

console.log('');
console.log('Step 3: Fallback check');
if (!selectedModelId) {
  console.log('  selectedModelId is still null, would fall back to legacy config');
} else {
  console.log('  ✓ selectedModelId is set:', selectedModelId);
}

console.log('');
console.log('=== FINAL STATE ===');
console.log('Expected selectedModelId:', 'd700335c-50ed-4f6a-9257-2ec5075c4819');
console.log('Actual selectedModelId:', selectedModelId);
console.log('Match:', selectedModelId === 'd700335c-50ed-4f6a-9257-2ec5075c4819' ? '✓' : '❌');
console.log('');

// But traces show wrong model
console.log('=== THE MYSTERY ===');
console.log('Traces recorded model_name:', '3d086d4a-f0d3-41dd-88e7-cd24bffaa760');
console.log('This does NOT match selectedModelId!');
console.log('');
console.log('Possible explanations:');
console.log('1. selectedModelId is being reassigned AFTER model selection');
console.log('2. The trace is using a different variable than selectedModelId');
console.log('3. There is caching or session state affecting the value');
console.log('4. The request body modelId is actually different than expected');
