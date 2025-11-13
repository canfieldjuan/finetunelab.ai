// Prompt Tester Tool - Test Suite
// Date: October 13, 2025

import promptTesterService from './prompt-tester.service';
import type { TestData, TestOptions, PromptPattern } from './types';

async function testPromptTesting() {
  console.log('\n=== Testing Prompt Testing ===');
  
  const template = 'You are a helpful assistant. Answer the user question: {{question}}';
  const testData: TestData = {
    variables: { question: 'What is the capital of France?' },
    messages: [
      { role: 'user', content: 'What is the capital of France?' }
    ]
  };
  
  const options: TestOptions = {
    temperature: 0.7,
    max_tokens: 100
  };
  
  try {
    const result = await promptTesterService.testPrompt(template, testData, options);
    console.log('✓ Prompt test successful');
    console.log('  Response:', result.response.substring(0, 100));
    console.log('  Quality Score:', result.qualityScore);
    console.log('  Issues:', result.issues.length);
    console.log('  Response Time:', result.responseTime, 'ms');
  } catch (error) {
    console.error('✗ Prompt test failed:', error);
  }
}

async function testPromptComparison() {
  console.log('\n=== Testing Prompt Comparison ===');
  
  const promptA = 'You are a helpful assistant. {{question}}';
  const promptB = 'You are an expert assistant. Please answer: {{question}}';
  
  const testData: TestData = {
    variables: { question: 'Explain quantum computing in simple terms' },
  };
  
  try {
    const comparison = await promptTesterService.comparePrompts(
      promptA,
      promptB,
      testData
    );
    console.log('✓ Prompt comparison successful');
    console.log('  Winner:', comparison.winner === 0 ? 'Prompt A' : comparison.winner === 1 ? 'Prompt B' : 'Tie');
    console.log('  Reasoning:', comparison.reasoning);
    console.log('  Avg Token Count:', comparison.metrics.avgTokenCount);
    console.log('  Avg Response Time:', comparison.metrics.avgResponseTime);
  } catch (error) {
    console.error('✗ Prompt comparison failed:', error);
  }
}

async function testPatternSaving() {
  console.log('\n=== Testing Pattern Saving ===');
  
  const pattern: PromptPattern = {
    id: 'test-pattern-1',
    name: 'Helpful Assistant Pattern',
    template: 'You are a helpful assistant. {{context}}\n\nQuestion: {{question}}',
    use_case: 'General Q&A',
    success_rate: 0.95,
    avg_rating: 4.5,
    created_at: new Date().toISOString(),
    metadata: {
      tags: ['qa', 'helpful', 'general'],
      description: 'A general-purpose helpful assistant pattern'
    }
  };
  
  try {
    const result = await promptTesterService.savePattern(pattern, 'test-user');
    console.log('✓ Pattern save successful');
    console.log('  Success:', result.success);
    console.log('  Message:', result.message);
  } catch (error) {
    console.error('✗ Pattern save failed:', error);
  }
}

async function testPatternSearch() {
  console.log('\n=== Testing Pattern Search ===');
  
  try {
    const patterns = await promptTesterService.searchPatterns(
      'helpful assistant',
      'test-user'
    );
    console.log('✓ Pattern search successful');
    console.log('  Patterns found:', patterns.length);
    if (patterns.length > 0) {
      console.log('  First pattern:', patterns[0].name);
    }
  } catch (error) {
    console.error('✗ Pattern search failed:', error);
  }
}

async function runAllTests() {
  console.log('Starting Prompt Tester Tool Tests...');
  console.log('=====================================');
  
  await testPromptTesting();
  await testPromptComparison();
  await testPatternSaving();
  await testPatternSearch();
  
  console.log('\n=====================================');
  console.log('All tests completed!');
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests };
