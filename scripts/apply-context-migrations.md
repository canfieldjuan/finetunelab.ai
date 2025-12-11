# Apply Context Injection Migrations (Phase 1)

**Migration Files:**
1. `supabase/migrations/20251024000009_create_user_profiles.sql`
2. `supabase/migrations/20251024000010_create_user_activity.sql`
3. `supabase/migrations/20251024000011_create_context_logs.sql`

**Date:** 2025-10-24

---

## Option 1: Apply via Supabase Dashboard (Recommended)

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to: https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Apply Migration 1: user_profiles**
   - Open file: `supabase/migrations/20251024000009_create_user_profiles.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run"
   - Wait for success message

4. **Apply Migration 2: user_activity**
   - Open file: `supabase/migrations/20251024000010_create_user_activity.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run"
   - Wait for success message

5. **Apply Migration 3: context_injection_logs**
   - Open file: `supabase/migrations/20251024000011_create_context_logs.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run"
   - Wait for success message

6. **Verify All Tables**
   ```bash
   npx tsx scripts/verify-context-migrations.ts
   ```

---

## Option 2: Apply via Supabase CLI

### Prerequisites:
```bash
# Install Supabase CLI if not already installed
npm install -g supabase
```

### Steps:

1. **Link to Project** (if not already linked)
   ```bash
   supabase link --project-ref your-project-ref
   ```

2. **Apply All Migrations**
   ```bash
   supabase db push
   ```

3. **Verify**
   ```bash
   npx tsx scripts/verify-context-migrations.ts
   ```

---

## What These Migrations Create

### Table 1: user_profiles
**Purpose:** Store essential user information for context injection

**Columns:**
- `id` - Primary key
- `user_id` - Foreign key to auth.users (unique)
- `full_name` - User's full name
- `display_name` - Display name
- `timezone` - User timezone (default: UTC)
- `locale` - User locale (default: en-US)
- `role` - User role/title
- `company` - Company name
- `department` - Department
- `preferred_response_length` - concise/balanced/detailed
- `code_style_preference` - Coding style
- `expertise_level` - beginner/intermediate/advanced
- `created_at`, `updated_at` - Timestamps

**Features:**
- RLS enabled (users can only view/edit their own profile)
- Auto-creates profile for new users on signup
- Auto-updates `updated_at` timestamp
- Indexes on user_id and created_at

**Token Budget:** ~35 tokens per user

---

### Table 2: user_activity
**Purpose:** Track recent user actions for contextual awareness

**Columns:**
- `id` - Primary key
- `user_id` - Foreign key to auth.users
- `activity_type` - file_edit/conversation/tool_use/page_view
- `resource_type` - Type of resource (file, conversation, project)
- `resource_id` - ID of the resource
- `resource_name` - Name of the resource
- `metadata` - JSONB for flexible context data
- `created_at` - Timestamp

**Features:**
- RLS enabled (users can only view/insert their own activity)
- Indexes on (user_id, created_at) and (user_id, activity_type)
- Cleanup function: `cleanup_old_activity()` deletes records >30 days old

**Token Budget:** 0-100 tokens (conditional injection)

---

### Table 3: context_injection_logs
**Purpose:** Track what context was injected and measure effectiveness

**Columns:**
- `id` - Primary key (UUID)
- `user_id` - Foreign key to auth.users (UUID, NOT NULL)
- `conversation_id` - Conversation ID (TEXT, nullable)
- `message_id` - Message ID (TEXT, nullable)
- `context_types` - Array of context types injected
- `estimated_tokens` - Estimated token count
- `actual_input_tokens` - Actual tokens from LLM response
- `was_relevant` - Effectiveness flag
- `created_at` - Timestamp

**Note:** conversation_id and message_id use TEXT type (not UUID) for maximum compatibility and are nullable since context may be gathered before message creation.

**Features:**
- RLS enabled (users can only view their own logs)
- GIN index on context_types array for fast searching
- Indexes on (user_id, created_at) and (conversation_id, created_at)

**Token Budget:** None (tracking only)

---

## Verification Queries

After applying migrations, run these to verify:

**1. Check all tables exist:**
```sql
SELECT tablename
FROM pg_tables
WHERE tablename IN ('user_profiles', 'user_activity', 'context_injection_logs')
ORDER BY tablename;
```

**2. Check RLS is enabled:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('user_profiles', 'user_activity', 'context_injection_logs')
ORDER BY tablename;
```
All should show: `rowsecurity = true`

**3. Check policies:**
```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('user_profiles', 'user_activity', 'context_injection_logs')
ORDER BY tablename, policyname;
```

**4. Check indexes:**
```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename IN ('user_profiles', 'user_activity', 'context_injection_logs')
ORDER BY tablename, indexname;
```

---

## Expected Output

After successful migration of all three tables:

```
CREATE TABLE
CREATE INDEX
CREATE INDEX
ALTER TABLE
CREATE POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
CREATE FUNCTION
CREATE TRIGGER
COMMENT
COMMENT
...
NOTICE:  === User Profiles Table Created ===
NOTICE:  === User Activity Table Created ===
NOTICE:  === Context Injection Logs Table Created ===
```

---

## Rollback (If Needed)

If you need to undo these migrations:

```sql
-- Drop all three tables and dependencies
DROP TABLE IF EXISTS context_injection_logs CASCADE;
DROP TABLE IF EXISTS user_activity CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS cleanup_old_activity CASCADE;
DROP FUNCTION IF EXISTS update_user_profiles_updated_at CASCADE;
DROP FUNCTION IF EXISTS create_user_profile_on_signup CASCADE;
```

---

## Common Issues

### Issue: "relation already exists"
**Cause:** Migration already applied
**Solution:** Table already exists, no action needed

### Issue: "permission denied"
**Cause:** Insufficient database permissions
**Solution:** Use Supabase Dashboard (has full permissions)

### Issue: "foreign key constraint violation"
**Cause:** Referenced tables don't exist
**Solution:** Ensure `auth.users`, `conversations`, `messages` tables exist first

---

## Next Steps After Migration

1. ✅ Verify all tables exist: `npx tsx scripts/verify-context-migrations.ts`
2. ✅ Phase 2: Build context provider service types
3. ✅ Phase 2: Implement essential context fetchers
4. ✅ Phase 3: Integrate with Chat API
5. ✅ Test context injection in production

---

## Token Budget Summary

| Table | Token Budget | Usage |
|-------|-------------|-------|
| user_profiles | ~35 tokens | Always injected |
| user_activity | 0-100 tokens | Conditional |
| context_injection_logs | 0 tokens | Tracking only |
| **Total** | **35-135 tokens** | **Per message** |

This is well within the 500-token target for context injection.

---

## Support

If migration fails:
1. Check Supabase Dashboard for error messages
2. Verify you have admin permissions
3. Check database logs in Supabase
4. Ensure referenced tables exist (auth.users, conversations, messages)
5. Try Option 1 (Dashboard) if CLI fails
