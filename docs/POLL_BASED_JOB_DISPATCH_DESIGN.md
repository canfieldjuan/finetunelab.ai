# Poll-Based Job Dispatch Design

## Overview

This document describes the architecture for enabling local training agents to receive jobs from the FineTune Lab backend via polling, eliminating the need for the backend to reach the agent directly.

## Current State (Broken)

```
Cloud Server (Render)          User's Machine
       |                              |
       |  POST /api/training/execute  |
       |----------------------------->| localhost:8000
       |        X FAILS X             |
       |   (can't reach localhost)    |
```

**Current flow:**
1. User clicks "Start Training" in web UI
2. Next.js server tries to POST to `NEXT_PUBLIC_TRAINING_SERVER_URL` (localhost:8000)
3. FAILS - cloud server cannot reach user's localhost

## Target Architecture (Poll-Based)

```
Cloud Server (Render)          User's Machine
       |                              |
       |  GET /api/training/agent/poll|
       |<-----------------------------|  Agent polls every 10s
       |                              |
       |  { job: { id, config, ... } }|
       |----------------------------->|  Returns pending job
       |                              |
       |  PUT /api/training/local/    |
       |      {jobId}/metrics         |
       |<-----------------------------|  Agent reports metrics
       |                              |
       |  PATCH /api/training/local/  |
       |        {jobId}/status        |
       |<-----------------------------|  Agent updates status
```

**New flow:**
1. User clicks "Start Training" in web UI
2. Backend creates job with status `pending` in `local_training_jobs`
3. Agent polls `GET /api/training/agent/poll` (authenticated with API key)
4. Backend returns next pending job assigned to this agent
5. Agent claims job (status -> `running`)
6. Agent executes training, reports metrics
7. Agent marks job complete/failed

## Database Changes

### New Column: `agent_id`

Add to `local_training_jobs` table:
```sql
ALTER TABLE local_training_jobs
ADD COLUMN IF NOT EXISTS agent_id TEXT,
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_local_training_jobs_agent_pending
ON local_training_jobs(agent_id, status)
WHERE status IN ('pending', 'running');

COMMENT ON COLUMN local_training_jobs.agent_id IS 'ID of the agent that claimed/is executing this job';
COMMENT ON COLUMN local_training_jobs.claimed_at IS 'Timestamp when agent claimed the job';
```

### Job Status Flow

```
pending -> running -> completed
    |         |
    |         +-> failed
    |         +-> cancelled
    +-> cancelled (before claimed)
```

## API Changes

### New Endpoint: `GET /api/training/agent/poll`

**Purpose:** Agent polls for pending jobs assigned to the authenticated user.

**Authentication:** API key with `training` scope (reuse existing scope)

**Request:**
```http
GET /api/training/agent/poll
Authorization: Bearer wak_xxxxx
X-Agent-ID: agent_abc123
```

**Response (job available):**
```json
{
  "job": {
    "id": "job_uuid",
    "job_token": "secure_token_for_metrics",
    "model_name": "Qwen/Qwen2-0.5B",
    "dataset_path": "/path/to/dataset",
    "config": { ... },
    "created_at": "2025-01-07T12:00:00Z"
  }
}
```

**Response (no jobs):**
```json
{
  "job": null,
  "poll_interval_seconds": 10
}
```

### New Endpoint: `POST /api/training/agent/claim/{jobId}`

**Purpose:** Agent claims a job before executing (prevents race conditions).

**Request:**
```http
POST /api/training/agent/claim/job_uuid
Authorization: Bearer wak_xxxxx
X-Agent-ID: agent_abc123
```

**Response:**
```json
{
  "success": true,
  "job_token": "secure_token_for_metrics"
}
```

### Modified: Job Creation Flow

When user starts training:
1. Create job with `status: 'pending'`, `agent_id: null`
2. Do NOT call agent directly
3. Return job_id to UI immediately
4. UI shows "Waiting for agent..." status

## Agent Changes (Python)

### New: Job Poller Service

Add `src/services/job_poller.py`:
```python
class JobPoller:
    """Polls backend for pending jobs"""

    def __init__(self, backend_url: str, api_key: str, agent_id: str):
        self.backend_url = backend_url
        self.api_key = api_key
        self.agent_id = agent_id
        self.poll_interval = 10  # seconds

    async def poll_for_job(self) -> Optional[dict]:
        """Poll backend for next available job"""
        # GET /api/training/agent/poll
        # Returns job or None

    async def claim_job(self, job_id: str) -> Optional[str]:
        """Claim a job, returns job_token if successful"""
        # POST /api/training/agent/claim/{job_id}

    async def run(self):
        """Main polling loop"""
        while True:
            job = await self.poll_for_job()
            if job:
                token = await self.claim_job(job['id'])
                if token:
                    await self.execute_job(job, token)
            await asyncio.sleep(self.poll_interval)
```

### Modified: Config

Add to `src/config.py`:
```python
# Agent identity
agent_id: str = ""  # Generated on first run, stored in ~/.finetunelab/agent_id
api_key: str = ""   # User's API key with training scope

# Polling
poll_interval_seconds: int = 10
poll_enabled: bool = True  # Set to False for local dev mode
```

### Modified: Main Entry Point

Update `src/main.py` to start poller on startup:
```python
@app.on_event("startup")
async def startup_event():
    # Existing startup code...

    # Start job poller if enabled
    if settings.poll_enabled and settings.api_key:
        asyncio.create_task(job_poller.run())
```

## Files to Modify

### Backend (Next.js)

| File | Change |
|------|--------|
| `app/api/training/agent/poll/route.ts` | NEW - Poll endpoint |
| `app/api/training/agent/claim/[jobId]/route.ts` | NEW - Claim endpoint |
| `lib/training/providers/local-provider.ts` | MODIFY - Remove direct agent call |
| `supabase/migrations/YYYYMMDD_add_agent_columns.sql` | NEW - Add agent_id column |

### Agent (Python)

| File | Change |
|------|--------|
| `src/services/job_poller.py` | NEW - Polling service |
| `src/config.py` | MODIFY - Add api_key, agent_id settings |
| `src/main.py` | MODIFY - Start poller on startup |
| `.env.example` | MODIFY - Add API_KEY, AGENT_ID |

## Security Considerations

1. **API Key Scope:** Use existing `training` scope - no new scope needed
2. **Job Token:** Returned only after successful claim, used for metrics auth
3. **Agent ID:** Prevents one user's agent from claiming another user's jobs
4. **Rate Limiting:** Poll endpoint should have reasonable rate limits

## Backward Compatibility

1. **Local dev mode:** Keep direct HTTP dispatch for `localhost` URLs
2. **Existing jobs:** Jobs without `agent_id` work as before
3. **Gradual rollout:** Feature flag for poll-based dispatch

## Implementation Phases

### Phase 1: Database & API (Backend)
- Add `agent_id`, `claimed_at` columns to `local_training_jobs`
- Create `GET /api/training/agent/poll` endpoint
- Create `POST /api/training/agent/claim/{jobId}` endpoint

### Phase 2: Agent Poller (Python)
- Add `job_poller.py` service
- Update config for API key and agent ID
- Integrate poller into main.py startup

### Phase 3: Job Creation Flow
- Modify `local-provider.ts` to skip direct agent call for remote URLs
- Update UI to show "Waiting for agent..." status
- Add agent connection status indicator

### Phase 4: Testing & Documentation
- Integration tests for poll/claim flow
- Update README and QUICK_START docs
- Add troubleshooting guide

## Open Questions

1. Should we support multiple agents per user? (Current design: yes, via agent_id)
2. Job assignment strategy: FIFO or priority-based?
3. Timeout for unclaimed jobs?
