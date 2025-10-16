// Quick Tool Test Script
// Test if tools are working manually
// Run this in browser console on the chat page

import { executeTool } from '../lib/tools';

async function testTools() {
  console.log('Testing Plugin System...\n');
  
  // Test 1: Calculator
  console.log('1. Testing Calculator...');
  try {
    const calcResult = await executeTool('calculator', { expression: '25 * 47' });
    console.log('✅ Calculator Result:', calcResult);
  } catch (error) {
    console.error('❌ Calculator Error:', error);
  }
  
  // Test 2: DateTime
  console.log('\n2. Testing DateTime...');
  try {
    const timeResult = await executeTool('datetime', { operation: 'current_datetime' });
    console.log('✅ DateTime Result:', timeResult);
  } catch (error) {
    console.error('❌ DateTime Error:', error);
  }
  
  // Test 3: DateTime with timezone
  console.log('\n3. Testing DateTime with Timezone...');
  try {
    const tzResult = await executeTool('datetime', { 
      operation: 'current_datetime',
      timezone: 'America/New_York'
    });
    console.log('✅ DateTime (EST) Result:', tzResult);
  } catch (error) {
    console.error('❌ DateTime (EST) Error:', error);
  }
}

// Run tests
testTools();
