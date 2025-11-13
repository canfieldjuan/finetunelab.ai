# Batch Testing API Key Removal - Implementation Plan

**Date:** 2025-10-31  
**Feature:** Remove API key requirement from batch testing workflow  
**Goal:** Improve UX by using session token authentication instead of requiring API key management

---

## Investigation Summary

### Current Architecture
- Batch testing requires users to create and manage API keys
- API key is sent to `/api/chat` via `X-API-Key` header
- Purpose: Authenticate user, bypass RLS, link conversations to user_id
- Architecture borrowed from widget embedding use case

### Root Cause
- Batch testing makes **server-side calls** to `/api/chat` (no browser session)
- Original widget design: External websites need API key for authentication
- Batch testing piggybacks on widget infrastructure

### Why It Breaks User Flow
1. User must navigate to Secrets page
2. Create API key manually
3. Copy/paste key into batch testing form
4. Remember to keep key active
5. Extra complexity for internal feature

### Widget vs Batch Testing Comparison
| Feature | Widget (External) | Batch Testing (Internal) |
|---------|------------------|--------------------------|
| Context | External website embedding | Internal authenticated user |
| Auth | API key (no session) | Already has session token |
| User ID | From API key lookup | From session token |
| RLS Bypass | Needed (service role) | Needed (service role) |
| API Key Required? | YES (no other auth) | NO (has session token) |

---

## Solution: Option 1 - Dual Authentication Path

### Design
Add session token authentication to `/api/chat` **alongside** existing API key auth:

```
/api/chat Authentication:
├── Widget Mode: X-API-Key header → validateApiKey() → userId
└── Batch Test Mode: Authorization: Bearer → session.getUser() → userId
```

**Both paths converge** to same behavior: Use service role, bypass RLS, create conversation.

### Why This Approach
- ✅ No breaking changes to widget functionality
- ✅ Minimal code modifications
- ✅ Reuses existing `/api/chat` endpoint
- ✅ Better UX for batch testing
- ✅ Still secure (session-based auth)
- ✅ Backward compatible

---

## Phased Implementation Plan

### **Phase 1: Investigation & Validation** ✅ COMPLETED

**Status:** Complete  
**Date:** 2025-10-31

**Tasks Completed:**
- [x] Traced API key usage in batch testing
- [x] Identified all files requiring changes
- [x] Verified widget mode won't be affected
- [x] Documented current architecture
- [x] Created implementation plan

**Files Analyzed:**
- `app/api/batch-testing/run/route.ts` - API key requirement check
- `app/api/chat/route.ts` - Widget mode detection
- `lib/auth/api-key-validator.ts` - API key validation logic
- `components/training/BatchTesting.tsx` - User input collection

**Key Findings:**
- Widget mode triggered by `X-API-Key` header presence
- Batch testing already has session token in `Authorization` header
- No overlap between widget and batch test auth paths
- Safe to add session auth without breaking widgets

---

### **Phase 2: Backend API Modifications**

**Status:** Not started  
**Estimated Time:** 1-2 hours

#### Task 2.1: Modify /api/chat to Support Session Auth

**File:** `app/api/chat/route.ts`

**Current Code (lines 74-103):**
```typescript
const apiKey = req.headers.get('X-API-Key');
isWidgetMode = !!(apiKey && widgetSessionId);

if (isWidgetMode && apiKey) {
  const validationResult = await validateApiKey(apiKey);
  if (!validationResult.isValid || !validationResult.userId) {
    return new Response(JSON.stringify({ error: ... }), { status: 401 });
  }
  userId = validationResult.userId;
}
```

**Changes Needed:**
1. Add batch test mode detection
2. Extract userId from session token
3. Keep widget mode unchanged
4. Use service role for both modes

**New Logic:**
```typescript
const apiKey = req.headers.get('X-API-Key');
const authHeader = req.headers.get('Authorization');
const isBatchTestMode = !!(widgetSessionId && authHeader && !apiKey);
isWidgetMode = !!(apiKey && widgetSessionId);

if (isWidgetMode && apiKey) {
  // EXISTING: Widget mode with API key
  const validationResult = await validateApiKey(apiKey);
  // ... existing code
} else if (isBatchTestMode && authHeader) {
  // NEW: Batch test mode with session token
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
  }
  
  userId = user.id;
  
  // Use service role for RLS bypass (same as widget mode)
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
}
```

**Validation Points:**
- [ ] Widget mode still works (X-API-Key path unchanged)
- [ ] Batch test mode authenticates via session
- [ ] Both modes use service role for DB operations
- [ ] Error handling for invalid session
- [ ] No breaking changes to existing behavior

**Test Cases:**
1. Widget request with X-API-Key → Widget mode (existing)
2. Batch test with Authorization header → Batch test mode (new)
3. Normal chat request (no special headers) → Normal mode (existing)
4. Invalid session token → 401 error
5. Both X-API-Key and Authorization → Widget mode takes precedence

---

#### Task 2.2: Remove API Key Requirement from Batch Testing API

**File:** `app/api/batch-testing/run/route.ts`

**Lines to Modify:**

**Line 77-81 (Remove validation):**
```typescript
// DELETE THIS:
if (!config.widget_api_key) {
  return NextResponse.json(
    { error: 'Missing config.widget_api_key (required for batch testing)' },
    { status: 400 }
  );
}
```

**Line 88 (Remove from config):**
```typescript
// BEFORE:
const batchConfig: BatchTestConfig = {
  model_name: config.model_id,
  huggingface_api_key: config.widget_api_key, // REMOVE THIS
  prompt_limit: config.prompt_limit || 25,
  // ...
};

// AFTER:
const batchConfig: BatchTestConfig = {
  model_name: config.model_id,
  prompt_limit: config.prompt_limit || 25,
  // ...
};
```

**Line 280 & 378 (Update function signature & calls):**
```typescript
// BEFORE:
async function processSinglePrompt(
  testRunId: string,
  modelId: string,
  prompt: string,
  widgetApiKey: string,  // REMOVE
  promptIndex: number,
  runId: string | null,
  benchmarkId?: string
): Promise<boolean>

// AFTER:
async function processSinglePrompt(
  testRunId: string,
  modelId: string,
  prompt: string,
  authHeader: string,  // ADD (session token)
  promptIndex: number,
  runId: string | null,
  benchmarkId?: string
): Promise<boolean>
```

**Line 289-295 (Update batch processing call):**
```typescript
// BEFORE:
const batchPromises = batch.map((prompt, batchIndex) =>
  processSinglePrompt(
    testRunId,
    config.model_name,
    prompt,
    config.huggingface_api_key!,  // REMOVE
    i + batchIndex,
    runId,
    config.benchmark_id
  )
);

// AFTER:
const batchPromises = batch.map((prompt, batchIndex) =>
  processSinglePrompt(
    testRunId,
    config.model_name,
    prompt,
    authHeader,  // Pass from parent scope
    i + batchIndex,
    runId,
    config.benchmark_id
  )
);
```

**Line 394-399 (Update fetch headers):**
```typescript
// BEFORE:
const response = await fetch(`${baseUrl}/api/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': widgetApiKey  // REMOVE
  },

// AFTER:
const response = await fetch(`${baseUrl}/api/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': authHeader  // ADD
  },
```

**Additional Changes:**
- Line 256: Update `processBackgroundBatch` signature to accept `authHeader`
- Line 234: Pass `authHeader` from request to background function

**Validation Points:**
- [ ] Auth header passed through entire call chain
- [ ] No references to widget_api_key remain
- [ ] processSinglePrompt uses Authorization header
- [ ] Background batch processing receives auth token

---

#### Task 2.3: Update Type Definitions

**File:** `lib/batch-testing/types.ts`

**Current Interface:**
```typescript
export interface BatchTestConfig {
  model_name: string;
  huggingface_api_key?: string;  // REMOVE
  prompt_limit?: number;
  concurrency?: number;
  delay_ms?: number;
  source_path?: string;
  benchmark_id?: string;
}
```

**Updated Interface:**
```typescript
export interface BatchTestConfig {
  model_name: string;
  // huggingface_api_key removed - no longer needed
  prompt_limit?: number;
  concurrency?: number;
  delay_ms?: number;
  source_path?: string;
  benchmark_id?: string;
}
```

**Validation Points:**
- [ ] TypeScript compilation succeeds
- [ ] No type errors in batch testing files
- [ ] Interface matches actual usage

---

### **Phase 3: Frontend UI Modifications**

**Status:** Not started  
**Estimated Time:** 30 minutes

#### Task 3.1: Remove API Key Input from Batch Testing UI

**File:** `components/training/BatchTesting.tsx`

**Current State (need to verify exact lines):**
- Component likely has API key input field
- State variable for storing API key
- Validation for API key presence

**Changes Needed:**
1. Find and remove API key input field
2. Remove state variable (e.g., `widgetApiKey`)
3. Remove from config object sent to API
4. Update form validation

**Search Patterns:**
```bash
# Find API key references in component
grep -n "api_key\|apiKey\|widget_api_key" components/training/BatchTesting.tsx
```

**Before Removal - Verify:**
- [ ] Locate exact line numbers for API key input
- [ ] Check if used in multiple places
- [ ] Identify state management (useState, etc.)
- [ ] Find validation logic

**After Removal - Validate:**
- [ ] Component compiles without errors
- [ ] Form submits without API key field
- [ ] No broken references to removed state
- [ ] UI looks clean (no gap where input was)

---

#### Task 3.2: Update User Documentation

**Files to Update:**
- Any inline help text mentioning API keys
- Tooltips or info icons
- Error messages

**Changes:**
- Remove mentions of "API key required"
- Update any instructional text
- Simplify batch testing setup docs

---

### **Phase 4: Testing & Validation**

**Status:** Not started  
**Estimated Time:** 1 hour

#### Test 4.1: Widget Mode (Regression Test)

**Purpose:** Ensure widget functionality unchanged

**Test Cases:**
1. **External Widget with API Key**
   ```javascript
   fetch('/api/chat', {
     headers: {
       'X-API-Key': 'user_abc123_...',
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       messages: [...],
       widgetSessionId: 'widget_123'
     })
   })
   ```
   - Expected: Widget mode activated
   - Expected: API key validated
   - Expected: Conversation created with widget_session_id
   - Expected: No errors

2. **Invalid Widget API Key**
   - Expected: 401 Unauthorized
   - Expected: Error message returned

**Validation:**
- [ ] Widget mode still uses X-API-Key
- [ ] API key validation works
- [ ] Conversations created correctly
- [ ] No breaking changes

---

#### Test 4.2: Batch Testing (New Flow)

**Purpose:** Verify session-based authentication works

**Test Cases:**
1. **Batch Test with Session Token**
   ```typescript
   // User already logged in, has session
   POST /api/batch-testing/run
   Headers: {
     Authorization: Bearer <session_token>
   }
   Body: {
     config: {
       model_id: 'gpt-4',
       dataset_id: 'dataset_123',
       // NO widget_api_key
     }
   }
   ```
   - Expected: Batch test starts
   - Expected: Messages sent to /api/chat with Authorization header
   - Expected: Conversations created
   - Expected: No API key errors

2. **Batch Test without Session**
   - Expected: 401 Unauthorized
   - Expected: Clear error message

3. **Batch Test with Invalid Session**
   - Expected: 401 Unauthorized
   - Expected: Session validation fails gracefully

**Validation:**
- [ ] Batch testing works without API key
- [ ] Session authentication successful
- [ ] Messages processed correctly
- [ ] Results saved to database
- [ ] No errors in console

---

#### Test 4.3: Normal Chat (Regression Test)

**Purpose:** Ensure regular chat unaffected

**Test Cases:**
1. **Regular Chat Request (No Special Headers)**
   ```typescript
   POST /api/chat
   Body: {
     messages: [...],
     modelId: 'gpt-4'
     // No widgetSessionId, no special auth
   }
   ```
   - Expected: Normal mode
   - Expected: Works as before
   - Expected: No widget/batch test mode triggered

**Validation:**
- [ ] Regular chat unchanged
- [ ] No unintended mode activation
- [ ] Normal user flow works

---

#### Test 4.4: Edge Cases

**Test Cases:**
1. **Both X-API-Key and Authorization Present**
   - Expected: Widget mode takes precedence (existing behavior)
   
2. **widgetSessionId with Authorization but no X-API-Key**
   - Expected: Batch test mode activated
   
3. **Expired Session Token**
   - Expected: 401 error with clear message
   
4. **Missing widgetSessionId for batch test**
   - Expected: Normal chat mode (no special handling)

**Validation:**
- [ ] Edge cases handled gracefully
- [ ] No crashes or undefined behavior
- [ ] Clear error messages

---

### **Phase 5: Deployment & Monitoring**

**Status:** Not started  
**Estimated Time:** 30 minutes

#### Task 5.1: Pre-Deployment Checklist

- [ ] All TypeScript compilation successful
- [ ] No console errors in dev environment
- [ ] All test cases passed
- [ ] Code reviewed (self-review minimum)
- [ ] Documentation updated

#### Task 5.2: Deployment Steps

1. **Database Changes:** None required (no schema changes)
2. **Environment Variables:** None required (reusing existing)
3. **Code Deployment:** Standard Next.js build and deploy

#### Task 5.3: Post-Deployment Validation

**Immediate Checks (First 5 minutes):**
- [ ] Widget still works on external site (if applicable)
- [ ] Batch testing starts without API key
- [ ] No 500 errors in logs
- [ ] Normal chat functioning

**Short-term Monitoring (First Hour):**
- [ ] Check error logs for auth failures
- [ ] Monitor batch test success rate
- [ ] Verify conversations created correctly
- [ ] No performance degradation

**Long-term Monitoring (First Day):**
- [ ] User feedback on batch testing UX
- [ ] Widget mode usage unchanged
- [ ] No unexpected auth errors
- [ ] Database writes working correctly

---

### **Phase 6: Cleanup & Documentation**

**Status:** Not started  
**Estimated Time:** 30 minutes

#### Task 6.1: Code Cleanup

**Remove Dead Code:**
- [ ] Old API key validation for batch tests (if any utility functions)
- [ ] Unused imports
- [ ] Commented-out code

**Update Comments:**
- [ ] Document dual auth path in /api/chat
- [ ] Add comments explaining batch test mode
- [ ] Update JSDoc if applicable

#### Task 6.2: Update Documentation

**Files to Update:**
1. `BATCH_TESTING_PROMPT_GENERATION_INVESTIGATION.md`
   - Update to reflect no API key needed
   - Document new session-based flow

2. `README.md` (if batch testing mentioned)
   - Remove API key setup steps
   - Simplify getting started guide

3. **User-facing Docs** (if any)
   - Update screenshots (no API key field)
   - Simplify workflow diagrams

#### Task 6.3: Create Migration Guide (For Existing Users)

**Document:**
- Old way: Required API key management
- New way: Automatic with session token
- Impact: Existing API keys still work for widgets
- Action needed: None (transparent upgrade)

---

## Risk Assessment

### Low Risk
- ✅ Widget mode completely unchanged (separate code path)
- ✅ Additive change (new auth method added, old one kept)
- ✅ No database schema changes
- ✅ No breaking API changes
- ✅ Backward compatible

### Medium Risk
- ⚠️ Session token must be valid (user must be logged in)
- ⚠️ Need to handle session expiration gracefully
- ⚠️ Multiple auth paths could cause confusion during debugging

### Mitigation Strategies
1. **Clear logging** for which auth mode is active
2. **Explicit error messages** for session failures
3. **Comprehensive testing** before deployment
4. **Rollback plan**: Revert commit, redeploy previous version

---

## Success Criteria

### User Experience
- [ ] Users can start batch testing without creating API keys
- [ ] No additional setup steps required
- [ ] Batch testing "just works" when logged in

### Technical
- [ ] Widget mode unchanged and working
- [ ] Batch testing uses session auth
- [ ] No breaking changes to any endpoint
- [ ] All tests passing

### Business
- [ ] Reduced user friction
- [ ] Fewer support questions about API keys
- [ ] Better alignment with internal tool UX expectations

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Investigation ✅ | 1 hour | None |
| Phase 2: Backend | 1-2 hours | Phase 1 |
| Phase 3: Frontend | 30 min | Phase 2 |
| Phase 4: Testing | 1 hour | Phase 2, 3 |
| Phase 5: Deployment | 30 min | Phase 4 |
| Phase 6: Cleanup | 30 min | Phase 5 |
| **Total** | **4-5 hours** | Sequential |

**Recommended Schedule:**
- Day 1: Phase 2 (Backend changes)
- Day 2: Phase 3-4 (Frontend + Testing)
- Day 3: Phase 5-6 (Deploy + Cleanup)

---

## Rollback Plan

If issues arise post-deployment:

1. **Immediate:** Revert to previous commit
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Alternative:** Feature flag approach
   - Add environment variable: `BATCH_TEST_USE_SESSION_AUTH=false`
   - Fallback to API key requirement if false
   - Allows gradual rollout

3. **Data:** No database changes, no data migration needed

---

## Next Steps

1. ✅ Review this implementation plan
2. ⏳ Get approval to proceed
3. ⏳ Start Phase 2: Backend modifications
4. ⏳ Verify each phase before proceeding
5. ⏳ Deploy when all tests pass

---

**Plan Created:** 2025-10-31  
**Status:** Ready for implementation  
**Approval Required:** Yes  
**Breaking Changes:** No  
**Database Changes:** No
