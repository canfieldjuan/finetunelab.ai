# AI Code Review System - Comprehensive Implementation Plan

**Project:** Enhanced AI Code Review System with UI Dashboard
**Start Date:** 2025-12-22
**Status:** Planning Phase - Awaiting Approval
**Database:** Separate Supabase Database Instance

---

## Executive Summary

Build a comprehensive code review system with:
- Automatic background checking (syntax, lint, security)
- Manual AI reviews via qwen2.5-coder:32b
- Persistent storage in dedicated Supabase database
- Separate UI dashboard for visualization
- Multi-worktree support (track 2-3 worktrees simultaneously)
- Diff analysis before code changes

---

## Current Infrastructure Verification

### ✅ Already Installed
- BullMQ v5.63.1 (job queue)
- ioredis v5.8.2 (Redis client)
- ESLint v9 with config at `eslint.config.mjs`
- TypeScript v5
- Supabase client v2.75.0
- Next.js v15.5.7

### ✅ Current Setup
- Main Supabase DB: `https://tkizlemssfmrfluychsn.supabase.co`
- Environment variables configured in `.env.local`
- Existing queue infrastructure in `app/api/distributed/`
- Git worktrees detected:
  1. `/home/juan-canfield/Desktop/web-ui` (main)
  2. `/home/juan-canfield/Desktop/analytics-traces-sdk-validation` (feature branch)
  3. `/home/juan-canfield/Desktop/unified-centralized-training-deployment` (feature branch)
  4. `/home/juan-canfield/Desktop/web-ui/worktrees/trace-feature-enhancement` (local worktree)

### ✅ Current AI Review Scripts
- `scripts/ollama-code-review.ts` - Basic AI review
- `scripts/ollama-code-review-interactive.ts` - Interactive auto-fix
- `scripts/watch-and-review.ts` - Real-time file watcher
- `scripts/check-syntax.ts` - TypeScript syntax validation

---

## Implementation Phases

---

## 📋 PHASE 1: Enhanced Checking & Storage (Days 1-5)

**Goal:** Add comprehensive automated checks and persistent storage

### 1.1 Database Setup

**New Supabase Database Required:**
- Create new project: `web-ui-code-review`
- Configure separate connection (isolate from main app DB)
- Add connection string to `.env.local`

**New Environment Variables:**
```bash
# Add to .env.local
CODE_REVIEW_SUPABASE_URL=https://[new-project].supabase.co
CODE_REVIEW_SUPABASE_ANON_KEY=[key]
CODE_REVIEW_SERVICE_ROLE_KEY=[key]
```

**Migration Files to Create:**

1. **`supabase/code_review_migrations/20251223000001_init_code_review_schema.sql`**
   ```sql
   -- Reviews table
   CREATE TABLE code_reviews (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     worktree_path TEXT NOT NULL,
     branch_name TEXT NOT NULL,
     git_commit_hash TEXT,
     review_type TEXT NOT NULL CHECK (review_type IN ('syntax', 'lint', 'ai', 'security', 'diff')),
     status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
     duration_ms INTEGER,
     files_checked INTEGER DEFAULT 0,
     metadata JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     completed_at TIMESTAMPTZ
   );

   -- Issues table
   CREATE TABLE code_issues (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     review_id UUID REFERENCES code_reviews(id) ON DELETE CASCADE,
     file_path TEXT NOT NULL,
     line_number INTEGER,
     column_number INTEGER,
     severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
     category TEXT NOT NULL,
     issue_type TEXT NOT NULL,
     description TEXT NOT NULL,
     code_snippet TEXT,
     suggested_fix TEXT,
     auto_fixable BOOLEAN DEFAULT FALSE,
     status TEXT DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'ignored', 'false_positive')),
     fixed_at TIMESTAMPTZ,
     fixed_by TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Worktrees table
   CREATE TABLE worktrees (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     path TEXT UNIQUE NOT NULL,
     branch_name TEXT NOT NULL,
     last_commit_hash TEXT,
     last_review_at TIMESTAMPTZ,
     active BOOLEAN DEFAULT TRUE,
     metadata JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Diff reviews table
   CREATE TABLE diff_reviews (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     worktree_id UUID REFERENCES worktrees(id) ON DELETE CASCADE,
     base_commit TEXT NOT NULL,
     head_commit TEXT NOT NULL,
     files_changed INTEGER,
     breaking_changes_count INTEGER DEFAULT 0,
     review_summary TEXT,
     breaking_changes JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Indexes
   CREATE INDEX idx_code_reviews_worktree ON code_reviews(worktree_path);
   CREATE INDEX idx_code_reviews_timestamp ON code_reviews(timestamp DESC);
   CREATE INDEX idx_code_reviews_status ON code_reviews(status);
   CREATE INDEX idx_code_issues_review ON code_issues(review_id);
   CREATE INDEX idx_code_issues_severity ON code_issues(severity);
   CREATE INDEX idx_code_issues_status ON code_issues(status);
   CREATE INDEX idx_code_issues_file ON code_issues(file_path);
   CREATE INDEX idx_worktrees_active ON worktrees(active);

   -- RLS Policies (enable for security)
   ALTER TABLE code_reviews ENABLE ROW LEVEL SECURITY;
   ALTER TABLE code_issues ENABLE ROW LEVEL SECURITY;
   ALTER TABLE worktrees ENABLE ROW LEVEL SECURITY;
   ALTER TABLE diff_reviews ENABLE ROW LEVEL SECURITY;

   -- Allow service role full access
   CREATE POLICY "Service role has full access to code_reviews"
     ON code_reviews FOR ALL
     USING (true)
     WITH CHECK (true);

   CREATE POLICY "Service role has full access to code_issues"
     ON code_issues FOR ALL
     USING (true)
     WITH CHECK (true);

   CREATE POLICY "Service role has full access to worktrees"
     ON worktrees FOR ALL
     USING (true)
     WITH CHECK (true);

   CREATE POLICY "Service role has full access to diff_reviews"
     ON diff_reviews FOR ALL
     USING (true)
     WITH CHECK (true);
   ```

**Files to Create:**

2. **`lib/code-review/database/client.ts`** (NEW)
   - Purpose: Supabase client for code review database
   - Dependencies: `@supabase/supabase-js`
   - Location: New directory structure
   ```typescript
   import { createClient } from '@supabase/supabase-js';

   // Separate client for code review database
   const supabaseUrl = process.env.CODE_REVIEW_SUPABASE_URL!;
   const supabaseKey = process.env.CODE_REVIEW_SERVICE_ROLE_KEY!;

   export const codeReviewDb = createClient(supabaseUrl, supabaseKey);
   ```

3. **`lib/code-review/database/types.ts`** (NEW)
   - TypeScript interfaces matching database schema
   - Enums for review_type, status, severity, category

4. **`lib/code-review/database/queries.ts`** (NEW)
   - CRUD operations for reviews, issues, worktrees
   - Type-safe query builders

### 1.2 Enhanced Checkers

**Files to Create:**

5. **`lib/code-review/checkers/eslint-checker.ts`** (NEW)
   - Purpose: Run ESLint and parse results
   - Uses existing `eslint.config.mjs`
   - Output: Structured issues array
   ```typescript
   import { ESLint } from 'eslint';

   export async function runESLintCheck(filePath: string): Promise<CodeIssue[]>
   ```

6. **`lib/code-review/checkers/security-checker.ts`** (NEW)
   - Purpose: Security scanning
   - Methods:
     - `checkNpmAudit()` - Run npm audit
     - `checkHardcodedSecrets()` - Regex patterns for API keys, tokens
     - `checkDependencyVulnerabilities()` - Check package versions

7. **`lib/code-review/checkers/typescript-checker.ts`** (NEW)
   - Purpose: Full TypeScript type checking
   - Extends existing `scripts/check-syntax.ts`
   - Output: Type errors with file locations

8. **`lib/code-review/checkers/performance-checker.ts`** (NEW)
   - Purpose: Basic performance checks
   - Methods:
     - Check for large bundle imports
     - Detect unused imports
     - Identify expensive operations in loops

**Files to Modify:**

9. **`scripts/check-syntax.ts`** (MODIFY)
   - **Insertion point:** After imports
   - **Change:** Export functions for reuse
   - **Verification:** Ensure no breaking changes to existing CLI usage
   ```typescript
   // ADD exports
   export async function checkSyntax(filePath: string): Promise<SyntaxResult>
   ```

### 1.3 Review Orchestrator

**Files to Create:**

10. **`lib/code-review/orchestrator/ReviewOrchestrator.ts`** (NEW)
    - Purpose: Coordinate all checks and store results
    - Methods:
      - `runFastChecks()` - Syntax, ESLint (1-2s)
      - `runMediumChecks()` - TypeScript, Security (5-10s)
      - `runAICheck()` - Call existing Ollama scripts (30-40s)
      - `saveResults()` - Store in database
    - Queue integration with BullMQ

11. **`lib/code-review/orchestrator/CheckQueue.ts`** (NEW)
    - Purpose: BullMQ queue for background checks
    - Queues:
      - `fast-checks` - High priority
      - `medium-checks` - Medium priority
      - `ai-checks` - Low priority (rate limited)
    - Worker processes

**Files to Modify:**

12. **`scripts/watch-and-review.ts`** (MODIFY)
    - **Insertion point:** In `reviewFile()` function, after syntax check
    - **Change:** Call ReviewOrchestrator instead of direct Ollama call
    - **Verification:** Test that watcher still works with new orchestrator
    ```typescript
    // REPLACE direct ollama call with:
    import { ReviewOrchestrator } from '../lib/code-review/orchestrator/ReviewOrchestrator';
    const orchestrator = new ReviewOrchestrator();
    await orchestrator.runChecks(filePath);
    ```

### 1.4 Data Persistence

**Files to Create:**

13. **`lib/code-review/storage/ReviewStorage.ts`** (NEW)
    - Purpose: Save/retrieve reviews from database
    - Methods:
      - `saveReview(review: CodeReview)`
      - `saveIssues(issues: CodeIssue[])`
      - `getRecentReviews(limit: number)`
      - `getIssuesByFile(filePath: string)`
      - `markIssueFixed(issueId: string)`

14. **`lib/code-review/storage/WorktreeTracker.ts`** (NEW)
    - Purpose: Track active worktrees
    - Methods:
      - `detectWorktrees()` - Parse `git worktree list`
      - `registerWorktree(path: string, branch: string)`
      - `getActiveWorktrees()`
      - `compareWorktrees(worktree1: string, worktree2: string)`

---

## 📊 PHASE 2: UI Dashboard (Days 6-12)

**Goal:** Build separate UI for visualizing code reviews

### 2.1 Separate Next.js App

**New Directory Structure:**
```
code-review-dashboard/
├── app/
│   ├── layout.tsx
│   ├── page.tsx           # Main dashboard
│   ├── reviews/
│   │   └── [id]/page.tsx  # Review detail view
│   ├── worktrees/
│   │   └── page.tsx       # Worktree comparison
│   └── api/
│       ├── reviews/route.ts
│       ├── issues/route.ts
│       └── worktrees/route.ts
├── components/
│   ├── Dashboard/
│   │   ├── IssueList.tsx
│   │   ├── SeverityChart.tsx
│   │   └── RecentReviews.tsx
│   ├── Worktrees/
│   │   ├── WorktreeCard.tsx
│   │   └── ComparisonView.tsx
│   └── shared/
│       ├── IssueBadge.tsx
│       └── CodeSnippet.tsx
├── lib/
│   └── api-client.ts      # API wrapper
├── package.json
├── tsconfig.json
└── next.config.ts
```

**Files to Create:**

15. **`code-review-dashboard/package.json`** (NEW)
    - Dependencies: Next.js, React, Tailwind, Recharts, Supabase client
    - Scripts: `dev`, `build`, `start`

16. **`code-review-dashboard/app/layout.tsx`** (NEW)
    - Root layout with sidebar navigation

17. **`code-review-dashboard/app/page.tsx`** (NEW)
    - Main dashboard showing:
      - Issue count by severity
      - Recent reviews timeline
      - Active worktrees
      - Quick actions

18. **`code-review-dashboard/components/Dashboard/IssueList.tsx`** (NEW)
    - Filterable list of issues
    - Actions: View, Fix, Ignore

19. **`code-review-dashboard/lib/api-client.ts`** (NEW)
    - Wrapper for Supabase queries
    - Real-time subscriptions

### 2.2 Real-Time Updates

**Technology:** Supabase Realtime

**Files to Create:**

20. **`code-review-dashboard/lib/realtime.ts`** (NEW)
    - Purpose: WebSocket connection to Supabase
    - Subscribe to table changes
    - Emit events for UI updates

21. **`code-review-dashboard/hooks/useRealtimeIssues.ts`** (NEW)
    - React hook for real-time issue updates
    - Auto-refresh on new reviews

### 2.3 API Routes

**Files to Create:**

22. **`code-review-dashboard/app/api/reviews/route.ts`** (NEW)
    - GET: List reviews with filters
    - POST: Trigger manual review

23. **`code-review-dashboard/app/api/issues/route.ts`** (NEW)
    - GET: List issues with filters
    - PATCH: Update issue status

24. **`code-review-dashboard/app/api/worktrees/route.ts`** (NEW)
    - GET: List active worktrees
    - POST: Register new worktree

---

## 🌲 PHASE 3: Multi-Worktree Support (Days 13-17)

**Goal:** Track and compare code across worktrees

### 3.1 Worktree Detection

**Files to Create:**

25. **`lib/code-review/worktree/detector.ts`** (NEW)
    - Purpose: Auto-detect git worktrees
    - Parse `git worktree list` output
    - Monitor for new/removed worktrees

26. **`lib/code-review/worktree/watcher.ts`** (NEW)
    - Purpose: Start file watchers for each worktree
    - Independent review queues per worktree
    - Avoid conflicts between worktrees

**Files to Modify:**

27. **`scripts/watch-and-review.ts`** (MODIFY)
    - **Insertion point:** At startup, before watching
    - **Change:** Accept `--worktree` flag to watch specific worktree
    - **Verification:** Test with multiple worktrees running simultaneously

### 3.2 Worktree Comparison

**Files to Create:**

28. **`lib/code-review/worktree/comparator.ts`** (NEW)
    - Purpose: Compare issues between worktrees
    - Methods:
      - `getNewIssues(branch1, branch2)`
      - `getFixedIssues(branch1, branch2)`
      - `getCommonIssues(branch1, branch2)`

29. **`code-review-dashboard/app/worktrees/page.tsx`** (NEW)
    - UI for worktree comparison
    - Side-by-side diff view
    - Issue delta display

### 3.3 Background Sync

**Files to Create:**

30. **`lib/code-review/workers/worktree-sync-worker.ts`** (NEW)
    - Purpose: BullMQ worker for syncing worktree data
    - Runs every 5 minutes
    - Updates worktree metadata in database

---

## 🔀 PHASE 4: Diff Analysis (Days 18-24)

**Goal:** Review git diffs for breaking changes

### 4.1 Diff Parser

**Files to Create:**

31. **`lib/code-review/diff/parser.ts`** (NEW)
    - Purpose: Parse git diff output
    - Extract:
      - Changed files
      - Added/removed lines
      - Function signatures
      - API changes

32. **`lib/code-review/diff/analyzer.ts`** (NEW)
    - Purpose: AI-powered diff analysis
    - Detect:
      - Breaking changes (API signature changes)
      - Removed public functions
      - Type changes
      - Impact on other files

**Example Prompt for AI:**
```typescript
const diffPrompt = `
Analyze this git diff for breaking changes:

${diff}

Report:
1. Breaking changes (removed/changed public APIs)
2. Type safety issues introduced
3. Files that may break due to these changes
4. Migration steps required
`;
```

### 4.2 Breaking Change Detection

**Files to Create:**

33. **`lib/code-review/diff/breaking-changes.ts`** (NEW)
    - Purpose: Identify breaking changes
    - Methods:
      - `findRemovedExports()`
      - `findChangedSignatures()`
      - `findTypeChanges()`
      - `estimateImpact()`

34. **`scripts/review-diff.ts`** (NEW)
    - CLI tool for diff review
    - Usage: `npm run review:diff HEAD~1..HEAD`
    - Output: Breaking changes report

### 4.3 Pre-Commit Integration

**Files to Modify:**

35. **`.git/hooks/pre-commit`** (MODIFY)
    - **Current:** Runs basic AI review
    - **Addition:** Add diff analysis before commit
    - **Verification:** Ensure hook can be bypassed with `--no-verify`
    ```bash
    # ADD after syntax check
    echo "🔀 Analyzing changes for breaking changes..."
    npx tsx scripts/review-diff.ts --staged
    ```

---

## 🚀 PHASE 5: Background Service & Optimization (Days 25-29)

**Goal:** Production-ready background processing

### 5.1 Queue System

**Files to Create:**

36. **`lib/code-review/queue/connection.ts`** (NEW)
    - Purpose: Redis connection for BullMQ
    - Connection pooling
    - Error handling

37. **`lib/code-review/queue/queues.ts`** (NEW)
    - Define all queues:
      - `code-review:fast` (syntax, lint)
      - `code-review:medium` (TS, security)
      - `code-review:ai` (Ollama reviews)
      - `code-review:diff` (diff analysis)

38. **`lib/code-review/workers/review-worker.ts`** (NEW)
    - Worker process for review queue
    - Process reviews in background
    - Rate limiting for AI calls

### 5.2 Rate Limiting

**Files to Create:**

39. **`lib/code-review/queue/rate-limiter.ts`** (NEW)
    - Purpose: Prevent GPU overload
    - Max concurrent AI reviews: 1-2
    - Queue backpressure handling

### 5.3 Service Management

**Files to Create:**

40. **`scripts/start-review-service.ts`** (NEW)
    - Start all background workers
    - Health checks
    - Graceful shutdown

41. **`package.json`** (MODIFY)
    - Add scripts:
      ```json
      {
        "review:service:start": "npx tsx scripts/start-review-service.ts",
        "review:service:stop": "pkill -f 'start-review-service'",
        "review:diff": "npx tsx scripts/review-diff.ts"
      }
      ```

---

## 📝 Configuration Files

### New Config Files to Create:

42. **`code-review.config.ts`** (NEW)
    ```typescript
    export const codeReviewConfig = {
      // Checkers
      enableSyntaxCheck: true,
      enableESLint: true,
      enableTypeScript: true,
      enableSecurity: true,
      enableAI: true,

      // Rate limits
      maxConcurrentAIReviews: 2,
      aiReviewDebounceMs: 2000,

      // File patterns
      watchPatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      ignorePatterns: ['node_modules/**', '.next/**', 'dist/**'],

      // Worktrees
      autoDetectWorktrees: true,
      maxWorktrees: 5,

      // Diff analysis
      diffAnalysisEnabled: true,
      breakingChangeThreshold: 'medium', // 'low' | 'medium' | 'high'
    };
    ```

---

## 🔍 Verification Checklist

### Before Starting Each Phase:

- [ ] **Verify Dependencies:** Check all required packages are installed
- [ ] **Check File Conflicts:** Ensure no files will be overwritten
- [ ] **Review Insertion Points:** Confirm exact line numbers for modifications
- [ ] **Test Current Functionality:** Ensure existing features work before changes
- [ ] **Backup Critical Files:** Create backups of files to be modified

### After Each Phase:

- [ ] **Run Tests:** Execute test suite to catch regressions
- [ ] **Manual Testing:** Test new features manually
- [ ] **Performance Check:** Ensure no performance degradation
- [ ] **Git Status:** Verify only intended files changed
- [ ] **Rollback Plan:** Document how to revert if issues arise

---

## 🚧 Potential Breaking Changes & Mitigation

### Phase 1:
**Risk:** New database client could conflict with existing Supabase usage
**Mitigation:** Use separate environment variables and client instance

### Phase 2:
**Risk:** Separate dashboard could have port conflicts
**Mitigation:** Run on different port (3001) than main app (3000)

### Phase 3:
**Risk:** Multiple file watchers could cause high CPU usage
**Mitigation:** Implement debouncing and max watcher limit

### Phase 4:
**Risk:** Pre-commit hook changes could block commits
**Mitigation:** Add `--no-verify` bypass option, timeout after 30s

### Phase 5:
**Risk:** Background workers could consume too much memory
**Mitigation:** Memory limits, queue size caps, worker scaling

---

## 📊 Dependencies to Add

```json
{
  "dependencies": {
    // Most already installed, verify versions:
    "bullmq": "^5.63.1",  // ✅ Already installed
    "ioredis": "^5.8.2",  // ✅ Already installed

    // May need to add:
    "simple-git": "^3.21.0",  // For git operations
    "recharts": "^2.10.0",    // For dashboard charts
    "sonner": "^1.3.1"        // For toast notifications (check version)
  }
}
```

---

## 🎯 Success Criteria

### Phase 1 Complete When:
- [ ] All checks run and save to database
- [ ] File watcher stores results persistently
- [ ] No breaking changes to existing scripts

### Phase 2 Complete When:
- [ ] Dashboard displays real-time issues
- [ ] Can filter by severity, file, worktree
- [ ] Actions (fix, ignore) work

### Phase 3 Complete When:
- [ ] All worktrees auto-detected
- [ ] Independent watchers per worktree
- [ ] Comparison view shows deltas

### Phase 4 Complete When:
- [ ] Diff analysis detects breaking changes
- [ ] Pre-commit hook blocks on critical issues
- [ ] Migration suggestions provided

### Phase 5 Complete When:
- [ ] Background service runs reliably
- [ ] Queue system handles load
- [ ] No memory/CPU issues

---

## 📋 Files Summary

### New Files: 41
### Modified Files: 4
### Migration Files: 1

**Total Implementation Estimate:** 25-30 days
**Complexity:** High (database design, queue system, UI)
**Risk Level:** Medium (many integration points)

---

## 🔄 Next Steps (Awaiting Approval)

1. **Review this plan** for accuracy and completeness
2. **Approve database schema** for code review DB
3. **Confirm phasing priority** (can adjust order)
4. **Begin Phase 1** implementation
5. **Create progress tracking** in separate log file

---

## ❓ Questions for Decision

1. **Redis Instance:** Use existing Redis or spin up separate instance for code review queues?
2. **Dashboard Port:** Run code-review-dashboard on port 3001?
3. **Storage Location:** Store code review DB migrations in main repo or separate?
4. **AI Model:** Continue using qwen2.5-coder:32b or explore other models for diff analysis?
5. **Notification:** Add Slack/Discord webhooks for critical issues?

---

**Status:** ⏸️ AWAITING APPROVAL
**Last Updated:** 2025-12-22
**Next Review:** After approval
