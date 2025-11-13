# Hook Integration Plan
**Generated:** November 11, 2025

## Audit Results Summary

### ✅ SAFE TO INTEGRATE (3 hooks)
1. **useChatState.ts** (34 lines) - 100% compatible
2. **useConversationState.ts** (79 lines) - 98% compatible

### ⚠️ NEEDS UPDATES FIRST (1 hook)
3. **useMessages.ts** (95 lines) - 95% compatible - Missing validation logic

### ❌ SKIP - INCOMPATIBLE (1 hook)
4. **useConversationActions.ts** (144 lines) - 60% compatible - Outdated architecture

### 🔍 NEEDS AUDIT (7 hooks remaining)
- useChatActions.ts (342 lines) - Partially audited
- useChat.ts (273 lines)
- useTools.ts (41 lines)
- useUIState.ts
- useContextTracking.ts
- useConversationSearch.ts
- useVoiceSettings.ts

## Integration Strategy

### Phase 1: Quick Wins (Estimated: 30-45 minutes)
Integrate the 2 fully compatible hooks immediately for quick line reduction:

**Step 1: useChatState.ts** (Expected reduction: ~25 lines)
- **What it does:** Manages core chat state (input, loading, messages, error, abortController) + refs
- **Current Chat.tsx lines:** 110-152, 287-288
- **Risk:** VERY LOW - Exact match, no conflicts
- **Testing:** Verify input typing, message display, loading states work

**Step 2: useConversationState.ts** (Expected reduction: ~60 lines)
- **What it does:** Manages conversation list + fetchConversations
- **Current Chat.tsx lines:** 488-547 (fetchConversations function)
- **Risk:** LOW - Only missing debug logging
- **Testing:** Verify conversation list loads, switching conversations works

### Phase 2: Update Hook (Estimated: 20-30 minutes)

**Step 3: Update useMessages.ts** 
- **Add missing validation logic** from Chat.tsx (lines 775-785)
- **Add message size logging** from Chat.tsx (lines 717-732)
- **Test updated hook** in isolation before integration

**Step 4: Integrate updated useMessages.ts** (Expected reduction: ~70 lines)
- **What it does:** Fetches messages for active conversation
- **Current Chat.tsx lines:** 675-820
- **Risk:** MEDIUM - After updates, should be low risk
- **Testing:** Verify messages load correctly, validation works, no data corruption

### Phase 3: Complete Audit (Estimated: 1-2 hours)

**Step 5-11: Audit remaining 7 hooks**
- Continue systematic audit process
- Document compatibility for each
- Add to integration plan if compatible

## Expected Impact

### After Phase 1 (2 hooks):
- **Lines reduced:** ~85-95 lines
- **Chat.tsx size:** 2,468 → ~2,380 lines (3.6% reduction)
- **Risk level:** Very Low
- **Time investment:** 30-45 minutes

### After Phase 2 (3 hooks total):
- **Lines reduced:** ~155-165 lines  
- **Chat.tsx size:** 2,468 → ~2,310 lines (6.4% reduction)
- **Risk level:** Low-Medium
- **Time investment:** 1-1.5 hours

### After Phase 3 (unknown):
- **Depends on audit findings** for remaining 7 hooks
- **Potential additional reduction:** 200-500 lines (if hooks compatible)
- **Risk level:** TBD based on audit results

## Rollback Plan

Each integration will be done with:
1. **Git commit before** starting integration
2. **Comment out old code** instead of deleting (initially)
3. **TypeScript compilation check** after each change
4. **Manual testing** of affected features
5. **Easy revert** if issues found (uncomment old code, remove hook import)

## Recommended Approach

**OPTION A: CONSERVATIVE (Recommended)**
- Integrate Phase 1 (2 hooks) today
- Test thoroughly in development
- Proceed with Phase 2 only after Phase 1 proven stable

**OPTION B: AGGRESSIVE**  
- Complete all 3 phases (audit remaining → update → integrate all compatible hooks)
- Higher risk but maximum line reduction
- Requires extensive testing

**OPTION C: STOP HERE**
- Keep current state with 10 hooks already integrated
- Skip remaining unused hooks entirely
- Lowest risk, minimal benefit

---

## Decision Required

**Which approach do you want to take?**

Type:
- **"A"** for Conservative (integrate 2 safe hooks now)
- **"B"** for Aggressive (complete all audits + integrate everything compatible)
- **"C"** for Stop (skip remaining hook integration)

Or provide custom instructions.
