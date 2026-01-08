# Workers Page Refactor for Poll-Based Training Agent

## Overview

Refactor the Workers page to work with the new poll-based job dispatch system. The goal is to provide a seamless user experience where users can download the training agent, have it auto-configure with their credentials, and monitor agent connection status.

## Current State Analysis

### Files Deleted from `local-worker-agent` Branch
All workers-related files were removed in commit `ec04fa7`:

**API Routes (DELETED):**
- `app/api/workers/[workerId]/heartbeat/route.ts` - Old heartbeat system
- `app/api/workers/[workerId]/route.ts` - Worker CRUD
- `app/api/workers/commands/[commandId]/result/route.ts` - Command results
- `app/api/workers/commands/route.ts` - Command dispatch
- `app/api/workers/download/[platform]/route.ts` - Download proxy
- `app/api/workers/register/route.ts` - Worker registration
- `app/api/workers/route.ts` - List workers

**UI Components (DELETED):**
- `app/workers/page.tsx` - Workers page
- `components/workers/WorkerAgentListSection.tsx` - Worker list
- `components/workers/WorkerAgentManagement.tsx` - Tab management
- `components/workers/WorkerAgentSetupSection.tsx` - Download/setup
- `components/workers/WorkerCard.tsx` - Worker status card
- `components/workers/WorkerDetailsModal.tsx` - Worker details

**Utilities (DELETED):**
- `lib/workers/platform-utils.ts` - Platform detection, downloads
- `lib/workers/types.ts` - TypeScript interfaces

### What Exists Now (Poll-Based System)
- `app/api/training/agent/poll/route.ts` - Agent polls for jobs
- `app/api/training/agent/claim/[jobId]/route.ts` - Agent claims jobs
- `training-agent/src/services/job_poller.py` - Python polling service
- Database columns: `agent_id`, `claimed_at` in `local_training_jobs`

### Key Issues to Address
1. **Scope mismatch**: Old system used `worker` scope (removed), new uses `training` scope
2. **No agent tracking**: Poll-based system doesn't track agent status in database
3. **Manual setup**: Users must manually configure API key in `.env`
4. **No UI**: Workers page and components don't exist in branch

## Target User Experience

1. User goes to Workers page (renamed to "Training Agent")
2. User clicks "Download for [Platform]"
3. User generates API key with `training` scope
4. User runs installer with API key
5. Agent auto-configures and starts polling
6. UI shows agent connection status (based on recent polling activity)
7. Future sessions: User just starts agent, it connects automatically

## Implementation Phases

### Phase 1: Restore Core Files from Main
**Goal:** Get basic structure back without breaking changes

**Files to restore (from `main` branch):**
| File | Action | Notes |
|------|--------|-------|
| `lib/workers/types.ts` | RESTORE | Update types for new system |
| `lib/workers/platform-utils.ts` | RESTORE | Keep as-is |
| `app/api/workers/download/[platform]/route.ts` | RESTORE | Keep as-is |

**Verification:**
- [ ] Files restored correctly
- [ ] No TypeScript errors
- [ ] Download endpoint works

### Phase 2: Create Agent Status Tracking
**Goal:** Track agent connection status based on polling activity

**Database Changes:**
```sql
-- Add agent tracking table
CREATE TABLE IF NOT EXISTS training_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL UNIQUE,
  hostname TEXT,
  platform TEXT,
  version TEXT,
  status TEXT DEFAULT 'offline',
  last_poll_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_training_agents_user ON training_agents(user_id);
CREATE INDEX idx_training_agents_agent ON training_agents(agent_id);
```

**API Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `app/api/training/agents/route.ts` | GET | List user's agents |
| `app/api/training/agents/[agentId]/route.ts` | GET/DELETE | Get/delete agent |

**Modifications to Existing:**
| File | Change |
|------|--------|
| `app/api/training/agent/poll/route.ts` | Update `training_agents.last_poll_at` on each poll |

**Verification:**
- [ ] Migration applies cleanly
- [ ] Poll endpoint updates `last_poll_at`
- [ ] GET agents endpoint returns correct data
- [ ] Agent shows online if `last_poll_at` within 60 seconds

### Phase 3: Refactor UI Components
**Goal:** Create simplified Workers page for poll-based system

**New/Updated Components:**
| Component | Purpose |
|-----------|---------|
| `app/workers/page.tsx` | Simplified page (download + status) |
| `components/workers/TrainingAgentSetup.tsx` | Download + API key generation |
| `components/workers/TrainingAgentStatus.tsx` | Show connected agents |

**Key Changes from Old System:**
1. Use `training` scope instead of `worker` scope
2. Show agent status based on `last_poll_at` timestamp
3. Simplify to single-page flow (no tabs needed)
4. Remove command dispatch (not needed for training)

**Verification:**
- [ ] Page renders without errors
- [ ] Download buttons work
- [ ] API key generation uses `training` scope
- [ ] Agent status updates in real-time (polling)

### Phase 4: Update Platform Utils
**Goal:** Update setup instructions for poll-based system

**Changes to `lib/workers/platform-utils.ts`:**
1. Update setup instructions to use `BACKEND_URL` environment variable
2. Instructions should set both `API_KEY` and `BACKEND_URL`
3. Point to correct version of training-agent (v0.2.0+)

**Verification:**
- [ ] Instructions include BACKEND_URL
- [ ] Version points to v0.2.0
- [ ] Commands work on each platform

### Phase 5: Documentation & Cleanup
**Goal:** Ensure everything is documented and tested

**Tasks:**
- [ ] Update CLAUDE.md if needed
- [ ] Update training-agent README (already done)
- [ ] Remove any dead code references
- [ ] Test full flow end-to-end

## File Mapping (Old -> New)

| Old File | New File | Status |
|----------|----------|--------|
| `app/workers/page.tsx` | `app/workers/page.tsx` | RECREATE (simplified) |
| `components/workers/WorkerAgentManagement.tsx` | REMOVE | Not needed |
| `components/workers/WorkerAgentSetupSection.tsx` | `components/workers/TrainingAgentSetup.tsx` | RECREATE |
| `components/workers/WorkerAgentListSection.tsx` | `components/workers/TrainingAgentStatus.tsx` | RECREATE |
| `components/workers/WorkerCard.tsx` | REMOVE | Not needed |
| `components/workers/WorkerDetailsModal.tsx` | REMOVE | Not needed |
| `lib/workers/platform-utils.ts` | `lib/workers/platform-utils.ts` | RESTORE + UPDATE |
| `lib/workers/types.ts` | `lib/workers/types.ts` | RESTORE + UPDATE |
| `app/api/workers/download/[platform]/route.ts` | `app/api/workers/download/[platform]/route.ts` | RESTORE |
| `app/api/workers/register/route.ts` | REMOVE | Not needed |
| `app/api/workers/route.ts` | `app/api/training/agents/route.ts` | RECREATE (different) |
| `app/api/workers/[workerId]/*` | REMOVE | Not needed |

## Breaking Changes Analysis

| Area | Impact | Mitigation |
|------|--------|------------|
| `worker` scope removed | Old API keys won't work | Users generate new `training` scope key |
| Worker registration removed | Old agents won't register | Users download new agent (v0.2.0+) |
| Database schema | New table needed | Migration adds table, doesn't modify existing |

## Dependencies

- Poll-based job dispatch (COMPLETED in previous phases)
- Training agent v0.2.0 (RELEASED)
- `training` scope in API key validator (EXISTS)

## Open Questions

1. Should we auto-delete agents that haven't polled in X days?
2. Should the UI show job history per agent?
3. Should we support multiple agents per user? (Current design: YES)

## Timeline

- Phase 1: ~30 minutes
- Phase 2: ~1 hour
- Phase 3: ~1 hour
- Phase 4: ~30 minutes
- Phase 5: ~30 minutes

Total: ~3.5 hours

---

*Created: 2026-01-07*
*Status: COMPLETE*
*Completed: 2026-01-07*

## Implementation Summary

All phases completed successfully:

| Phase | Status | Commit |
|-------|--------|--------|
| Phase 1: Restore Core Files | ✅ Complete | `4e73cbd` |
| Phase 2: Agent Status Tracking | ✅ Complete | `c9ce4a7` |
| Phase 3: UI Components | ✅ Complete | `c8d0c7b` |
| Phase 4: Platform Utils | ✅ Complete | (Done in Phase 1) |
| Phase 5: Documentation | ✅ Complete | Final commit |

### Key Files Created/Modified

**API Endpoints:**
- `app/api/workers/download/[platform]/route.ts` - Download proxy
- `app/api/training/agents/route.ts` - List agents
- `app/api/training/agents/[agentId]/route.ts` - Get/delete agent
- `app/api/training/agent/poll/route.ts` - Modified to track agents

**UI Components:**
- `app/workers/page.tsx` - Training Agent page
- `components/workers/TrainingAgentSetup.tsx` - Download + setup
- `components/workers/TrainingAgentStatus.tsx` - Agent status

**Database:**
- `supabase/migrations/20260107000001_create_training_agents_table.sql`

**Utilities:**
- `lib/workers/types.ts` - TrainingAgent types
- `lib/workers/platform-utils.ts` - Platform detection
