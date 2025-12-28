# Code Review System - Verification Checklist

**Purpose:** Ensure no breaking changes during implementation
**Review Before:** Every code modification
**Update After:** Each phase completion

---

## Pre-Implementation Verification

### ✅ Current System Verification (Completed 2025-12-22)

**Existing Features Tested:**
- [x] `npm run review:ai` - Works ✅
- [x] `npm run review:ai:interactive` - Works ✅
- [x] `npm run review:ai:watch` - Works ✅
- [x] Syntax checking script - Works ✅
- [x] Pre-commit hook - Exists at `.git/hooks/pre-commit` ✅
- [x] ESLint configuration - Exists at `eslint.config.mjs` ✅

**Infrastructure Verified:**
- [x] BullMQ installed (v5.63.1) ✅
- [x] ioredis installed (v5.8.2) ✅
- [x] Supabase client installed (v2.75.0) ✅
- [x] TypeScript installed (v5) ✅
- [x] Next.js installed (v15.5.7) ✅

**Git Worktrees Detected:**
- [x] 4 worktrees found ✅
- [x] All worktrees accessible ✅

**Environment Variables Present:**
- [x] `NEXT_PUBLIC_SUPABASE_URL` ✅
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
- [x] `SUPABASE_SERVICE_ROLE_KEY` ✅

**Files That Must Not Be Deleted:**
- [x] `scripts/ollama-code-review.ts` - In use ✅
- [x] `scripts/ollama-code-review-interactive.ts` - In use ✅
- [x] `scripts/watch-and-review.ts` - In use ✅
- [x] `scripts/check-syntax.ts` - In use ✅
- [x] `.git/hooks/pre-commit` - In use ✅

---

## Phase 1: Enhanced Checking & Storage

### Pre-Phase Checks
- [ ] Backup `.env.local` file
- [ ] Document current Supabase tables
- [ ] Test current review scripts work
- [ ] Verify Redis connection available
- [ ] Check disk space for new database

### During Implementation
- [ ] **Before modifying `scripts/check-syntax.ts`:**
  - [ ] Run test: `npx tsx scripts/check-syntax.ts test-file.ts`
  - [ ] Verify output format
  - [ ] Document current behavior
  - [ ] Create backup: `cp scripts/check-syntax.ts scripts/check-syntax.ts.backup`

- [ ] **Before modifying `scripts/watch-and-review.ts`:**
  - [ ] Test watcher works: `npm run review:ai:watch`
  - [ ] Document current file watcher behavior
  - [ ] Create backup: `cp scripts/watch-and-review.ts scripts/watch-and-review.ts.backup`

- [ ] **After creating new database client:**
  - [ ] Test connection to new Supabase project
  - [ ] Verify no conflicts with existing client
  - [ ] Test queries work

- [ ] **After creating ReviewOrchestrator:**
  - [ ] Test standalone (without integration)
  - [ ] Verify all checkers work independently
  - [ ] Test error handling

### Integration Verification
- [ ] **Modified `scripts/watch-and-review.ts`:**
  - [ ] Test file change detection still works
  - [ ] Verify syntax check still runs
  - [ ] Confirm AI review still runs
  - [ ] Check results saved to database
  - [ ] Verify terminal output unchanged

- [ ] **Database persistence:**
  - [ ] Verify reviews saved correctly
  - [ ] Check issues saved with correct foreign keys
  - [ ] Confirm indexes created
  - [ ] Test RLS policies work

### Post-Phase Validation
- [ ] All existing scripts still work:
  - [ ] `npm run review:ai <file>` ✅ / ❌
  - [ ] `npm run review:ai:interactive <file>` ✅ / ❌
  - [ ] `npm run review:ai:watch` ✅ / ❌
- [ ] Pre-commit hook unchanged ✅ / ❌
- [ ] No new errors in console ✅ / ❌
- [ ] Database migrations applied ✅ / ❌
- [ ] Performance not degraded ✅ / ❌

### Rollback Plan
**If Phase 1 fails:**
1. Restore backup files:
   ```bash
   cp scripts/check-syntax.ts.backup scripts/check-syntax.ts
   cp scripts/watch-and-review.ts.backup scripts/watch-and-review.ts
   ```
2. Remove new database tables (won't affect main app)
3. Remove new environment variables
4. Delete new files in `lib/code-review/`

---

## Phase 2: UI Dashboard

### Pre-Phase Checks
- [ ] Phase 1 complete and verified
- [ ] Port 3001 available
- [ ] Database contains sample data for testing

### During Implementation
- [ ] **Separate Next.js app:**
  - [ ] Initialized in separate directory
  - [ ] Does not conflict with main app
  - [ ] Uses separate port (3001)

### Integration Verification
- [ ] **API routes:**
  - [ ] Can query database
  - [ ] Real-time updates work
  - [ ] No CORS issues

### Post-Phase Validation
- [ ] Main app still works on port 3000 ✅ / ❌
- [ ] Dashboard accessible on port 3001 ✅ / ❌
- [ ] Real-time updates functional ✅ / ❌
- [ ] No impact on main app performance ✅ / ❌

### Rollback Plan
**If Phase 2 fails:**
1. Stop dashboard: `pkill -f code-review-dashboard`
2. Main app unaffected (separate codebase)
3. Delete `code-review-dashboard/` directory

---

## Phase 3: Multi-Worktree Support

### Pre-Phase Checks
- [ ] Phase 2 complete and verified
- [ ] All worktrees accessible
- [ ] Test with 2-3 worktrees active

### During Implementation
- [ ] **Before modifying watcher again:**
  - [ ] Backup current working version
  - [ ] Test with single worktree first
  - [ ] Gradually add multi-worktree support

### Integration Verification
- [ ] **Independent watchers:**
  - [ ] Each worktree has separate watcher
  - [ ] No file conflicts between worktrees
  - [ ] Database stores worktree path correctly

### Post-Phase Validation
- [ ] Single worktree mode still works ✅ / ❌
- [ ] Multiple watchers run independently ✅ / ❌
- [ ] Comparison view shows correct data ✅ / ❌
- [ ] No CPU/memory issues with multiple watchers ✅ / ❌

### Rollback Plan
**If Phase 3 fails:**
1. Revert watcher to Phase 2 version
2. Disable worktree detection
3. Use single worktree mode only

---

## Phase 4: Diff Analysis

### Pre-Phase Checks
- [ ] Phase 3 complete and verified
- [ ] Git operations work in all worktrees
- [ ] Can generate test diffs

### During Implementation
- [ ] **Before modifying pre-commit hook:**
  - [ ] Backup: `cp .git/hooks/pre-commit .git/hooks/pre-commit.backup`
  - [ ] Test can bypass with `--no-verify`
  - [ ] Add timeout (30s max)

### Integration Verification
- [ ] **Pre-commit hook:**
  - [ ] Syntax check still runs
  - [ ] AI review still runs
  - [ ] Diff analysis runs
  - [ ] Can bypass with `--no-verify`
  - [ ] Timeout works (doesn't block forever)

### Post-Phase Validation
- [ ] Can still commit without issues ✅ / ❌
- [ ] Diff analysis detects breaking changes ✅ / ❌
- [ ] `--no-verify` bypass works ✅ / ❌
- [ ] No false positives ✅ / ❌

### Rollback Plan
**If Phase 4 fails:**
1. Restore pre-commit hook:
   ```bash
   cp .git/hooks/pre-commit.backup .git/hooks/pre-commit
   ```
2. Remove diff analysis scripts
3. Use manual diff review only

---

## Phase 5: Background Service

### Pre-Phase Checks
- [ ] Phase 4 complete and verified
- [ ] Redis connection stable
- [ ] Queue system tested independently

### During Implementation
- [ ] **Background workers:**
  - [ ] Test worker processes independently
  - [ ] Verify graceful shutdown
  - [ ] Check memory limits work

### Integration Verification
- [ ] **Queue system:**
  - [ ] Jobs enqueue correctly
  - [ ] Workers process jobs
  - [ ] Failed jobs retry
  - [ ] Dead letter queue works

### Post-Phase Validation
- [ ] Manual reviews still work ✅ / ❌
- [ ] Background reviews process ✅ / ❌
- [ ] No memory leaks ✅ / ❌
- [ ] CPU usage acceptable ✅ / ❌
- [ ] Graceful shutdown works ✅ / ❌

### Rollback Plan
**If Phase 5 fails:**
1. Stop background service
2. Use manual review mode only
3. Clear Redis queues
4. Revert to Phase 4 state

---

## Critical Files - Do Not Delete

**Scripts:**
- `scripts/ollama-code-review.ts`
- `scripts/ollama-code-review-interactive.ts`
- `scripts/watch-and-review.ts`
- `scripts/check-syntax.ts`

**Config:**
- `.git/hooks/pre-commit`
- `eslint.config.mjs`
- `tsconfig.json`

**Environment:**
- `.env.local`
- `.env`

**Database:**
- All files in `supabase/migrations/`

---

## Files Safe to Modify (With Backups)

**Can modify WITH BACKUP:**
- `scripts/check-syntax.ts` (export functions)
- `scripts/watch-and-review.ts` (integrate orchestrator)
- `.git/hooks/pre-commit` (add diff analysis)
- `package.json` (add scripts)

**Modification Rules:**
1. Create `.backup` copy first
2. Test in isolation before integration
3. Verify no breaking changes
4. Keep rollback plan ready

---

## Testing Requirements

### Unit Tests
- [ ] ESLint checker
- [ ] Security checker
- [ ] TypeScript checker
- [ ] Diff parser
- [ ] Breaking change detector

### Integration Tests
- [ ] ReviewOrchestrator with all checkers
- [ ] Database persistence
- [ ] Queue system
- [ ] Multi-worktree detection

### E2E Tests
- [ ] Full review workflow
- [ ] Dashboard UI
- [ ] Real-time updates
- [ ] Pre-commit hook

### Performance Tests
- [ ] Review speed (target: <40s)
- [ ] Database query speed
- [ ] Queue throughput
- [ ] Memory usage under load

---

## Sign-Off Checklist

**After Each Phase:**
- [ ] All tests pass
- [ ] No breaking changes detected
- [ ] Performance within targets
- [ ] Documentation updated
- [ ] Progress log updated
- [ ] Rollback plan tested
- [ ] User approval obtained

**Before Next Phase:**
- [ ] Previous phase verified
- [ ] Backup files created
- [ ] Dependencies checked
- [ ] Conflicts resolved

---

**Last Updated:** 2025-12-22
**Current Phase:** Planning
**Next Review:** Before Phase 1 start
