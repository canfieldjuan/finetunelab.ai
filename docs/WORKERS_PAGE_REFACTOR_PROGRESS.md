# Workers Page Refactor - Progress Log

## Session: 2026-01-07

### Context
Refactoring the Workers page to work with the new poll-based job dispatch system implemented in previous sessions.

### Previous Work Completed
1. **Poll-based job dispatch** (Phases 1-4 COMPLETE)
   - Backend API: poll/claim endpoints
   - Agent poller: Python service
   - Local provider: Skip direct dispatch for remote URLs
   - Documentation: Design doc, README updates
   - Release: training-agent v0.2.0

2. **Worker system cleanup** (COMPLETE)
   - Removed unused Go worker-agent
   - Removed `/api/workers/*` endpoints
   - Removed `worker` scope from API key validator
   - Removed worker database migration

### Current Task
Refactor Workers page for poll-based training agent with:
- Seamless download experience
- Auto-configuration with user credentials
- Agent connection status monitoring
- No manual `.env` editing required

### Investigation Results

**Files in `main` branch (deleted from `local-worker-agent`):**
```
D  app/api/workers/[workerId]/heartbeat/route.ts
D  app/api/workers/[workerId]/route.ts
D  app/api/workers/commands/[commandId]/result/route.ts
D  app/api/workers/commands/route.ts
D  app/api/workers/download/[platform]/route.ts
D  app/api/workers/register/route.ts
D  app/api/workers/route.ts
D  app/workers/page.tsx
D  components/workers/WorkerAgentListSection.tsx
D  components/workers/WorkerAgentManagement.tsx
D  components/workers/WorkerAgentSetupSection.tsx
D  components/workers/WorkerCard.tsx
D  components/workers/WorkerDetailsModal.tsx
D  lib/workers/platform-utils.ts
D  lib/workers/types.ts
```

**Key Findings:**
1. Old system used `worker` scope (removed) - must use `training` scope
2. Old system had worker registration/heartbeat - replaced by polling
3. Download endpoint fetches from GitHub - can be restored as-is
4. Setup instructions pass API_KEY via environment - need to add BACKEND_URL
5. Agent status was tracked via heartbeat - need to track via poll timestamps

### Implementation Plan Created
See: `docs/WORKERS_PAGE_REFACTOR_PLAN.md`

**Phases:**
1. Restore core files from main
2. Create agent status tracking (database + API)
3. Refactor UI components
4. Update platform utils
5. Documentation & cleanup

### Status: AWAITING APPROVAL

---

## Checkpoints

### Checkpoint 1: Investigation Complete
- [x] Identified all deleted files
- [x] Analyzed old system architecture
- [x] Identified scope mismatch issue
- [x] Created implementation plan
- [x] Created progress log
- [x] User approval received

### Checkpoint 2: Phase 1 Complete
- [x] `lib/workers/types.ts` restored and updated (new TrainingAgent type)
- [x] `lib/workers/platform-utils.ts` restored (updated to v0.2.0, added BACKEND_URL)
- [x] `app/api/workers/download/[platform]/route.ts` restored (updated to v0.2.0)
- [x] TypeScript errors resolved (npm run type-check passes)
- [x] Download endpoint verified

### Checkpoint 3: Phase 2 Complete
- [x] `training_agents` table migration created (20260107000001)
- [x] Poll endpoint updates `last_poll_at` via upsert
- [x] GET `/api/training/agents` endpoint created
- [x] GET/DELETE `/api/training/agents/[agentId]` endpoint created
- [x] Agent online/offline status computed from last_poll_at
- [x] TypeScript compiles (npm run type-check passes)

### Checkpoint 4: Phase 3 Complete
- [x] Workers page created (`app/workers/page.tsx`)
- [x] TrainingAgentSetup component created (download + API key generation)
- [x] TrainingAgentStatus component created (real-time agent status)
- [x] Added to AppSidebar navigation (Training Agent in Training group)
- [x] API key generation uses `training` scope
- [x] TypeScript compiles (npm run type-check passes)

### Checkpoint 5: Phase 4 Complete (Done in Phase 1)
- [x] Setup instructions updated with BACKEND_URL
- [x] Version points to v0.2.0
- [x] Platform utils restored with new getSetupInstructions signature

### Checkpoint 6: Phase 5 Complete
- [x] Progress log updated
- [x] All phases verified complete
- [x] TypeScript compiles
- [x] Changes committed and pushed

---

## Notes for Next Session

If resuming this work:
1. Check if user approved the plan
2. If approved, proceed with Phase 1
3. Verify each phase before moving to next
4. Update this progress log as work progresses
5. Commit after each phase

## Related Files
- `docs/POLL_BASED_JOB_DISPATCH_DESIGN.md` - Original design doc
- `training-agent/README.md` - Agent documentation
- `app/api/training/agent/poll/route.ts` - Poll endpoint
- `app/api/training/agent/claim/[jobId]/route.ts` - Claim endpoint
