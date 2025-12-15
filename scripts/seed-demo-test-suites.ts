/**
 * Seed Demo Test Suites
 * Run with: npx ts-node scripts/seed-demo-test-suites.ts
 * Date: December 15, 2025
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TestPrompt {
  prompt: string;
  expected_answer?: string;
  category?: string;
}

interface TestSuiteData {
  name: string;
  description: string;
  task_domain: 'customer_support' | 'code_generation' | 'qa' | 'creative';
  difficulty: 'easy' | 'medium' | 'hard';
  prompts: TestPrompt[];
}

const TEST_SUITES: TestSuiteData[] = [
  // ============================================================================
  // Customer Support Test Suites
  // ============================================================================
  {
    name: 'E-commerce Support Basics',
    description: 'Common customer support scenarios for online shopping',
    task_domain: 'customer_support',
    difficulty: 'easy',
    prompts: [
      {
        prompt: 'I ordered a product 5 days ago but haven\'t received any shipping confirmation. Can you help me track my order?',
        category: 'order_tracking',
      },
      {
        prompt: 'I received the wrong item in my package. I ordered a blue shirt but got a red one. What should I do?',
        category: 'wrong_item',
      },
      {
        prompt: 'Can I return an item I bought 2 weeks ago? I still have the receipt and original packaging.',
        category: 'returns',
      },
      {
        prompt: 'My discount code isn\'t working at checkout. The code is SAVE20 and it should give me 20% off.',
        category: 'discount_codes',
      },
      {
        prompt: 'I need to change the shipping address for my order. I just realized I put my old address.',
        category: 'address_change',
      },
      {
        prompt: 'The product I received is damaged. There\'s a crack on the screen. How do I get a replacement?',
        category: 'damaged_item',
      },
      {
        prompt: 'I was charged twice for the same order. Can you help me get a refund for the duplicate charge?',
        category: 'billing',
      },
      {
        prompt: 'When will the iPhone 15 Pro be back in stock? I\'ve been waiting for weeks.',
        category: 'stock_inquiry',
      },
      {
        prompt: 'I want to cancel my subscription. I signed up last month but don\'t need it anymore.',
        category: 'cancellation',
      },
      {
        prompt: 'Do you offer gift wrapping for orders? I\'m buying this as a birthday present.',
        category: 'gift_services',
      },
    ],
  },
  {
    name: 'Technical Support Scenarios',
    description: 'Software and technical product support situations',
    task_domain: 'customer_support',
    difficulty: 'medium',
    prompts: [
      {
        prompt: 'I can\'t log into my account. I\'ve tried resetting my password but I\'m not receiving the reset email.',
        category: 'login_issues',
      },
      {
        prompt: 'The app keeps crashing when I try to upload photos. I\'m using the latest version on iPhone 14.',
        category: 'app_crash',
      },
      {
        prompt: 'How do I export my data from your platform? I need to download all my files before closing my account.',
        category: 'data_export',
      },
      {
        prompt: 'I\'m getting an error message that says "Connection timeout" every time I try to sync. My internet is working fine.',
        category: 'sync_error',
      },
      {
        prompt: 'I accidentally deleted an important document. Is there any way to recover it?',
        category: 'data_recovery',
      },
      {
        prompt: 'The two-factor authentication isn\'t working. I lost my phone and can\'t access my authenticator app.',
        category: '2fa_issues',
      },
      {
        prompt: 'My payment method was declined even though my card has sufficient funds and isn\'t expired.',
        category: 'payment_declined',
      },
      {
        prompt: 'I need to transfer my license to a new computer. How do I deactivate it on my old machine?',
        category: 'license_transfer',
      },
    ],
  },

  // ============================================================================
  // Code Generation Test Suites
  // ============================================================================
  {
    name: 'JavaScript Fundamentals',
    description: 'Basic JavaScript coding tasks',
    task_domain: 'code_generation',
    difficulty: 'easy',
    prompts: [
      {
        prompt: 'Write a JavaScript function that reverses a string without using the built-in reverse() method.',
        category: 'string_manipulation',
      },
      {
        prompt: 'Create a function that checks if a number is prime.',
        category: 'math',
      },
      {
        prompt: 'Write a function to find the largest number in an array.',
        category: 'array',
      },
      {
        prompt: 'Implement a function that removes duplicate values from an array.',
        category: 'array',
      },
      {
        prompt: 'Create a function that converts Celsius to Fahrenheit.',
        category: 'math',
      },
      {
        prompt: 'Write a function to count the occurrences of each character in a string.',
        category: 'string_manipulation',
      },
      {
        prompt: 'Implement a simple debounce function in JavaScript.',
        category: 'utility',
      },
      {
        prompt: 'Write a function that flattens a nested array.',
        category: 'array',
      },
    ],
  },
  {
    name: 'React Component Challenges',
    description: 'React component development tasks',
    task_domain: 'code_generation',
    difficulty: 'medium',
    prompts: [
      {
        prompt: 'Create a React component for a toggle switch that tracks its on/off state.',
        category: 'component',
      },
      {
        prompt: 'Write a custom React hook called useLocalStorage that persists state to localStorage.',
        category: 'hooks',
      },
      {
        prompt: 'Create a React component that displays a countdown timer with start, pause, and reset buttons.',
        category: 'component',
      },
      {
        prompt: 'Implement a React form component with validation for email and password fields.',
        category: 'forms',
      },
      {
        prompt: 'Create a React component that fetches and displays data from an API with loading and error states.',
        category: 'data_fetching',
      },
      {
        prompt: 'Write a React component for an accordion/collapsible section.',
        category: 'component',
      },
      {
        prompt: 'Create a custom useDebounce hook in React.',
        category: 'hooks',
      },
      {
        prompt: 'Implement a React component for infinite scrolling that loads more items as the user scrolls.',
        category: 'component',
      },
    ],
  },
  {
    name: 'Python Data Processing',
    description: 'Python tasks for data manipulation',
    task_domain: 'code_generation',
    difficulty: 'medium',
    prompts: [
      {
        prompt: 'Write a Python function that reads a CSV file and returns the sum of a specific column.',
        category: 'file_io',
      },
      {
        prompt: 'Create a Python function to merge two sorted lists into one sorted list.',
        category: 'algorithm',
      },
      {
        prompt: 'Write a Python script that downloads an image from a URL and saves it locally.',
        category: 'web',
      },
      {
        prompt: 'Implement a Python function that finds all palindromic substrings in a given string.',
        category: 'string',
      },
      {
        prompt: 'Create a Python class for a simple cache with get, set, and expire functionality.',
        category: 'oop',
      },
      {
        prompt: 'Write a Python function to validate an email address using regex.',
        category: 'validation',
      },
      {
        prompt: 'Implement binary search in Python.',
        category: 'algorithm',
      },
      {
        prompt: 'Create a Python decorator that logs function execution time.',
        category: 'decorators',
      },
    ],
  },

  // ============================================================================
  // Q&A / Knowledge Test Suites
  // ============================================================================
  {
    name: 'General Knowledge',
    description: 'Factual questions across various topics',
    task_domain: 'qa',
    difficulty: 'easy',
    prompts: [
      {
        prompt: 'What is photosynthesis and why is it important for life on Earth?',
        category: 'science',
      },
      {
        prompt: 'Explain the difference between HTTP and HTTPS.',
        category: 'technology',
      },
      {
        prompt: 'What causes the seasons to change throughout the year?',
        category: 'science',
      },
      {
        prompt: 'What is the difference between a virus and bacteria?',
        category: 'biology',
      },
      {
        prompt: 'How does a solar panel convert sunlight into electricity?',
        category: 'technology',
      },
      {
        prompt: 'What is the difference between weather and climate?',
        category: 'science',
      },
      {
        prompt: 'Explain how vaccines work to protect against diseases.',
        category: 'medicine',
      },
      {
        prompt: 'What is inflation and how does it affect the economy?',
        category: 'economics',
      },
    ],
  },
  {
    name: 'Software Concepts',
    description: 'Questions about programming and software engineering concepts',
    task_domain: 'qa',
    difficulty: 'medium',
    prompts: [
      {
        prompt: 'Explain the difference between SQL and NoSQL databases. When would you use each?',
        category: 'databases',
      },
      {
        prompt: 'What is the difference between authentication and authorization?',
        category: 'security',
      },
      {
        prompt: 'Explain the concept of RESTful APIs and their key principles.',
        category: 'apis',
      },
      {
        prompt: 'What is a microservices architecture and what are its advantages over monolithic architecture?',
        category: 'architecture',
      },
      {
        prompt: 'Explain the CAP theorem in distributed systems.',
        category: 'distributed_systems',
      },
      {
        prompt: 'What is the difference between synchronous and asynchronous programming?',
        category: 'programming',
      },
      {
        prompt: 'Explain what Docker containers are and why they\'re useful.',
        category: 'devops',
      },
      {
        prompt: 'What is the difference between unit testing, integration testing, and end-to-end testing?',
        category: 'testing',
      },
    ],
  },

  // ============================================================================
  // Creative Writing Test Suites
  // ============================================================================
  {
    name: 'Marketing Copy',
    description: 'Marketing and advertising writing tasks',
    task_domain: 'creative',
    difficulty: 'easy',
    prompts: [
      {
        prompt: 'Write a compelling product description for a wireless noise-canceling headphone.',
        category: 'product_description',
      },
      {
        prompt: 'Create a catchy email subject line for a 50% off summer sale.',
        category: 'email_marketing',
      },
      {
        prompt: 'Write a short social media post announcing a new coffee shop opening.',
        category: 'social_media',
      },
      {
        prompt: 'Create a tagline for an eco-friendly water bottle brand.',
        category: 'branding',
      },
      {
        prompt: 'Write a brief press release announcing a company\'s new sustainability initiative.',
        category: 'pr',
      },
      {
        prompt: 'Create an About Us section for a small bakery that specializes in artisan bread.',
        category: 'website_copy',
      },
      {
        prompt: 'Write a call-to-action for a fitness app\'s landing page.',
        category: 'landing_page',
      },
      {
        prompt: 'Create 5 different headlines for an article about remote work productivity tips.',
        category: 'headlines',
      },
    ],
  },
  {
    name: 'Creative Storytelling',
    description: 'Fiction and creative narrative writing',
    task_domain: 'creative',
    difficulty: 'medium',
    prompts: [
      {
        prompt: 'Write the opening paragraph of a mystery novel set in a small coastal town.',
        category: 'fiction',
      },
      {
        prompt: 'Create a short dialogue between two strangers who meet at a train station during a delay.',
        category: 'dialogue',
      },
      {
        prompt: 'Write a poem about the feeling of coming home after a long journey.',
        category: 'poetry',
      },
      {
        prompt: 'Create a backstory for a video game character who is a retired treasure hunter.',
        category: 'character',
      },
      {
        prompt: 'Write a short fable with a moral lesson about patience.',
        category: 'fable',
      },
      {
        prompt: 'Create a vivid description of a bustling marketplace in a fantasy world.',
        category: 'worldbuilding',
      },
      {
        prompt: 'Write a letter from the perspective of someone living 100 years in the future describing daily life.',
        category: 'perspective',
      },
      {
        prompt: 'Create a plot synopsis for a romantic comedy about rival food truck owners.',
        category: 'plot',
      },
    ],
  },
];

async function seedTestSuites() {
  console.log('Starting demo test suite seeding...\n');

  // Check if suites already exist
  const { data: existing, error: checkError } = await supabase
    .from('demo_test_suites')
    .select('id, name')
    .limit(1);

  if (checkError) {
    console.error('Error checking existing suites:', checkError);
    console.log('\nNote: Make sure the demo_test_suites table exists.');
    console.log('Run the migration first: supabase/migrations/20251215000000_create_demo_tables.sql');
    process.exit(1);
  }

  if (existing && existing.length > 0) {
    console.log('Demo test suites already exist. Skipping seed.');
    console.log('To re-seed, first delete existing suites:');
    console.log('  DELETE FROM demo_test_suites;');
    process.exit(0);
  }

  // Insert all test suites
  let successCount = 0;
  let errorCount = 0;

  for (const suite of TEST_SUITES) {
    const { error } = await supabase.from('demo_test_suites').insert({
      name: suite.name,
      description: suite.description,
      task_domain: suite.task_domain,
      difficulty: suite.difficulty,
      prompts: suite.prompts,
      is_active: true,
    });

    if (error) {
      console.error(`Error inserting "${suite.name}":`, error.message);
      errorCount++;
    } else {
      console.log(`✓ Inserted: ${suite.name} (${suite.prompts.length} prompts)`);
      successCount++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Successfully inserted: ${successCount} test suites`);
  console.log(`Failed: ${errorCount} test suites`);

  // Show counts by domain
  const { data: counts } = await supabase
    .from('demo_test_suites')
    .select('task_domain');

  if (counts) {
    const byDomain: Record<string, number> = {};
    counts.forEach((c) => {
      byDomain[c.task_domain] = (byDomain[c.task_domain] || 0) + 1;
    });

    console.log('\nSuites by domain:');
    Object.entries(byDomain).forEach(([domain, count]) => {
      console.log(`  ${domain}: ${count}`);
    });
  }

  console.log('\nDone!');
}

seedTestSuites().catch(console.error);
