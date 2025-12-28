-- Seed Data for Demo Test Suites
-- Provides curated prompt sets for BYOM batch testing
-- Run with: psql -h localhost -U postgres -d postgres -f seed-demo-test-suites.sql

-- Clear existing test suites (optional)
-- DELETE FROM demo_test_suites WHERE name LIKE '%Test Suite%';

-- ============================================================================
-- Customer Support Test Suites
-- ============================================================================

INSERT INTO demo_test_suites (name, description, task_domain, difficulty, prompts, prompt_count, is_active)
VALUES
(
  'Customer Support - Easy',
  'Basic customer support queries for testing helpdesk responses',
  'customer_support',
  'easy',
  '[
    {"prompt": "How do I reset my password?"},
    {"prompt": "What are your business hours?"},
    {"prompt": "How can I track my order?"},
    {"prompt": "Do you offer refunds?"},
    {"prompt": "How do I contact support?"},
    {"prompt": "Where can I find my invoice?"},
    {"prompt": "How do I update my billing information?"},
    {"prompt": "What payment methods do you accept?"},
    {"prompt": "How long does shipping take?"},
    {"prompt": "Can I cancel my subscription?"}
  ]'::jsonb,
  10,
  true
),
(
  'Customer Support - Medium',
  'Intermediate customer support scenarios requiring product knowledge',
  'customer_support',
  'medium',
  '[
    {"prompt": "My payment failed but I was charged. What should I do?"},
    {"prompt": "I need to upgrade my plan but keep my current data. How?"},
    {"prompt": "The feature I paid for isn''t working. Can you help?"},
    {"prompt": "I accidentally deleted important data. Can you recover it?"},
    {"prompt": "How do I migrate my data from your competitor?"},
    {"prompt": "Your app is running slow. What can I do to fix it?"},
    {"prompt": "I need to add team members but hit the limit. Options?"},
    {"prompt": "Can you explain the difference between your Pro and Enterprise plans?"},
    {"prompt": "I want to integrate with Salesforce. Is that possible?"},
    {"prompt": "My trial expired but I wasn''t done testing. Can you extend it?"}
  ]'::jsonb,
  10,
  true
);

-- ============================================================================
-- Code Generation Test Suites
-- ============================================================================

INSERT INTO demo_test_suites (name, description, task_domain, difficulty, prompts, prompt_count, is_active)
VALUES
(
  'Code Generation - Easy',
  'Simple coding tasks in popular languages',
  'code_generation',
  'easy',
  '[
    {"prompt": "Write a Python function to check if a number is prime"},
    {"prompt": "Create a JavaScript function to reverse a string"},
    {"prompt": "Write a SQL query to find all users created in the last 7 days"},
    {"prompt": "Write a Python function to calculate factorial"},
    {"prompt": "Create a TypeScript interface for a User with id, name, and email"},
    {"prompt": "Write a bash script to backup a directory"},
    {"prompt": "Create a CSS class for a centered flexbox container"},
    {"prompt": "Write a Python function to validate email addresses using regex"},
    {"prompt": "Create a React component that displays a loading spinner"},
    {"prompt": "Write a function to merge two sorted arrays in JavaScript"}
  ]'::jsonb,
  10,
  true
),
(
  'Code Generation - Medium',
  'Intermediate programming challenges with algorithms and data structures',
  'code_generation',
  'medium',
  '[
    {"prompt": "Implement a binary search tree in Python with insert and search methods"},
    {"prompt": "Write a REST API endpoint in Node.js/Express for user authentication"},
    {"prompt": "Create a React custom hook for debouncing input"},
    {"prompt": "Implement the Fibonacci sequence using dynamic programming in Python"},
    {"prompt": "Write a SQL query with multiple JOINs to get order statistics by customer"},
    {"prompt": "Create a TypeScript class for a LRU cache with get and put methods"},
    {"prompt": "Implement quicksort algorithm in JavaScript"},
    {"prompt": "Write a Python decorator to measure function execution time"},
    {"prompt": "Create a responsive navbar component in React with Tailwind CSS"},
    {"prompt": "Implement a rate limiter middleware for Express.js"}
  ]'::jsonb,
  10,
  true
);

-- ============================================================================
-- Q&A / Reasoning Test Suites
-- ============================================================================

INSERT INTO demo_test_suites (name, description, task_domain, difficulty, prompts, prompt_count, is_active)
VALUES
(
  'Q&A - Easy',
  'General knowledge and simple reasoning questions',
  'qa',
  'easy',
  '[
    {"prompt": "What is the capital of France?"},
    {"prompt": "How many continents are there?"},
    {"prompt": "What year did World War II end?"},
    {"prompt": "What is 15% of 200?"},
    {"prompt": "Who wrote Romeo and Juliet?"},
    {"prompt": "What is the boiling point of water in Celsius?"},
    {"prompt": "How many days are in a leap year?"},
    {"prompt": "What is the largest planet in our solar system?"},
    {"prompt": "Who invented the telephone?"},
    {"prompt": "What is the square root of 144?"}
  ]'::jsonb,
  10,
  true
),
(
  'Q&A - Medium',
  'Logic puzzles and multi-step reasoning challenges',
  'qa',
  'medium',
  '[
    {"prompt": "If a train travels at 60 mph for 2.5 hours, how far does it go?"},
    {"prompt": "Explain the difference between correlation and causation"},
    {"prompt": "If all roses are flowers and some flowers fade quickly, can we conclude that some roses fade quickly?"},
    {"prompt": "A farmer has 17 sheep. All but 9 die. How many are left?"},
    {"prompt": "What comes next in this sequence: 2, 6, 12, 20, 30, ?"},
    {"prompt": "If it takes 5 machines 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets?"},
    {"prompt": "Explain why manhole covers are round"},
    {"prompt": "How would you weigh an airplane without a scale?"},
    {"prompt": "What is the missing number: 1, 1, 2, 3, 5, 8, ?, 21"},
    {"prompt": "If you have a 3-gallon jug and a 5-gallon jug, how can you measure exactly 4 gallons?"}
  ]'::jsonb,
  10,
  true
);

-- ============================================================================
-- Creative Writing Test Suites
-- ============================================================================

INSERT INTO demo_test_suites (name, description, task_domain, difficulty, prompts, prompt_count, is_active)
VALUES
(
  'Creative - Easy',
  'Simple creative writing prompts for testing tone and coherence',
  'creative',
  'easy',
  '[
    {"prompt": "Write a short poem about the ocean"},
    {"prompt": "Describe a sunset in 3 sentences"},
    {"prompt": "Write a product description for a smart watch"},
    {"prompt": "Create a catchy slogan for a coffee shop"},
    {"prompt": "Write the opening line of a mystery novel"},
    {"prompt": "Describe the taste of chocolate to someone who has never had it"},
    {"prompt": "Write a tweet announcing a new product launch"},
    {"prompt": "Create a haiku about technology"},
    {"prompt": "Write a thank you note for a gift"},
    {"prompt": "Describe a rainy day using sensory details"}
  ]'::jsonb,
  10,
  true
),
(
  'Creative - Medium',
  'More complex creative tasks requiring narrative structure and style',
  'creative',
  'medium',
  '[
    {"prompt": "Write a 200-word short story that ends with an unexpected twist"},
    {"prompt": "Create a compelling LinkedIn post about work-life balance"},
    {"prompt": "Write dialogue between two characters meeting for the first time"},
    {"prompt": "Describe a futuristic city in the year 2150"},
    {"prompt": "Write a persuasive email to convince your boss to approve remote work"},
    {"prompt": "Create a story using these words: whisper, midnight, forgotten, key"},
    {"prompt": "Write a blog post introduction about the future of AI (3 paragraphs)"},
    {"prompt": "Describe a character using only their actions, no physical description"},
    {"prompt": "Write a product review for a fictional time-travel device"},
    {"prompt": "Create a motivational speech for a team facing a difficult challenge"}
  ]'::jsonb,
  10,
  true
);

-- Verify insertion
SELECT
  name,
  task_domain,
  difficulty,
  prompt_count,
  is_active,
  created_at
FROM demo_test_suites
ORDER BY task_domain, difficulty;
