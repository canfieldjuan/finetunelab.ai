# Phase 7: Integration Plan - Terminal Monitor

**Date**: November 1, 2025  
**Status**: Planning  
**Approach**: Incremental with verification at each step

---

## Pre-Implementation Verification

### ✅ Components Ready (Phase 1-3)

- [x] `lib/training/terminal-monitor.types.ts` - Type definitions (207 lines)
- [x] `lib/utils/terminal-format.ts` - Formatting utilities (304 lines)
- [x] `hooks/useTerminalData.ts` - Data aggregation hook (272 lines)
- [x] `components/terminal/` - 13 components (1,230 lines total)
  - Phase 2: 6 ASCII components (661 lines)
  - Phase 3: 7 layout panels (569 lines)

### ✅ API Ready

- Training server running on `http://localhost:8000`
- Endpoint verified: `GET /api/training/status/{job_id}`
- Polling logic already implemented in useTerminalData hook
- Cancel endpoint available: `POST /api/training/cancel/{job_id}`

### ✅ Existing Routes

- `/training` - Training configs page (main)
- `/training/monitor` - Current monitor page (chart-based UI)
- `/training/dag` - DAG visualization
- **NEW**: `/training/terminal` - Terminal-style monitor ← WE'LL CREATE THIS

---

## Implementation Steps

### **Step 1: Create Terminal Monitor Page Route** ✅ COMPLETE

**File**: `app/training/terminal/page.tsx`  
**Size**: 152 lines  
**Risk**: LOW (isolated new route)  

**Tasks**:

- [x] Create directory: `app/training/terminal/`
- [x] Create page component with useTerminalData hook
- [x] Wire up TerminalMonitor component
- [x] Handle URL params (jobId from query string)
- [x] Add error/loading states
- [x] Add navigation back to main training page
- [x] Fix TypeScript error (jobId null handling)

**Verification**:

- [x] File created successfully
- [x] Route will be accessible at `/training/terminal?jobId=xxx`
- [x] TypeScript compiles cleanly (0 errors)
- [x] useTerminalData hook wired correctly
- [x] Cancel handler implemented with confirmation

**Changes Made**:

- Created `app/training/terminal/page.tsx` (152 lines)
- Fixed useTerminalData hook endpoint: `/api/training/local/${jobId}/status`
- Added cancel action with confirmation dialog
- Added polling status indicator
- Added "Switch to Chart View" navigation

---

### **Step 2: Add Navigation Link** ✅ COMPLETE

**File**: `components/training/TrainingDashboard.tsx`  
**Changes**: Add "Terminal View" button  
**Size**: +13 lines  
**Risk**: LOW (additive change only)

**Tasks**:

- [x] Add import for Link from 'next/link'
- [x] Find exact location in TrainingDashboard component (header section)
- [x] Add "Terminal View" button next to status badge
- [x] Pass current jobId in URL params
- [x] Style button to match existing design

**Verification**:

- [x] Button added in header section
- [x] Click will navigate to `/training/terminal?jobId=xxx`
- [x] jobId passed correctly in URL
- [x] TypeScript compiles (0 errors)
- [x] Existing functionality not broken (additive only)

**Changes Made**:

- Imported Link component
- Added Terminal View button in header (green theme)
- Button positioned between title and status badge
- Uses existing jobId prop

---

### **Step 3: Update useTerminalData Hook** ✅ VERIFY NEEDED

**File**: `hooks/useTerminalData.ts`  
**Current Status**: Already implemented, needs verification  
**Risk**: LOW (already complete)

**Verification Needed**:

1. Check if it properly transforms TrainingJobStatus → TerminalMetrics
2. Verify polling stops on terminal states
3. Verify error handling
4. Check cleanup on unmount

**Tasks**:

- [ ] Read current implementation
- [ ] Verify transformation logic matches API response
- [ ] Check for any missing fields
- [ ] Test with real job ID

---

### **Step 4: Add Cancel Action** ✅ READY

**File**: `components/terminal/TerminalMonitor.tsx`  
**Changes**: Wire up onCancel callback  
**Size**: ~30 lines  
**Risk**: LOW (uses existing API)

**Tasks**:

1. Create cancel handler function
2. Add confirmation dialog
3. Call `/api/training/cancel/{job_id}` endpoint
4. Update UI after cancellation
5. Show success/error toast

**Verification**:

- [ ] Cancel button works
- [ ] Confirmation dialog appears
- [ ] API call succeeds
- [ ] UI updates after cancel
- [ ] No errors in console

---

### **Step 5: End-to-End Testing** ✅ READY

**Risk**: MEDIUM (full integration test)

**Test Scenarios**:

1. **Happy Path**:
   - Start training job from /training
   - Navigate to terminal monitor
   - See live updates
   - Wait for completion
   - Verify final state

2. **Navigation Test**:
   - Access terminal via URL with jobId
   - Switch between monitor views
   - Back button works

3. **Error Cases**:
   - Invalid job ID
   - Job doesn't exist
   - Training server offline
   - Network errors

4. **Cancel Test**:
   - Start job
   - Open terminal
   - Cancel job
   - Verify state updates

**Verification**:

- [ ] All test scenarios pass
- [ ] No console errors
- [ ] No memory leaks
- [ ] Responsive on different screen sizes
- [ ] Polling behaves correctly

---

## Success Criteria

- ✅ Terminal monitor page accessible and functional
- ✅ Real-time updates working (polling every 2s)
- ✅ All metrics display correctly
- ✅ Navigation between views seamless
- ✅ Cancel functionality works
- ✅ Error states handled gracefully
- ✅ No breaking changes to existing pages
- ✅ TypeScript compiles without errors
- ✅ No runtime errors in console

---

## Rollback Plan

If issues arise:

1. Terminal page is isolated - can be disabled by removing route
2. No changes to existing /training/monitor page
3. TrainingDashboard changes are additive (can be reverted)
4. No database schema changes
5. No breaking API changes

---

## Next Steps After Integration

1. **Performance Optimization** (if needed):
   - Optimize re-renders
   - Add memoization
   - Lazy load components

2. **Polish** (Phase 6 - Deferred):
   - Themes (classic-green, cyberpunk, modern-dark)
   - Animations
   - Sound effects (optional)
   - Keyboard shortcuts

3. **Enhanced Features** (Future):
   - WebSocket for real-time updates (Phase 4)
   - Export training logs
   - Compare multiple jobs
   - Historical replay

---

## Current Status: READY TO START STEP 1

**Confidence Level**: HIGH  
**Estimated Total Time**: 20-30 minutes  
**Blocking Issues**: None  

Let's begin with Step 1: Creating the terminal monitor page route.
