# Terminal-Style Training Monitor - Phased Implementation Plan

## 🎯 Project Overview

**Goal**: Replace current 8-chart stacked UI with single-screen terminal-style monitor  
**Complexity**: HIGH (new rendering paradigm, real-time updates, keyboard controls)  
**Risk Level**: MEDIUM (new feature, doesn't break existing functionality)  
**Estimated Total**: ~800-1200 lines of new code across 15-20 files

---

## ⚠️ CRITICAL: Risk Assessment & Validation Strategy

### Breaking Points to Watch

1. **WebSocket/SSE implementation** - Could conflict with existing polling
2. **Keyboard event handlers** - Might interfere with global shortcuts
3. **Real-time updates** - Heavy re-renders could cause performance issues
4. **Data fetching** - Need to aggregate data from multiple endpoints
5. **Responsive layout** - ASCII art breaks on small screens

### Validation Checklist (Per Phase)

- [ ] **Compile Check**: No TypeScript errors
- [ ] **Runtime Check**: Page loads without crashes
- [ ] **Data Check**: Metrics display correctly
- [ ] **Fallback Check**: Works if WebSocket fails
- [ ] **Existing UI Check**: Other pages still work
- [ ] **Terminal Check**: Training server unaffected

### Rollback Strategy

- Keep current UI at `/training/monitor/page.tsx`
- Build new terminal UI at `/training/terminal/page.tsx`
- Only replace old UI after full validation
- Can toggle between UIs with URL parameter if needed

---

## 📋 Phase 1: Foundation & Data Layer (LOW RISK)

**Goal**: Set up data structures and API integration without touching UI  
**Files to Create**: 2-3  
**Lines of Code**: ~150-200  
**Time Estimate**: 1-2 hours

### Steps

#### 1.1 Create Terminal Data Types

**File**: `lib/types/terminal-monitor.types.ts`

```typescript
// Define all TypeScript interfaces for terminal display
// - TerminalMetrics (aggregated data)
// - TerminalConfig (display settings)
// - ChartDataPoint (sparkline data)
// - GPUStatus, LogEntry, CheckpointInfo
```

**Risk**: NONE (just type definitions)  
**Validation**: TypeScript compiles

#### 1.2 Create Data Aggregation Hook

**File**: `lib/hooks/useTerminalData.ts`

```typescript
// Aggregates data from multiple sources:
// - Job status (existing endpoint)
// - Training metrics (existing endpoint)
// - GPU metrics (existing endpoint)
// - Logs (existing endpoint)
// Returns single TerminalMetrics object
```

**Risk**: LOW (read-only, no mutations)  
**Validation**:

- Hook returns expected data structure
- No infinite loops
- Polling stops on terminal states (reuse existing logic)

#### 1.3 Create Data Formatting Utilities

**File**: `lib/utils/terminal-format.ts`

```typescript
// Pure functions to format data for terminal display:
// - formatDuration(ms) → "8h 45m"
// - formatBytes(bytes) → "2.05 / 8.00 GB"
// - formatPercentage(num) → "25.6%"
// - formatTrend(current, previous) → "▼ [-0.123]"
```

**Risk**: NONE (pure functions)  
**Validation**: Unit tests for each formatter

---

## 📋 Phase 2: ASCII Rendering Components (LOW RISK)

**Goal**: Build reusable ASCII art components that work in isolation  
**Files to Create**: 6-8  
**Lines of Code**: ~300-400  
**Time Estimate**: 2-3 hours

### Steps

#### 2.1 ASCII Progress Bar Component

**File**: `components/terminal/ASCIIProgressBar.tsx`

```typescript
// Renders: [█████████▒▒▒▒▒▒▒▒▒▒] 42.5%
// Props: value (0-100), width, label
// Uses: Unicode block characters
```

**Risk**: NONE (stateless display component)  
**Validation**:

- Renders at 0%, 50%, 100%
- Handles width changes
- No hydration errors

#### 2.2 ASCII Sparkline Chart Component

**File**: `components/terminal/ASCIISparkline.tsx`

```typescript
// Renders mini line charts using ●━─ characters
// Props: dataPoints[], height, width
// Algorithm: Scale data to fit height, draw connected points
```

**Risk**: LOW (math calculations only)  
**Validation**:

- Handles empty data
- Scales correctly
- No performance issues with 50+ points

#### 2.3 ASCII Box Drawing Component

**File**: `components/terminal/ASCIIBox.tsx`

```typescript
// Draws borders using ┌─┐│└┘ characters
// Props: children, title, variant (single/double)
// Wraps content in terminal-style box
```

**Risk**: NONE (pure layout)  
**Validation**: Renders without layout shift

#### 2.4 Metric Display Component

**File**: `components/terminal/MetricDisplay.tsx`

```typescript
// Formats: "Train Loss: 3.456 ▼ [-0.123]"
// Props: label, value, trend, color
// Shows metric with trend indicator
```

**Risk**: NONE (display only)  
**Validation**: Handles undefined values gracefully

#### 2.5 Log Stream Component

**File**: `components/terminal/LogStream.tsx`

```typescript
// Scrolling log display (last N lines)
// Props: logs[], maxLines (default 6)
// Auto-scrolls on new entries
```

**Risk**: LOW (could cause re-renders)  
**Validation**:

- Doesn't leak memory
- Auto-scroll works
- Handles rapid updates

#### 2.6 Keyboard Shortcuts Component

**File**: `components/terminal/KeyboardShortcuts.tsx`

```typescript
// Displays: [P] Pause [C] Cancel [S] Save
// Props: actions[] (key + label + handler)
// Just visual display, handlers in parent
```

**Risk**: NONE (display only)  
**Validation**: Renders correctly

---

## 📋 Phase 3: Terminal Layout Assembly (MEDIUM RISK)

**Goal**: Combine ASCII components into full terminal layout  
**Files to Create**: 3-4  
**Lines of Code**: ~250-350  
**Time Estimate**: 2-3 hours

### Steps

#### 3.1 Create Terminal Panel Components

**Files**:

- `components/terminal/TerminalHeader.tsx` (model info, status)
- `components/terminal/TerminalProgress.tsx` (epoch/step progress)
- `components/terminal/TerminalMetrics.tsx` (loss, LR, sparkline)
- `components/terminal/TerminalGPU.tsx` (memory, util, temp)
- `components/terminal/TerminalPerformance.tsx` (throughput)
- `components/terminal/TerminalCheckpoint.tsx` (best checkpoint)

**Risk**: LOW (composition of Phase 2 components)  
**Validation**: Each panel renders in isolation

#### 3.2 Create Main Terminal Monitor Layout

**File**: `components/terminal/TerminalMonitor.tsx`

```typescript
// Main container that assembles all panels
// Uses CSS Grid for layout
// Props: metrics (from useTerminalData)
// Handles responsive breakpoints
```

**Risk**: MEDIUM (complex layout)  
**Validation**:

- Layout doesn't break on window resize
- All panels visible without scrolling (desktop)
- No hydration mismatches

---

## 📋 Phase 4: Real-Time Updates (HIGH RISK)

**Goal**: Add WebSocket/SSE for live data streaming  
**Files to Create**: 3-4  
**Lines of Code**: ~200-300  
**Time Estimate**: 3-4 hours

### Steps

#### 4.1 Create WebSocket Hook (Optional - Can Skip Initially)

**File**: `lib/hooks/useWebSocket.ts`

```typescript
// Connects to training server WebSocket endpoint
// Sends real-time updates instead of polling
// Falls back to polling if WebSocket unavailable
```

**Risk**: HIGH (new server dependency)  
**Decision Point**: Can defer this to Phase 6, use polling first  
**Validation**:

- Connection established
- Data received
- Reconnects on disconnect
- Falls back gracefully

#### 4.2 Update useTerminalData with Real-Time

**File**: `lib/hooks/useTerminalData.ts` (update)

```typescript
// Option 1: Use WebSocket if available
// Option 2: Fall back to 2s polling (existing pattern)
// Always stop on terminal states
```

**Risk**: MEDIUM (could break polling)  
**Validation**:

- Data updates every 2s (polling) or real-time (WS)
- Stops polling when job completes
- No memory leaks

#### 4.3 Add Server-Side WebSocket Endpoint (If Using WS)

**File**: `lib/training/training_server.py` (update)

```python
# Add WebSocket route: /api/training/monitor/ws
# Pushes updates every 2s
# Handles multiple clients
```

**Risk**: HIGH (modifies training server)  
**Decision Point**: Skip for MVP, add in Phase 6  
**Validation**:

- Doesn't crash existing server
- Handles client disconnects
- No performance impact on training

---

## 📋 Phase 5: Interactivity & Actions (MEDIUM RISK)

**Goal**: Add keyboard shortcuts and action handlers  
**Files to Create/Modify**: 3-4  
**Lines of Code**: ~150-200  
**Time Estimate**: 2-3 hours

### Steps

#### 5.1 Create Keyboard Handler Hook

**File**: `lib/hooks/useKeyboardShortcuts.ts`

```typescript
// Listens for P, C, S, L, Q keys
// Calls appropriate action handlers
// Disables when modals open
```

**Risk**: MEDIUM (global event listeners)  
**Validation**:

- Doesn't interfere with text inputs
- Cleans up on unmount
- Works across browsers

#### 5.2 Add Action Handlers

**File**: `components/terminal/TerminalMonitor.tsx` (update)

```typescript
// handlePause() - Not implemented yet (future)
// handleCancel() - Call existing cancel endpoint
// handleSave() - Trigger checkpoint save (future)
// handleViewLogs() - Open modal with full logs
// handleQuit() - Navigate away
```

**Risk**: MEDIUM (calls existing APIs)  
**Validation**:

- Cancel works (already tested)
- Navigation doesn't break
- Modals open/close correctly

#### 5.3 Create Log Modal

**File**: `components/terminal/LogModal.tsx`

```typescript
// Full-screen modal with complete logs
// Search/filter functionality
// Export logs to file
```

**Risk**: LOW (overlay component)  
**Validation**:

- Opens/closes without issues
- Search works
- Export downloads file

---

## 📋 Phase 6: Polish & Optimization (LOW RISK)

**Goal**: Add themes, animations, performance tuning  
**Files to Modify**: 5-10  
**Lines of Code**: ~200-300  
**Time Estimate**: 2-3 hours

### Steps

#### 6.1 Add Theme Support

**File**: `lib/contexts/TerminalTheme.tsx`

```typescript
// Context for theme switching
// Themes: Classic Green, Cyberpunk, Modern Dark
// Persists to localStorage
```

**Risk**: LOW (cosmetic)  
**Validation**: Themes switch correctly

#### 6.2 Add Animations

**Files**: Various component updates

```typescript
// - Pulsing status indicator
// - Smooth progress bar updates
// - Fade-in for new log entries
// - Blink cursor on active areas
```

**Risk**: LOW (CSS animations)  
**Validation**: Doesn't cause jank

#### 6.3 Performance Optimization

**Actions**:

- Memoize heavy calculations
- useMemo for sparkline data processing
- useCallback for event handlers
- React.memo for static panels
**Risk**: LOW (improvements only)  
**Validation**: No regression in performance

#### 6.4 Add WebSocket (If Deferred)

**File**: Implement 4.1, 4.3 if skipped earlier  
**Risk**: HIGH (see Phase 4)  
**Validation**: See Phase 4

---

## 📋 Phase 7: Page Integration & Testing (MEDIUM RISK)

**Goal**: Create new route and validate end-to-end  
**Files to Create**: 2  
**Lines of Code**: ~100-150  
**Time Estimate**: 2-3 hours

### Steps

#### 7.1 Create Terminal Monitor Page

**File**: `app/training/terminal/page.tsx`

```typescript
// New route: /training/terminal
// Uses TerminalMonitor component
// Fetches job_id from URL params
// Layout: Full screen, no nav chrome
```

**Risk**: LOW (new page, doesn't affect existing)  
**Validation**:

- Page loads without errors
- Data displays correctly
- Keyboard shortcuts work
- Responsive on all screens

#### 7.2 Add Navigation Link

**File**: `components/training/TrainingDashboard.tsx` (update)

```typescript
// Add button: "Terminal View" → /training/terminal?job_id=xxx
// Shows next to existing actions
```

**Risk**: LOW (just a link)  
**Validation**: Navigation works

#### 7.3 Comprehensive Testing

**Test Scenarios**:

1. **New Job**: Start training, monitor from beginning
2. **Running Job**: Navigate to terminal mid-training
3. **Completed Job**: View terminal after completion
4. **Failed Job**: Verify error displays correctly
5. **Cancelled Job**: Test cancel action from terminal
6. **No Job**: Handle missing job_id gracefully
7. **Polling**: Verify stops on completion
8. **Keyboard**: Test all shortcuts
9. **Responsive**: Test on mobile, tablet, desktop
10. **Theme Switch**: Verify all 3 themes work

**Risk**: NONE (validation only)  
**Validation**: All scenarios pass

---

## 📋 Phase 8: Documentation & Deployment (LOW RISK)

**Goal**: Document usage, update guides, prepare for merge  
**Files to Create**: 2-3  
**Lines of Code**: ~500-800 (markdown)  
**Time Estimate**: 1-2 hours

### Steps

#### 8.1 Create User Guide

**File**: `docs/TERMINAL_MONITOR_GUIDE.md`

```markdown
# How to use terminal monitor
# Keyboard shortcuts reference
# Troubleshooting
# FAQ
```

#### 8.2 Create Developer Notes

**File**: `lib/training/TERMINAL_MONITOR_TECH_NOTES.md`

```markdown
# Architecture decisions
# Component hierarchy
# Data flow diagram
# Performance considerations
# Future enhancements
```

#### 8.3 Update Progress Logs

**File**: `lib/training/TERMINAL_UI_PROGRESS_LOG.md` (create)

```markdown
# Track implementation progress
# Blockers encountered
# Decisions made
# Testing results
```

---

## 🎯 Implementation Strategy

### Recommended Approach: **INCREMENTAL**

**Week 1** (Foundation):

- Phase 1: Data layer (can't break anything)
- Phase 2: ASCII components (isolated, testable)
- Validate each component in Storybook/isolation

**Week 2** (Assembly):

- Phase 3: Layout assembly (visual validation)
- Phase 5: Actions (skip WebSocket)
- Create `/training/terminal` route (parallel to existing)

**Week 3** (Polish):

- Phase 6: Themes, animations, optimization
- Phase 7: Testing, edge cases
- Phase 8: Documentation

**Week 4** (Advanced - Optional):

- Phase 4: WebSocket implementation
- Performance tuning
- A/B testing with users

### Alternative: **MVP FIRST**

Build minimal viable version:

1. ✅ Phase 1 (data) + Phase 2 (components)
2. ✅ Phase 3 (layout) - basic grid, no fancy stuff
3. ✅ Phase 5.2 only (cancel action)
4. ✅ Phase 7 (new page, basic testing)
5. Ship it, iterate later

Then add:

- Phase 5.1, 5.3 (keyboard, modals)
- Phase 6 (themes, animations)
- Phase 4 (WebSocket)

---

## 📊 Estimated Totals

| Phase | Files | Lines | Risk | Time |
|-------|-------|-------|------|------|
| 1. Foundation | 3 | 200 | LOW | 2h |
| 2. ASCII Components | 8 | 400 | LOW | 3h |
| 3. Layout Assembly | 7 | 350 | MED | 3h |
| 4. Real-Time (skip MVP) | 3 | 300 | HIGH | 4h |
| 5. Interactivity | 4 | 200 | MED | 3h |
| 6. Polish | 10 | 300 | LOW | 3h |
| 7. Integration | 2 | 150 | MED | 3h |
| 8. Documentation | 3 | 700 | LOW | 2h |
| **TOTAL** | **40** | **2,600** | **MED** | **23h** |

**MVP Total** (Phases 1,2,3,5.2,7): ~15 files, ~1,100 lines, ~14 hours

---

## 🚦 Decision Points

### Before Starting

**Question**: Build full version or MVP first?

- **MVP**: Faster, lower risk, can ship in 2-3 days
- **Full**: Complete feature, better UX, takes 1-2 weeks

**Question**: Use WebSocket or polling?

- **Polling**: Reuse existing infrastructure, works today
- **WebSocket**: Better performance, requires server changes

**Question**: Replace old UI or keep both?

- **Keep Both**: Safer, users can choose, A/B test possible
- **Replace**: Simpler, force adoption, less maintenance

### My Recommendation

1. ✅ **Build MVP first** (Phases 1,2,3,5.2,7)
2. ✅ **Use polling** (defer WebSocket to Phase 6+)
3. ✅ **Keep both UIs** initially (`/monitor` vs `/terminal`)
4. ✅ **Ship terminal UI** to new route
5. ✅ **Gather feedback**, iterate
6. ⏳ Add polish (themes, keyboard, animations)
7. ⏳ Add WebSocket if needed
8. ⏳ Replace old UI only after validation

---

## 🧪 Testing Checklist (Per Phase)

### Before Committing Each Phase

- [ ] TypeScript compiles with no errors
- [ ] ESLint/Prettier pass
- [ ] No console errors in browser
- [ ] Component renders as expected
- [ ] No hydration mismatches
- [ ] No performance regressions
- [ ] Works on Chrome, Firefox, Safari
- [ ] Responsive on mobile/tablet/desktop
- [ ] Existing pages still work (smoke test)
- [ ] Training server unaffected

### Final Integration Test

- [ ] Start new training job
- [ ] Navigate to `/training/terminal?job_id=xxx`
- [ ] Verify all panels show data
- [ ] Let training run 5 minutes, verify updates
- [ ] Test cancel action
- [ ] Verify polling stops after cancellation
- [ ] Test on 3 screen sizes
- [ ] Test all keyboard shortcuts
- [ ] Complete training, verify completion state
- [ ] Check logs for errors

---

## 📝 Next Steps

**Ready to proceed?** Here's what I'll do:

1. **Create progress log** to track implementation
2. **Start with Phase 1** (safest, can't break anything)
3. **Validate each file** before moving to next
4. **Report after each phase** for your approval
5. **Stop immediately** if anything breaks

**Your call, Chief!** 🫡

Should I:

- A) Start Phase 1 (Foundation) now?
- B) Create progress log first, then wait for approval?
- C) Build the full MVP in one session (14h work)?
- D) Something else?

Let me know how granular you want this - I can do one file at a time or batch by phase!
