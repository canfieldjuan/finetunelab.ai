#!/usr/bin/env node
/**
 * Seed Demo Test Suites
 * Populates demo_test_suites table with curated prompt sets
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const testSuites = [
  // Customer Support - Easy
  {
    name: 'Customer Support - Easy',
    description: 'Basic customer support queries for testing helpdesk responses',
    task_domain: 'customer_support',
    difficulty: 'easy',
    prompts: [
      { prompt: 'How do I reset my password?' },
      { prompt: 'What are your business hours?' },
      { prompt: 'How can I track my order?' },
      { prompt: 'Do you offer refunds?' },
      { prompt: 'How do I contact support?' },
      { prompt: 'Where can I find my invoice?' },
      { prompt: 'How do I update my billing information?' },
      { prompt: 'What payment methods do you accept?' },
      { prompt: 'How long does shipping take?' },
      { prompt: 'Can I cancel my subscription?' },
    ],
    is_active: true,
  },

  // Customer Support - Medium
  {
    name: 'Customer Support - Medium',
    description: 'Intermediate customer support scenarios requiring product knowledge',
    task_domain: 'customer_support',
    difficulty: 'medium',
    prompts: [
      { prompt: 'My payment failed but I was charged. What should I do?' },
      { prompt: 'I need to upgrade my plan but keep my current data. How?' },
      { prompt: "The feature I paid for isn't working. Can you help?" },
      { prompt: 'I accidentally deleted important data. Can you recover it?' },
      { prompt: 'How do I migrate my data from your competitor?' },
      { prompt: 'Your app is running slow. What can I do to fix it?' },
      { prompt: 'I need to add team members but hit the limit. Options?' },
      { prompt: 'Can you explain the difference between your Pro and Enterprise plans?' },
      { prompt: 'I want to integrate with Salesforce. Is that possible?' },
      { prompt: "My trial expired but I wasn't done testing. Can you extend it?" },
    ],
    is_active: true,
  },

  // Code Generation - Easy
  {
    name: 'Code Generation - Easy',
    description: 'Simple coding tasks in popular languages',
    task_domain: 'code_generation',
    difficulty: 'easy',
    prompts: [
      { prompt: 'Write a Python function to check if a number is prime' },
      { prompt: 'Create a JavaScript function to reverse a string' },
      { prompt: 'Write a SQL query to find all users created in the last 7 days' },
      { prompt: 'Write a Python function to calculate factorial' },
      { prompt: 'Create a TypeScript interface for a User with id, name, and email' },
      { prompt: 'Write a bash script to backup a directory' },
      { prompt: 'Create a CSS class for a centered flexbox container' },
      { prompt: 'Write a Python function to validate email addresses using regex' },
      { prompt: 'Create a React component that displays a loading spinner' },
      { prompt: 'Write a function to merge two sorted arrays in JavaScript' },
    ],
    is_active: true,
  },

  // Code Generation - Medium
  {
    name: 'Code Generation - Medium',
    description: 'Intermediate programming challenges with algorithms and data structures',
    task_domain: 'code_generation',
    difficulty: 'medium',
    prompts: [
      { prompt: 'Implement a binary search tree in Python with insert and search methods' },
      { prompt: 'Write a REST API endpoint in Node.js/Express for user authentication' },
      { prompt: 'Create a React custom hook for debouncing input' },
      { prompt: 'Implement the Fibonacci sequence using dynamic programming in Python' },
      { prompt: 'Write a SQL query with multiple JOINs to get order statistics by customer' },
      { prompt: 'Create a TypeScript class for a LRU cache with get and put methods' },
      { prompt: 'Implement quicksort algorithm in JavaScript' },
      { prompt: 'Write a Python decorator to measure function execution time' },
      { prompt: 'Create a responsive navbar component in React with Tailwind CSS' },
      { prompt: 'Implement a rate limiter middleware for Express.js' },
    ],
    is_active: true,
  },

  // Q&A - Easy
  {
    name: 'Q&A - Easy',
    description: 'General knowledge and simple reasoning questions',
    task_domain: 'qa',
    difficulty: 'easy',
    prompts: [
      { prompt: 'What is the capital of France?' },
      { prompt: 'How many continents are there?' },
      { prompt: 'What year did World War II end?' },
      { prompt: 'What is 15% of 200?' },
      { prompt: 'Who wrote Romeo and Juliet?' },
      { prompt: 'What is the boiling point of water in Celsius?' },
      { prompt: 'How many days are in a leap year?' },
      { prompt: 'What is the largest planet in our solar system?' },
      { prompt: 'Who invented the telephone?' },
      { prompt: 'What is the square root of 144?' },
    ],
    is_active: true,
  },

  // Q&A - Medium
  {
    name: 'Q&A - Medium',
    description: 'Logic puzzles and multi-step reasoning challenges',
    task_domain: 'qa',
    difficulty: 'medium',
    prompts: [
      { prompt: 'If a train travels at 60 mph for 2.5 hours, how far does it go?' },
      { prompt: 'Explain the difference between correlation and causation' },
      { prompt: 'If all roses are flowers and some flowers fade quickly, can we conclude that some roses fade quickly?' },
      { prompt: 'A farmer has 17 sheep. All but 9 die. How many are left?' },
      { prompt: 'What comes next in this sequence: 2, 6, 12, 20, 30, ?' },
      { prompt: 'If it takes 5 machines 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets?' },
      { prompt: 'Explain why manhole covers are round' },
      { prompt: 'How would you weigh an airplane without a scale?' },
      { prompt: 'What is the missing number: 1, 1, 2, 3, 5, 8, ?, 21' },
      { prompt: 'If you have a 3-gallon jug and a 5-gallon jug, how can you measure exactly 4 gallons?' },
    ],
    is_active: true,
  },

  // Creative - Easy
  {
    name: 'Creative - Easy',
    description: 'Simple creative writing prompts for testing tone and coherence',
    task_domain: 'creative',
    difficulty: 'easy',
    prompts: [
      { prompt: 'Write a short poem about the ocean' },
      { prompt: 'Describe a sunset in 3 sentences' },
      { prompt: 'Write a product description for a smart watch' },
      { prompt: 'Create a catchy slogan for a coffee shop' },
      { prompt: 'Write the opening line of a mystery novel' },
      { prompt: 'Describe the taste of chocolate to someone who has never had it' },
      { prompt: 'Write a tweet announcing a new product launch' },
      { prompt: 'Create a haiku about technology' },
      { prompt: 'Write a thank you note for a gift' },
      { prompt: 'Describe a rainy day using sensory details' },
    ],
    is_active: true,
  },

  // Creative - Medium
  {
    name: 'Creative - Medium',
    description: 'More complex creative tasks requiring narrative structure and style',
    task_domain: 'creative',
    difficulty: 'medium',
    prompts: [
      { prompt: 'Write a 200-word short story that ends with an unexpected twist' },
      { prompt: 'Create a compelling LinkedIn post about work-life balance' },
      { prompt: 'Write dialogue between two characters meeting for the first time' },
      { prompt: 'Describe a futuristic city in the year 2150' },
      { prompt: 'Write a persuasive email to convince your boss to approve remote work' },
      { prompt: 'Create a story using these words: whisper, midnight, forgotten, key' },
      { prompt: 'Write a blog post introduction about the future of AI (3 paragraphs)' },
      { prompt: 'Describe a character using only their actions, no physical description' },
      { prompt: 'Write a product review for a fictional time-travel device' },
      { prompt: 'Create a motivational speech for a team facing a difficult challenge' },
    ],
    is_active: true,
  },
];

console.log('🌱 Seeding demo test suites...\n');

async function seedTestSuites() {
  // Check if suites already exist
  const { data: existing } = await supabase
    .from('demo_test_suites')
    .select('name')
    .in('name', testSuites.map(s => s.name));

  if (existing && existing.length > 0) {
    console.log('⚠️  Some test suites already exist:');
    existing.forEach(s => console.log(`   - ${s.name}`));
    console.log('\nSkipping insertion to avoid duplicates.');
    console.log('To re-seed, delete existing suites first.\n');
    return;
  }

  // Insert all test suites
  const { data, error } = await supabase
    .from('demo_test_suites')
    .insert(testSuites)
    .select('name, task_domain, difficulty, prompt_count');

  if (error) {
    console.error('❌ Error inserting test suites:', error);
    process.exit(1);
  }

  console.log(`✅ Successfully inserted ${data.length} test suites:\n`);

  // Group by domain
  const byDomain = data.reduce((acc, suite) => {
    if (!acc[suite.task_domain]) acc[suite.task_domain] = [];
    acc[suite.task_domain].push(suite);
    return acc;
  }, {});

  Object.entries(byDomain).forEach(([domain, suites]) => {
    console.log(`📋 ${domain.replace('_', ' ').toUpperCase()}`);
    suites.forEach(s => {
      console.log(`   ${s.name} (${s.prompt_count} prompts)`);
    });
    console.log('');
  });

  console.log('✅ Seeding complete!\n');
}

seedTestSuites().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
