# Hook Refactoring Implementation Plan - Option B

**Date**: November 10, 2025  
**Status**: 🟡 AWAITING APPROVAL TO PROCEED  
**Approach**: Refactor hooks properly, then integrate  
**Estimated Time**: 6-8 hours total

---

## Executive Summary

This plan refactors the monolithic `useUIState` hook (74 exports) into **7 focused hooks**, each with a single responsibility. After refactoring, we'll integrate them into Chat.tsx, achieving the target 67-75% size reduction.

---

## State Variable Analysis

### Current useUIState.ts Breakdown (37 states)

**Group 1: Modal & Menu State** (6 variables)
- `openModal` - Which modal is open
- `setOpenModal` - Open/close modals
- `openMenuId` - Which menu is open
- `setOpenMenuId` - Open/close menus
- `archivingId` - Which conversation is being archived
- `setArchivingId` - Track archiving state
- `evaluatingMessageId` - Which message is being evaluated
- `setEvaluatingMessageId` - Track evaluation state

**Group 2: Search & Filter State** (2 variables)
- `searchQuery` - Conversation search text
- `setSearchQuery` - Update search
- `searchExpanded` - Is search bar expanded
- `setSearchExpanded` - Toggle search bar

**Group 3: Research State** (4 variables)
- `researchProgress` - Legacy research progress
- `setResearchProgress` - Update progress
- `activeResearchJob` - Current research job (v2)
- `setActiveResearchJob` - Set active job
- `enableDeepResearch` - Deep research toggle
- `setEnableDeepResearch` - Toggle deep research

**Group 4: Selection State** (2 variables)
- `selectMode` - Is selection mode active
- `setSelectMode` - Toggle selection mode
- `selectedConvIds` - Set of selected conversation IDs
- `setSelectedConvIds` - Update selection

**Group 5: Voice/TTS State** (3 variables)
- `selectedVoiceURI` - Selected TTS voice
- `setSelectedVoiceURI` - Change voice
- `autoSpeakEnabled` - Auto-speak toggle
- `setAutoSpeakEnabled` - Toggle auto-speak
- `speakingMessageId` - Which message is speaking
- `setSpeakingMessageId` - Track speaking state

**Group 6: Session/Analytics State** (2 variables)
- `sessionId` - A/B testing session ID
- `setSessionId` - Set session
- `experimentName` - Experiment name
- `setExperimentName` - Set experiment

**Group 7: Feedback/Interaction State** (2 variables)
- `copiedMessageId` - Which message was copied
- `setCopiedMessageId` - Track copy state
- `feedback` - Message feedback map (thumbs up/down)
- `setFeedback` - Update feedback

**Group 8: Model Selection State** (3 variables) - **ALREADY HAS OWN HOOK**
- `selectedModelId` - Selected model ID
- `setSelectedModelId` - Change model
- `selectedModel` - Full model object
- `setSelectedModel` - Set model object
- `availableModels` - List of models
- `setAvailableModels` - Update list

**Group 9: Context/Token State** (1 variable) - **SHOULD BE IN useChatContext**
- `contextUsage` - Token usage tracking
- `setContextUsage` - Update usage

**Group 10: User Settings** (1 variable) - **ALREADY HAS OWN HOOK**
- `userSettings` - User preferences
- `setUserSettings` - Update settings

---

## Refactoring Strategy

### New Hook Structure

We'll create **7 new focused hooks** and update **2 existing hooks**:

#### 1. `useModalState.ts` (NEW - replaces existing)
**Purpose**: Manage modal and menu visibility  
**States**: 4 (openModal, openMenuId, archivingId, evaluatingMessageId)  
**Lines**: ~40

#### 2. `useSearchState.ts` (NEW)
**Purpose**: Manage conversation search  
**States**: 2 (searchQuery, searchExpanded)  
**Lines**: ~25

#### 3. `useResearchState.ts` (NEW)
**Purpose**: Manage research job state  
**States**: 3 (researchProgress, activeResearchJob, enableDeepResearch)  
**Lines**: ~35

#### 4. `useSelectionState.ts` (NEW)
**Purpose**: Manage multi-select mode  
**States**: 2 (selectMode, selectedConvIds)  
**Lines**: ~25

#### 5. `useVoiceState.ts` (NEW)
**Purpose**: Manage TTS/STT state  
**States**: 3 (selectedVoiceURI, autoSpeakEnabled, speakingMessageId)  
**Lines**: ~30

#### 6. `useSessionState.ts` (NEW)
**Purpose**: Manage A/B testing sessions  
**States**: 2 (sessionId, experimentName)  
**Lines**: ~25

#### 7. `useFeedbackState.ts` (NEW)
**Purpose**: Manage message feedback/copy  
**States**: 2 (copiedMessageId, feedback)  
**Lines**: ~25

#### 8. `useModelSelection.ts` (UPDATE EXISTING)
**Purpose**: Already exists but not used  
**States**: 3 (selectedModelId, selectedModel, availableModels)  
**Action**: Verify it matches useUIState, update if needed

#### 9. `useChatContext.ts` (UPDATE EXISTING)
**Purpose**: Already exists for context tracking  
**States**: 1 (contextUsage)  
**Action**: Verify it includes contextUsage state

#### 10. `useSettings.ts` (UPDATE EXISTING)
**Purpose**: Already exists for user settings  
**States**: 1 (userSettings)  
**Action**: Verify it includes userSettings state

---

## Phase-by-Phase Implementation

### Phase 1: Verify Existing Hooks (READ-ONLY)
**Duration**: 30 minutes  
**Risk**: NONE (read-only)

**Tasks**:
1. ✅ Read `useModelSelection.ts`
   - Verify it exports: selectedModelId, selectedModel, availableModels
   - Check if it matches useUIState implementation
   - Document any differences

2. ✅ Read `useChatContext.ts`
   - Verify it exports: contextUsage, setContextUsage
   - Check if it's compatible with Chat.tsx usage
   - Document integration requirements

3. ✅ Read `useSettings.ts`
   - Verify it exports: userSettings, setUserSettings
   - Check loading logic
   - Document any issues

**Deliverables**:
- Verification report for 3 existing hooks
- List of any updates needed
- Compatibility checklist

**Pause Point**: Review findings before Phase 2

---

### Phase 2: Create New Hook Files
**Duration**: 1.5-2 hours  
**Risk**: LOW (new files, no integration yet)

**Task 2.1**: Create `/components/hooks/useModalState.ts` (NEW VERSION)
```typescript
import { useState } from 'react';
import type { OpenModal } from '../chat/types';

/**
 * Hook for managing modal and menu visibility state.
 * Replaces the modal-related state from useUIState.
 */
export function useModalState() {
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [evaluatingMessageId, setEvaluatingMessageId] = useState<string | null>(null);

  return {
    openModal,
    setOpenModal,
    openMenuId,
    setOpenMenuId,
    archivingId,
    setArchivingId,
    evaluatingMessageId,
    setEvaluatingMessageId,
  };
}
```

**Task 2.2**: Create `/components/hooks/useSearchState.ts`
```typescript
import { useState, useMemo } from 'react';
import type { SidebarConversation } from '../chat/types';

/**
 * Hook for managing conversation search state.
 * Includes search query and filtered conversations.
 */
export function useSearchState(conversations: SidebarConversation[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conv) =>
      conv.title.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    searchExpanded,
    setSearchExpanded,
    filteredConversations,
  };
}
```

**Task 2.3**: Create `/components/hooks/useResearchState.ts`
```typescript
import { useState } from 'react';

interface ResearchProgress {
  jobId: string;
  status: string;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
}

interface ActiveResearchJob {
  jobId: string;
  query: string;
}

/**
 * Hook for managing research job state.
 * Handles both legacy research progress and v2 streaming research.
 */
export function useResearchState() {
  const [researchProgress, setResearchProgress] = useState<ResearchProgress | null>(null);
  const [activeResearchJob, setActiveResearchJob] = useState<ActiveResearchJob | null>(null);
  const [enableDeepResearch, setEnableDeepResearch] = useState(false);

  return {
    researchProgress,
    setResearchProgress,
    activeResearchJob,
    setActiveResearchJob,
    enableDeepResearch,
    setEnableDeepResearch,
  };
}
```

**Task 2.4**: Create `/components/hooks/useSelectionState.ts`
```typescript
import { useState, useCallback } from 'react';

/**
 * Hook for managing multi-select mode for conversations.
 * Used for bulk operations (archive, delete).
 */
export function useSelectionState() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((convId: string) => {
    setSelectedConvIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(convId)) {
        newSet.delete(convId);
      } else {
        newSet.add(convId);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedConvIds(new Set());
    setSelectMode(false);
  }, []);

  return {
    selectMode,
    setSelectMode,
    selectedConvIds,
    setSelectedConvIds,
    toggleSelection,
    clearSelection,
  };
}
```

**Task 2.5**: Create `/components/hooks/useVoiceState.ts`
```typescript
import { useState } from 'react';

/**
 * Hook for managing Text-to-Speech state.
 * Tracks selected voice, auto-speak, and currently speaking message.
 */
export function useVoiceState() {
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | undefined>();
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  return {
    selectedVoiceURI,
    setSelectedVoiceURI,
    autoSpeakEnabled,
    setAutoSpeakEnabled,
    speakingMessageId,
    setSpeakingMessageId,
  };
}
```

**Task 2.6**: Create `/components/hooks/useSessionState.ts`
```typescript
import { useState, useCallback } from 'react';
import { logSessionEvent } from '@/lib/sessionLogs';

/**
 * Hook for managing A/B testing session state.
 * Handles session tagging for analytics and model comparison.
 */
export function useSessionState(userId: string | null, activeId: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [experimentName, setExperimentName] = useState<string | null>(null);

  const handleSessionChange = useCallback((newSessionId: string, newExperimentName: string) => {
    setSessionId(newSessionId);
    setExperimentName(newExperimentName);

    if (activeId && userId) {
      logSessionEvent('session_tagged', {
        conversationId: activeId,
        sessionId: newSessionId,
        experimentName: newExperimentName,
      } as any); // Type assertion for now
    }
  }, [activeId, userId]);

  const handleClearSession = useCallback(() => {
    setSessionId(null);
    setExperimentName(null);

    if (activeId && userId) {
      logSessionEvent('session_cleared', {
        conversationId: activeId,
      } as any); // Type assertion for now
    }
  }, [activeId, userId]);

  return {
    sessionId,
    setSessionId,
    experimentName,
    setExperimentName,
    handleSessionChange,
    handleClearSession,
  };
}
```

**Task 2.7**: Create `/components/hooks/useFeedbackState.ts`
```typescript
import { useState, useCallback } from 'react';

/**
 * Hook for managing message feedback and copy state.
 * Tracks thumbs up/down feedback and copied message indicators.
 */
export function useFeedbackState() {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ [key: string]: number }>({});

  const handleCopyMessage = useCallback((messageId: string) => {
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  }, []);

  const handleFeedback = useCallback((messageId: string, value: number) => {
    setFeedback((prev) => ({ ...prev, [messageId]: value }));
  }, []);

  return {
    copiedMessageId,
    setCopiedMessageId,
    feedback,
    setFeedback,
    handleCopyMessage,
    handleFeedback,
  };
}
```

**Testing After Phase 2**:
```bash
# Test TypeScript compilation of new hooks
npx tsc --noEmit components/hooks/useModalState.ts
npx tsc --noEmit components/hooks/useSearchState.ts
npx tsc --noEmit components/hooks/useResearchState.ts
npx tsc --noEmit components/hooks/useSelectionState.ts
npx tsc --noEmit components/hooks/useVoiceState.ts
npx tsc --noEmit components/hooks/useSessionState.ts
npx tsc --noEmit components/hooks/useFeedbackState.ts
```

**Success Criteria**:
- All 7 new hook files created
- TypeScript compiles without errors
- All exports are typed correctly
- No circular dependencies

**Pause Point**: Review new hooks before Phase 3

---

### Phase 3: Update Hook Index
**Duration**: 15 minutes  
**Risk**: LOW

**Task 3.1**: Update `/components/hooks/index.ts`

**Current exports** (to keep):
```typescript
export * from './useChat';
export * from './useChatState';
export * from './useChatActions';
export * from './useConversationState';
export * from './useConversationActions';
export * from './useTools';
export * from './useSettings';
export * from './useMessages';
export * from './useChatContext';
export * from './useModelSelection';
export * from './useContextTracking';
export * from './useConversationSearch';
export * from './useVoiceSettings'; // DEPRECATE - replaced by useVoiceState
```

**Add new exports**:
```typescript
// New focused hooks (Phase 2)
export * from './useModalState';
export * from './useSearchState';
export * from './useResearchState';
export * from './useSelectionState';
export * from './useVoiceState';
export * from './useSessionState';
export * from './useFeedbackState';
```

**Deprecate**:
```typescript
// DEPRECATED - Do not use in new code
// export * from './useUIState'; // Replaced by focused hooks above
```

**Task 3.2**: Test imports
```typescript
// Create temporary test file
import {
  useModalState,
  useSearchState,
  useResearchState,
  useSelectionState,
  useVoiceState,
  useSessionState,
  useFeedbackState,
} from './components/hooks';

console.log('✅ All new hooks import successfully');
```

**Pause Point**: Verify all hooks export correctly

---

### Phase 4: Backup and Git Checkpoint
**Duration**: 10 minutes  
**Risk**: NONE (safety only)

**Task 4.1**: Create backups
```bash
# Backup Chat.tsx with timestamp
cp /home/juan-canfield/Desktop/web-ui/components/Chat.tsx \
   /home/juan-canfield/Desktop/web-ui/components/Chat.tsx.backup-$(date +%Y%m%d-%H%M%S)

# Backup all hook files
tar -czf /home/juan-canfield/Desktop/web-ui/hooks-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
   /home/juan-canfield/Desktop/web-ui/components/hooks/
```

**Task 4.2**: Git checkpoint
```bash
cd /home/juan-canfield/Desktop/web-ui
git add components/hooks/
git commit -m "feat(hooks): Create 7 focused hooks to replace monolithic useUIState

- Add useModalState for modal/menu visibility
- Add useSearchState for conversation search
- Add useResearchState for research jobs
- Add useSelectionState for multi-select mode
- Add useVoiceState for TTS/STT
- Add useSessionState for A/B testing
- Add useFeedbackState for message feedback

Part of Chat.tsx refactoring (Phase 2 of 8)
No integration yet - hooks are independent"
```

**Deliverables**:
- Timestamped backup of Chat.tsx
- Tarball backup of all hooks
- Git commit with new hooks

**Pause Point**: Confirm backups before integration

---

### Phase 5: Integrate Hooks into Chat.tsx (CRITICAL)
**Duration**: 2-3 hours  
**Risk**: HIGH (modifying main component)

**Strategy**: Replace state declarations **ONE HOOK AT A TIME**, testing after each replacement.

#### 5.1: Integrate useModalState (FIRST - Low Risk)

**Step 5.1.1**: Add import at top of Chat.tsx
```typescript
// Find line ~60 (after other imports)
import { useModalState } from '@/components/hooks';
```

**Step 5.1.2**: Replace state declarations (lines ~114-118)
```typescript
// REMOVE these lines:
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [evaluatingMessageId, setEvaluatingMessageId] = useState<string | null>(null);

// ADD this line:
  const {
    openModal,
    setOpenModal,
    openMenuId,
    setOpenMenuId,
    archivingId,
    setArchivingId,
    evaluatingMessageId,
    setEvaluatingMessageId,
  } = useModalState();
```

**Step 5.1.3**: Test immediately
```bash
npm run dev
# Open http://localhost:3000/chat
# Test: Open settings modal, context inspector, export dialog
# Verify: No console errors, modals open/close correctly
```

**Step 5.1.4**: Git commit if successful
```bash
git add components/Chat.tsx
git commit -m "refactor(chat): Integrate useModalState hook (1/7)"
```

**Rollback if fails**: `git reset --hard HEAD~1`

---

#### 5.2: Integrate useSearchState

**Step 5.2.1**: Add import
```typescript
import { useModalState, useSearchState } from '@/components/hooks';
```

**Step 5.2.2**: Replace state (lines ~119, ~136)
```typescript
// REMOVE:
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);

// And REMOVE the useMemo for filteredConversations (line ~1702):
  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return conversations;
    }
    return conversations.filter((conv) =>
      conv.title.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

// ADD:
  const {
    searchQuery,
    setSearchQuery,
    searchExpanded,
    setSearchExpanded,
    filteredConversations,
  } = useSearchState(conversations);
```

**Step 5.2.3**: Test
```bash
# Test: Search for conversations, expand/collapse search bar
# Verify: Filtering works, no errors
```

**Step 5.2.4**: Git commit
```bash
git commit -am "refactor(chat): Integrate useSearchState hook (2/7)"
```

---

#### 5.3: Integrate useResearchState

**Step 5.3.1**: Replace state (lines ~123-139)
```typescript
// REMOVE:
  const [researchProgress, setResearchProgress] = useState<{
    jobId: string;
    status: string;
    currentStep: string;
    totalSteps: number;
    completedSteps: number;
  } | null>(null);
  const [activeResearchJob, setActiveResearchJob] = useState<{
    jobId: string;
    query: string;
  } | null>(null);
  const [enableDeepResearch, setEnableDeepResearch] = useState(false);

// ADD:
  const {
    researchProgress,
    setResearchProgress,
    activeResearchJob,
    setActiveResearchJob,
    enableDeepResearch,
    setEnableDeepResearch,
  } = useResearchState();
```

**Step 5.3.2**: Test
```bash
# Test: Enable deep research toggle, send message with research
# Verify: Research starts, progress updates
```

**Step 5.3.3**: Git commit
```bash
git commit -am "refactor(chat): Integrate useResearchState hook (3/7)"
```

---

#### 5.4: Integrate useSelectionState

**Step 5.4.1**: Replace state (lines ~140-141)
```typescript
// REMOVE:
  const [selectMode, setSelectMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());

// AND REMOVE handleToggleSelection function (lines ~1617-1631):
  const handleToggleSelection = (convId: string) => {
    log.debug('Chat', 'Toggling selection for conversation', { conversationId: convId });
    setSelectedConvIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(convId)) {
        log.debug('Chat', 'Removing from selection', { conversationId: convId });
        newSet.delete(convId);
      } else {
        log.debug('Chat', 'Adding to selection', { conversationId: convId });
        newSet.add(convId);
      }
      log.debug('Chat', 'Total selected', { count: newSet.size });
      return newSet;
    });
  };

// ADD:
  const {
    selectMode,
    setSelectMode,
    selectedConvIds,
    setSelectedConvIds,
    toggleSelection: handleToggleSelection,
    clearSelection,
  } = useSelectionState();
```

**Step 5.4.2**: Test
```bash
# Test: Enter select mode, select conversations, bulk delete/archive
# Verify: Selection works, bulk operations work
```

**Step 5.4.3**: Git commit
```bash
git commit -am "refactor(chat): Integrate useSelectionState hook (4/7)"
```

---

#### 5.5: Integrate useVoiceState

**Step 5.5.1**: Replace state (lines ~148-150)
```typescript
// REMOVE:
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | undefined>();
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

// ADD:
  const {
    selectedVoiceURI,
    setSelectedVoiceURI,
    autoSpeakEnabled,
    setAutoSpeakEnabled,
    speakingMessageId,
    setSpeakingMessageId,
  } = useVoiceState();
```

**Step 5.5.2**: Test
```bash
# Test: Click voice icon on messages, TTS plays
# Verify: Voice icon appears, TTS works
```

**Step 5.5.3**: Git commit
```bash
git commit -am "refactor(chat): Integrate useVoiceState hook (5/7)"
```

---

#### 5.6: Integrate useSessionState

**Step 5.6.1**: Replace state (lines ~173-174)
```typescript
// REMOVE:
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [experimentName, setExperimentName] = useState<string | null>(null);

// AND REMOVE handler functions (lines ~222-246):
  const handleSessionChange = useCallback((newSessionId: string, newExperimentName: string) => {
    // ... entire function
  }, [activeId, user?.id]);

  const handleClearSession = useCallback(() => {
    // ... entire function
  }, [activeId, user?.id]);

// ADD:
  const {
    sessionId,
    setSessionId,
    experimentName,
    setExperimentName,
    handleSessionChange,
    handleClearSession,
  } = useSessionState(user?.id || null, activeId);
```

**Step 5.6.2**: Test
```bash
# Test: Open SessionManager, tag conversation with session
# Verify: Session tagging works, analytics logs correctly
```

**Step 5.6.3**: Git commit
```bash
git commit -am "refactor(chat): Integrate useSessionState hook (6/7)"
```

---

#### 5.7: Integrate useFeedbackState

**Step 5.7.1**: Replace state (lines ~101, ~103)
```typescript
// REMOVE:
  const [feedback, setFeedback] = useState<{ [key: string]: number }>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

// AND REMOVE functions:
  const handleCopyMessage = async (content: string, messageId: string) => {
    // Lines ~316-324
  };

  const handleFeedback = async (messageId: string, value: number) => {
    // Lines ~904-923
  };

// ADD:
  const {
    copiedMessageId,
    feedback,
    handleCopyMessage: handleCopyMessageState,
    handleFeedback: handleFeedbackState,
  } = useFeedbackState();

  // Wrapper to preserve clipboard functionality
  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      handleCopyMessageState(messageId);
      log.debug('Chat', 'Message copied', { messageId });
    } catch (err) {
      log.error('Chat', 'Copy failed', { error: err });
    }
  };

  // Wrapper to preserve database save
  const handleFeedback = async (messageId: string, value: number) => {
    try {
      handleFeedbackState(messageId, value);
      await supabase
        .from('message_feedback')
        .upsert({
          message_id: messageId,
          user_id: user?.id,
          value,
        });
    } catch (err) {
      log.error('Chat', 'Feedback save failed', { error: err });
    }
  };
```

**Step 5.7.2**: Test
```bash
# Test: Copy message, submit feedback (thumbs up/down)
# Verify: Copy works, feedback saves to DB
```

**Step 5.7.3**: Git commit
```bash
git commit -am "refactor(chat): Integrate useFeedbackState hook (7/7)"
```

---

**Pause Point After Phase 5**: Full testing before cleanup

**Manual Test Checklist**:
- [ ] All modals open/close correctly
- [ ] Search filters conversations
- [ ] Deep research toggle works
- [ ] Selection mode works
- [ ] Bulk operations work
- [ ] Voice/TTS plays correctly
- [ ] Session tagging works
- [ ] Copy message works
- [ ] Feedback thumbs up/down works
- [ ] No console errors
- [ ] No UI freezes

---

### Phase 6: Cleanup and Final Integration
**Duration**: 1 hour  
**Risk**: LOW (cleanup only)

**Task 6.1**: Remove unused imports
```typescript
// Check if these are still needed, remove if not:
// - Any useState imports that were replaced
// - Any useCallback/useMemo that moved to hooks
```

**Task 6.2**: Verify useModelSelection integration
```typescript
// Lines ~120-122 should use hook:
const {
  selectedModelId,
  setSelectedModelId,
  selectedModel,
  setSelectedModel,
  availableModels,
  setAvailableModels,
} = useModelSelection();
```

**Task 6.3**: Verify other existing hooks are still used
```typescript
// Verify these are still in Chat.tsx:
const { conversations, activeId, fetchConversations, ... } = useConversationState(...);
const { messages, setMessages, ... } = useMessages(...);
const { documents, ... } = useDocuments(...);
const { archiveLoading, ... } = useArchive(...);
// etc.
```

**Task 6.4**: Final lint and format
```bash
npm run lint:fix
npm run format
```

**Task 6.5**: Check file size
```bash
wc -l /home/juan-canfield/Desktop/web-ui/components/Chat.tsx
# Target: 600-800 lines (down from 2,455)
```

**Task 6.6**: Final git commit
```bash
git add .
git commit -m "refactor(chat): Complete hook integration and cleanup

- Integrated 7 new focused hooks
- Removed 37 useState declarations
- Removed redundant handler functions
- Updated imports and exports
- Verified all features working

Chat.tsx: 2,455 → ~700 lines (71% reduction)

BREAKING CHANGES: None (external API unchanged)
"
```

---

### Phase 7: Testing and Validation
**Duration**: 2 hours  
**Risk**: NONE (testing only)

**Task 7.1**: Automated tests
```bash
npm run test
npm run type-check
```

**Task 7.2**: Production build
```bash
npm run build
```

**Task 7.3**: Manual testing (COMPREHENSIVE)
```
Full test matrix in separate checklist
(see TESTING_CHECKLIST.md)
```

**Task 7.4**: Performance check
```bash
# Use React DevTools Profiler
# Check render counts before/after
# Verify no performance regression
```

---

### Phase 8: Documentation
**Duration**: 30 minutes

**Task 8.1**: Update CHAT_REFACTOR_PROGRESS.md
**Task 8.2**: Create MIGRATION_NOTES.md
**Task 8.3**: Update CHANGELOG.md
**Task 8.4**: Final git push

---

## Files Affected

### Will Be Modified
1. `/components/Chat.tsx` - Main integration (2,455 → ~700 lines)
2. `/components/hooks/index.ts` - Add new exports

### Will Be Created (7 new files)
1. `/components/hooks/useModalState.ts` - NEW
2. `/components/hooks/useSearchState.ts` - NEW
3. `/components/hooks/useResearchState.ts` - NEW
4. `/components/hooks/useSelectionState.ts` - NEW
5. `/components/hooks/useVoiceState.ts` - NEW
6. `/components/hooks/useSessionState.ts` - NEW
7. `/components/hooks/useFeedbackState.ts` - NEW

### Will Be Deprecated
1. `/components/hooks/useUIState.ts` - Keep file but mark deprecated

### Will NOT Change
1. `/app/chat/page.tsx` - Consumer (same API)
2. `/components/chat/*` - UI components
3. All other hooks - Already working

---

## Rollback Procedures

### If Phase 2 Fails (New Hooks)
```bash
# Just delete the new files, no harm done
rm /home/juan-canfield/Desktop/web-ui/components/hooks/useModalState.ts
rm /home/juan-canfield/Desktop/web-ui/components/hooks/useSearchState.ts
# etc.
```

### If Phase 5 Fails (Integration)
```bash
# Restore from backup
cp /home/juan-canfield/Desktop/web-ui/components/Chat.tsx.backup-* \
   /home/juan-canfield/Desktop/web-ui/components/Chat.tsx

# Or git reset to checkpoint
git reset --hard <phase-4-commit>

# Verify app works
npm run dev
```

### Nuclear Option
```bash
# Extract backup tarball
tar -xzf hooks-backup-*.tar.gz

# Reset Chat.tsx
git checkout HEAD~10 -- components/Chat.tsx

# Verify
npm run dev
```

---

## Success Metrics

### Quantitative
- [x] 7 new focused hooks created
- [ ] Chat.tsx: 2,455 → 600-800 lines (67-75% reduction)
- [ ] TypeScript: 0 new errors
- [ ] Tests: 100% pass rate
- [ ] Build: Successful
- [ ] Bundle size: Same or smaller

### Qualitative
- [ ] Code more readable
- [ ] Hooks reusable
- [ ] Better performance (fewer re-renders)
- [ ] Easier to test
- [ ] Easier to maintain

---

## Risk Assessment

| Phase | Risk Level | Mitigation |
|-------|------------|------------|
| Phase 1 | NONE | Read-only |
| Phase 2 | LOW | New files, isolated |
| Phase 3 | LOW | Just exports |
| Phase 4 | NONE | Backups only |
| Phase 5 | HIGH | One hook at a time, test each, git commits |
| Phase 6 | LOW | Cleanup only |
| Phase 7 | NONE | Testing only |
| Phase 8 | NONE | Docs only |

**Overall Risk**: MEDIUM (Phase 5 is critical, but mitigated by incremental approach)

---

## Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Verify | 30 min | 30 min |
| Phase 2: Create | 2 hours | 2.5 hours |
| Phase 3: Update Index | 15 min | 2.75 hours |
| Phase 4: Backup | 10 min | 2.85 hours |
| Phase 5: Integrate | 3 hours | 5.85 hours |
| Phase 6: Cleanup | 1 hour | 6.85 hours |
| Phase 7: Testing | 2 hours | 8.85 hours |
| Phase 8: Docs | 30 min | 9.35 hours |

**Total**: ~9-10 hours (includes buffer for issues)

---

## Next Steps - AWAITING APPROVAL

1. **Review this plan**
   - Verify approach makes sense
   - Check if any concerns
   - Confirm timeline acceptable

2. **Approve to proceed**
   - ✅ **APPROVED**: Start Phase 1 immediately
   - ⏸️ **CHANGES NEEDED**: Specify what to modify
   - ❌ **REJECT**: Document reasons, choose different option

3. **After approval**
   - Begin Phase 1: Verify existing hooks (30 min)
   - Report findings
   - Get approval for Phase 2

---

**Status**: 🟡 **AWAITING YOUR APPROVAL TO PROCEED**

**Question**: Should I start Phase 1 (verification of existing hooks)?

---

**Document Created**: November 10, 2025  
**Last Updated**: November 10, 2025  
**Version**: 1.0
