# Dataset Manager - Testing Guide

**Date:** October 21, 2025

## Test Configuration

The `dataset-manager` tool tests require a valid user ID to run. This ensures tests run against real data structures and respect security policies.

### Setting Up Tests

1. **Add TEST_USER_ID to your `.env` file:**

```bash
# In C:/Users/Juan/Desktop/Dev_Ops/web-ui/.env
TEST_USER_ID=your-actual-user-uuid-here
```

2. **Get your user UUID:**

You can find your user UUID in several ways:

**Option A: From Supabase Dashboard**
- Go to your Supabase project → Authentication → Users
- Find your user and copy the UUID

**Option B: From database query**
```sql
SELECT id, email FROM auth.users LIMIT 5;
```

**Option C: From an existing conversation**
```sql
SELECT DISTINCT user_id FROM conversations LIMIT 1;
```

### Running Tests

Once `TEST_USER_ID` is set, run the tests:

```bash
# Basic functionality tests
npx tsx lib/tools/dataset-manager/test.ts

# Delete and merge tests
npx tsx lib/tools/dataset-manager/test-delete-merge.ts
```

### What Changed

**Before (v1.0.0):**
- Tests used hardcoded dummy UUID: `00000000-0000-0000-0000-000000000000`
- This didn't work with RLS policies
- Required special test policies in database

**After (v2.0.0):**
- Tests use real user UUID from environment variable
- Works with production RLS policies
- Tests run against your actual user account
- More realistic testing scenario

### Security Note

The `user_id` parameter is now **required** for all operations. This ensures:
- Proper ownership verification
- RLS policy compliance
- No accidental cross-user data access
- Production-ready security from the start

### Test Data Cleanup

The delete/merge tests create temporary conversations and automatically clean them up:

```typescript
// Created during test:
- 3 test conversations with titles "Conversation 1", "Conversation 2", "Conversation 3"
- 4 test messages across these conversations

// Cleaned up at end:
- All test conversations deleted
- All test messages removed
- All test evaluations cleared
```

### Example .env Configuration

```bash
# Required for Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Required for tests
TEST_USER_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Optional: Your actual user ID if different
USER_ID=your-production-user-id
```

### Error Messages

If `TEST_USER_ID` is not set, you'll see:

```
❌ FATAL: TEST_USER_ID environment variable is required
Please set TEST_USER_ID to a valid user UUID in your .env file
Example: TEST_USER_ID=your-user-uuid-here
```

Solution: Add `TEST_USER_ID` to your `.env` file and restart the test.

### Production Usage

In production, the tool will receive the `user_id` from:
- Authenticated session (from JWT token)
- API request parameters
- Service layer that manages user context

The tool no longer has a fallback dummy user ID - this is intentional for security.

