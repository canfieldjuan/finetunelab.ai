# Integration Tests for Benchmark Enhancement Feature

This directory contains **real integration tests** that use actual Supabase connections instead of mocks.

## Setup

### 1. Environment Variables

Create or update `.env.local` with:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Test User Credentials
TEST_USER_EMAIL=your-test-user@example.com
TEST_USER_PASSWORD=your-test-password

# Optional: Custom test server URL
TEST_BASE_URL=http://localhost:3000
```

### 2. Create Test User

Before running tests, create a test user in your Supabase project:

```sql
-- In Supabase SQL Editor
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES (
  'test@example.com',
  crypt('your-test-password', gen_salt('bf')),
  NOW()
);
```

Or use Supabase Auth UI to create a user manually.

### 3. Start Development Server

```bash
npm run dev
```

The server must be running on `http://localhost:3000` (or your custom TEST_BASE_URL).

## Running Tests

### Run All Integration Tests

```bash
npm test __tests__/integration
```

### Run Specific Test Suite

```bash
# Benchmark CRUD operations
npm test __tests__/integration/benchmarks.integration.test.ts

# Validator breakdown
npm test __tests__/integration/validator-breakdown.integration.test.ts
```

### Watch Mode

```bash
npm test:watch __tests__/integration
```

## Test Coverage

### `benchmarks.integration.test.ts`

Tests the full lifecycle of benchmark management:

- ✅ **CREATE** - POST /api/benchmarks
  - Create benchmark with validators
  - Reject unauthenticated requests
  
- ✅ **READ** - GET /api/benchmarks
  - Fetch user's benchmarks
  - Verify created benchmark appears in list

- ✅ **UPDATE** - PATCH /api/benchmarks/[id]
  - Update benchmark name
  - Update pass_criteria (validators, min_score, custom_rules)
  - Update is_public flag
  - Return 404 for non-existent benchmark
  - Reject unauthenticated requests

- ✅ **DELETE** - DELETE /api/benchmarks/[id]
  - Delete benchmark
  - Verify deletion (no longer in list)
  - Return 404 for non-existent benchmark
  - Reject unauthenticated requests

### `validator-breakdown.integration.test.ts`

Tests validator results aggregation:

- ✅ **Fetch Breakdown** - GET /api/batch-testing/[id]/validators
  - Fetch validator statistics for completed test run
  - Calculate pass/fail counts correctly
  - Calculate pass rates (percentage)
  
- ✅ **Statistics Accuracy**
  - Correct total/passed/failed counts per validator
  - Correct pass rate calculation (rounds properly)
  
- ✅ **Sorting**
  - Validators sorted by pass_rate (lowest first)
  
- ✅ **Filtering**
  - Exclude basic judgments (only show validators)
  
- ✅ **Per-Criterion Breakdown**
  - Include criterion-level statistics
  - Correct counts per criterion

- ✅ **Edge Cases**
  - Return empty array for non-existent test run
  - Handle runs with no messages
  - Handle messages with no judgments

## Test Data Cleanup

All integration tests clean up after themselves:

- **benchmarks.integration.test.ts**: Deletes created benchmark in `afterAll`
- **validator-breakdown.integration.test.ts**: Deletes test run, messages, and judgments in `afterAll`

If a test fails mid-execution, you may need to manually clean up:

```sql
-- Find and delete test benchmarks
DELETE FROM benchmarks WHERE name LIKE '%Integration Test%';

-- Find and delete test batch runs
DELETE FROM batch_test_runs WHERE model_name = 'test-model';
```

## Troubleshooting

### "Failed to authenticate test user"

- Verify TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.local
- Ensure user exists in Supabase Auth
- Check Supabase URL and keys are correct

### "Connection refused" or "ECONNREFUSED"

- Ensure `npm run dev` is running
- Check TEST_BASE_URL matches your dev server
- Verify port 3000 is not blocked

### "404 Not Found" for API routes

- Ensure you're running tests against the correct Next.js server
- Check that API routes are properly deployed/built
- Verify BASE_URL includes protocol (http://)

### Tests fail with "Benchmark not found"

- Check Supabase RLS (Row Level Security) policies
- Ensure test user has permission to create/read/update/delete benchmarks
- Verify `created_by` field matches authenticated user ID

### "Database error" or timeout

- Check Supabase project status
- Verify network connection
- Check for rate limiting
- Ensure database tables exist (benchmarks, batch_test_runs, messages, judgments)

## Database Schema Requirements

These tests assume the following tables exist:

### `benchmarks`
```sql
- id (uuid, primary key)
- name (text)
- description (text, nullable)
- task_type (text)
- pass_criteria (jsonb)
- created_by (uuid, foreign key to auth.users)
- is_public (boolean)
- created_at (timestamp)
```

### `batch_test_runs`
```sql
- id (uuid, primary key)
- model_name (text)
- status (text)
- total_prompts (integer)
- completed_prompts (integer)
- failed_prompts (integer)
- started_at (timestamp)
- completed_at (timestamp, nullable)
- archived (boolean, default false)
```

### `messages`
```sql
- id (uuid, primary key)
- role (text)
- content (text)
- test_run_id (uuid, foreign key to batch_test_runs, nullable)
- created_by (uuid, foreign key to auth.users)
- created_at (timestamp)
```

### `judgments`
```sql
- id (uuid, primary key)
- message_id (uuid, foreign key to messages)
- judge_type (text)
- judge_name (text)
- criterion (text)
- score (numeric)
- passed (boolean)
- evidence_json (jsonb)
- created_at (timestamp)
```

## CI/CD Integration

To run these tests in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Integration Tests
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
  run: |
    npm run dev &
    sleep 10
    npm test __tests__/integration
```

## Contributing

When adding new integration tests:

1. Always clean up test data in `afterAll`
2. Use descriptive test names
3. Test both success and error cases
4. Verify authentication requirements
5. Document any new environment variables
6. Update this README with new test coverage

## Related Documentation

- [Phase 4 Implementation Summary](../../PHASE_4_IMPLEMENTATION_SUMMARY.md)
- [Implementation Plan](../../IMPLEMENTATION_PLAN_BENCHMARK_ENHANCEMENT.md)
- [Benchmark API Documentation](../../docs/api/benchmarks.md)
