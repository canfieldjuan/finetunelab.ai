# Training Agent Worker Registration Implementation Plan
**Date**: 2025-12-30
**Status**: Awaiting Approval
**Objective**: Add worker registration and heartbeat functionality to Python training-agent v0.1.0

---

## Problem Statement

The current training-agent v0.1.0 does NOT register with the platform's worker management system. When started, it:
- ❌ Does NOT call `/api/workers/register`
- ❌ Does NOT send heartbeats to `/api/workers/{workerId}/heartbeat`
- ❌ Does NOT appear in the UI's "My Workers" tab
- ❌ Does NOT have `api_key` field in Settings (crashes with Pydantic validation error)
- ❌ Does NOT collect/report worker metrics (CPU, memory)

## Root Cause Analysis

**File**: `~/.finetunelab/training-agent/src/config.py`
- Settings class missing `api_key` field
- No worker identification (hostname, platform detection)

**File**: `~/.finetunelab/training-agent/src/api/backend_client.py`
- Only has training job metrics reporting
- Missing worker registration method
- Missing heartbeat method

**File**: `~/.finetunelab/training-agent/src/main.py`
- No worker registration on startup
- No heartbeat background task

**File**: `~/.finetunelab/training-agent/.env`
- Has `API_KEY=wak_your_worker_api_key_here` but Settings rejects it as "extra forbidden"

---

## Platform Requirements (Verified from API code)

### 1. Worker Registration
**Endpoint**: `POST /api/workers/register`

**Request**:
```json
{
  "api_key": "wak_...",
  "hostname": "my-machine",
  "platform": "linux" | "darwin" | "windows",
  "version": "0.1.0",
  "capabilities": ["training"],
  "metadata": {}
}
```

**Response**:
```json
{
  "worker_id": "wkr_...",
  "websocket_url": "wss://...",
  "heartbeat_interval_seconds": 30,
  "max_concurrency": 1
}
```

**Authentication**: API key sent in request body (registration only)

---

### 2. Worker Heartbeat
**Endpoint**: `POST /api/workers/{workerId}/heartbeat`

**Headers**:
```
X-API-Key: wak_...
```

**Request**:
```json
{
  "status": "online" | "error",
  "current_load": 0,
  "metrics": {
    "cpu_percent": 45.2,
    "memory_used_mb": 2048,
    "memory_total_mb": 8192
  }
}
```

**Response**:
```json
{
  "ok": true,
  "pending_commands": []
}
```

**Frequency**: Every 30 seconds

---

## Phased Implementation Plan

### **Phase 1: Configuration Updates** (5 minutes)

**Objective**: Add API key and worker identification to Settings

**Files to Modify**:
1. `~/.finetunelab/training-agent/src/config.py`

**Changes**:
```python
class Settings(BaseSettings):
    # Backend Configuration
    backend_url: str = "http://localhost:3000"
    api_key: str  # ADD THIS - Required field

    # Worker Identification (NEW)
    worker_hostname: Optional[str] = None  # Auto-detect if None
    worker_platform: Optional[str] = None  # Auto-detect if None
    worker_version: str = "0.1.0"
    worker_capabilities: list[str] = ["training"]

    # Existing fields...
```

**Verification Steps**:
1. Update Settings class
2. Run `python -m src.config` - should not crash
3. Verify `.env` file `API_KEY` is now accepted

**Critical**: This fixes the Pydantic validation error that causes crash loop.

---

### **Phase 2: Worker Registration Module** (10 minutes)

**Objective**: Create module to register worker with platform

**Files to Create**:
1. `~/.finetunelab/training-agent/src/api/worker_client.py` (NEW)

**Implementation**:
```python
"""
Worker registration and lifecycle management
"""
import platform
import socket
import httpx
from loguru import logger
from typing import Optional

from src.config import settings


class WorkerClient:
    """Handles worker registration and heartbeat with platform"""

    def __init__(self):
        self.base_url = settings.backend_url
        self.api_key = settings.api_key
        self.worker_id: Optional[str] = None
        self.heartbeat_interval = 30
        self.timeout = httpx.Timeout(10.0)

    def get_hostname(self) -> str:
        """Get machine hostname"""
        if settings.worker_hostname:
            return settings.worker_hostname
        return socket.gethostname()

    def get_platform(self) -> str:
        """Detect platform: linux, darwin, windows"""
        if settings.worker_platform:
            return settings.worker_platform

        sys_platform = platform.system().lower()
        if 'linux' in sys_platform:
            return 'linux'
        elif 'darwin' in sys_platform:
            return 'darwin'
        elif 'windows' in sys_platform:
            return 'windows'
        return 'linux'  # Default

    async def register(self) -> bool:
        """
        Register worker with platform
        Returns True if successful
        """
        url = f"{self.base_url}/api/workers/register"

        payload = {
            "api_key": self.api_key,
            "hostname": self.get_hostname(),
            "platform": self.get_platform(),
            "version": settings.worker_version,
            "capabilities": settings.worker_capabilities,
            "metadata": {
                "python_version": platform.python_version(),
                "cpu_count": platform.machine(),
            }
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()

                data = response.json()
                self.worker_id = data["worker_id"]
                self.heartbeat_interval = data.get("heartbeat_interval_seconds", 30)

                logger.info(f"Worker registered successfully: {self.worker_id}")
                logger.info(f"Heartbeat interval: {self.heartbeat_interval}s")
                return True

        except httpx.HTTPError as e:
            logger.error(f"Failed to register worker: {e}")
            if hasattr(e, 'response') and e.response:
                logger.error(f"Response: {e.response.text}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during registration: {e}")
            return False

    async def send_heartbeat(self, current_load: int = 0, metrics: dict = None) -> bool:
        """
        Send heartbeat to platform
        Returns True if successful
        """
        if not self.worker_id:
            logger.error("Cannot send heartbeat: worker not registered")
            return False

        url = f"{self.base_url}/api/workers/{self.worker_id}/heartbeat"

        headers = {
            "X-API-Key": self.api_key,
        }

        payload = {
            "status": "online",
            "current_load": current_load,
        }

        if metrics:
            payload["metrics"] = metrics

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()

                logger.debug(f"Heartbeat sent successfully")
                return True

        except httpx.HTTPError as e:
            logger.error(f"Failed to send heartbeat: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending heartbeat: {e}")
            return False


# Global worker client instance
worker_client = WorkerClient()
```

**Verification Steps**:
1. Create `worker_client.py`
2. Test import: `python -c "from src.api.worker_client import worker_client"`
3. Verify no syntax errors

**Critical**: This handles all platform communication for worker lifecycle.

---

### **Phase 3: System Metrics Collection** (5 minutes)

**Objective**: Collect CPU, memory metrics for heartbeat

**Files to Create**:
1. `~/.finetunelab/training-agent/src/monitoring/system_monitor.py` (NEW)

**Implementation**:
```python
"""
System metrics monitoring (CPU, memory, disk)
"""
import psutil
from typing import Dict


class SystemMonitor:
    """Collects system resource metrics"""

    def get_metrics(self) -> Dict[str, float]:
        """
        Get current system metrics

        Returns:
            Dict with cpu_percent, memory_used_mb, memory_total_mb
        """
        try:
            memory = psutil.virtual_memory()

            return {
                "cpu_percent": psutil.cpu_percent(interval=0.1),
                "memory_used_mb": memory.used / (1024 * 1024),
                "memory_total_mb": memory.total / (1024 * 1024),
            }
        except Exception as e:
            print(f"Error collecting system metrics: {e}")
            return {
                "cpu_percent": 0.0,
                "memory_used_mb": 0.0,
                "memory_total_mb": 0.0,
            }


# Global system monitor instance
system_monitor = SystemMonitor()
```

**Dependencies**: Requires `psutil` package (already in requirements.txt)

**Verification Steps**:
1. Create `system_monitor.py`
2. Test: `python -c "from src.monitoring.system_monitor import system_monitor; print(system_monitor.get_metrics())"`
3. Verify metrics are collected

---

### **Phase 4: Heartbeat Background Task** (10 minutes)

**Objective**: Add background task that sends heartbeat every 30 seconds

**Files to Modify**:
1. `~/.finetunelab/training-agent/src/main.py`

**Changes**:
```python
# Add imports at top
import asyncio
from src.api.worker_client import worker_client
from src.monitoring.system_monitor import system_monitor

# Add background task function
async def heartbeat_loop():
    """Background task that sends heartbeat every N seconds"""
    logger.info("Starting heartbeat loop")

    while True:
        try:
            # Get current load (number of active training jobs)
            current_load = len(training_executor.jobs)

            # Get system metrics
            metrics = system_monitor.get_metrics()

            # Send heartbeat
            await worker_client.send_heartbeat(
                current_load=current_load,
                metrics=metrics
            )

            # Wait for heartbeat interval
            await asyncio.sleep(worker_client.heartbeat_interval)

        except Exception as e:
            logger.error(f"Error in heartbeat loop: {e}")
            # Wait a bit before retrying
            await asyncio.sleep(5)

# Modify startup_event
@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    logger.info("=" * 60)
    logger.info("FineTune Lab Training Agent Starting")
    logger.info("=" * 60)

    # Register worker with platform
    logger.info("Registering worker with platform...")
    success = await worker_client.register()

    if not success:
        logger.error("Failed to register worker - exiting")
        raise RuntimeError("Worker registration failed")

    logger.info(f"Worker ID: {worker_client.worker_id}")

    # Start heartbeat background task
    asyncio.create_task(heartbeat_loop())
    logger.info("Heartbeat loop started")

    # Existing startup code...
```

**Verification Steps**:
1. Update `main.py` with registration and heartbeat
2. Check syntax: `python -m py_compile src/main.py`
3. Verify no import errors

**Critical**: This is what makes the worker appear in the UI.

---

### **Phase 5: Update .env Template** (2 minutes)

**Objective**: Update .env with correct API_KEY field

**Files to Modify**:
1. `~/.finetunelab/training-agent/.env.example` (if exists)
2. User's `~/.finetunelab/training-agent/.env`

**Changes**:
```env
# FineTune Lab Backend
BACKEND_URL=http://localhost:3000
API_KEY=wak_your_worker_api_key_here  # Keep this - now accepted

# Worker Configuration (Optional - auto-detected if not set)
# WORKER_HOSTNAME=my-custom-hostname
# WORKER_PLATFORM=linux
WORKER_VERSION=0.1.0
WORKER_CAPABILITIES=["training"]

# Rest of config...
```

**Verification Steps**:
1. Verify `.env` has `API_KEY` field
2. User should replace `wak_your_worker_api_key_here` with actual key from UI

---

### **Phase 6: Testing & Verification** (10 minutes)

**Objective**: Verify worker registers and appears in UI

**Test Steps**:

1. **Stop current service**:
   ```bash
   ~/.finetunelab/training-agent/scripts/agentctl stop
   ```

2. **Update .env with real API key**:
   ```bash
   nano ~/.finetunelab/training-agent/.env
   # Replace API_KEY=wak_your_worker_api_key_here with actual key
   ```

3. **Test configuration loads**:
   ```bash
   cd ~/.finetunelab/training-agent
   python -c "from src.config import settings; print(settings.api_key)"
   # Should print your API key, not crash
   ```

4. **Start service**:
   ```bash
   ~/.finetunelab/training-agent/scripts/agentctl start
   ```

5. **Check logs**:
   ```bash
   ~/.finetunelab/training-agent/scripts/agentctl logs
   # Look for:
   # - "Registering worker with platform..."
   # - "Worker registered successfully: wkr_..."
   # - "Worker ID: wkr_..."
   # - "Heartbeat loop started"
   # - "Heartbeat sent successfully" (every 30s)
   ```

6. **Verify in UI**:
   - Navigate to platform UI → Worker Agents → My Workers tab
   - Worker should appear with status "Online"
   - Should show hostname, platform, version
   - Metrics should update every 30 seconds

**Success Criteria**:
- ✅ Service starts without crashing
- ✅ Worker registers successfully (logs show worker_id)
- ✅ Worker appears in UI "My Workers" tab
- ✅ Status shows "Online" (green)
- ✅ Heartbeat logs appear every 30 seconds
- ✅ Metrics update in UI (CPU, memory)
- ✅ No Pydantic validation errors

---

## Files Changed Summary

### Modified Files (5):
1. `src/config.py` - Add api_key and worker fields
2. `src/main.py` - Add registration and heartbeat loop
3. `.env` - Keep API_KEY field (now accepted)
4. `.env.example` - Document API_KEY field
5. `scripts/install.sh` - Update to keep API_KEY in .env

### New Files (2):
1. `src/api/worker_client.py` - Worker registration and heartbeat
2. `src/monitoring/system_monitor.py` - System metrics collection

### Dependencies:
- `psutil` - Already in requirements.txt
- `httpx` - Already in requirements.txt
- `socket`, `platform`, `asyncio` - Python stdlib

---

## Rollback Plan

If implementation fails:

1. **Revert config.py**:
   ```bash
   git checkout src/config.py
   ```

2. **Remove new files**:
   ```bash
   rm src/api/worker_client.py
   rm src/monitoring/system_monitor.py
   ```

3. **Revert main.py**:
   ```bash
   git checkout src/main.py
   ```

4. **Restart service**:
   ```bash
   ~/.finetunelab/training-agent/scripts/agentctl restart
   ```

---

## Post-Implementation Tasks

1. **Update UI download links** to point to new release with worker registration
2. **Create v0.2.0 release** with worker registration functionality
3. **Update setup instructions** in UI to reflect new simpler flow
4. **Test on all platforms** (Linux tested, need macOS/Windows)

---

## Breaking Changes

**None** - This is purely additive:
- Adds new required field `api_key` to Settings (already in .env)
- Adds new modules (doesn't modify existing functionality)
- Existing training job execution still works
- Existing metrics reporting still works

The only "breaking" change is that the service will exit if registration fails, but this is intentional and safer than running without platform connection.

---

## Timeline Estimate

- Phase 1: Configuration Updates - 5 minutes
- Phase 2: Worker Registration Module - 10 minutes
- Phase 3: System Metrics Collection - 5 minutes
- Phase 4: Heartbeat Background Task - 10 minutes
- Phase 5: Update .env Template - 2 minutes
- Phase 6: Testing & Verification - 10 minutes

**Total**: ~42 minutes

---

## Approval Required

**User**: Please review this plan and approve before implementation.

**Questions to Answer**:
1. ✅ Does this approach solve the registration problem?
2. ✅ Are there any concerns about the phased approach?
3. ✅ Should we proceed with implementation?

**Once approved, I will**:
1. Execute each phase in order
2. Verify each phase before moving to next
3. Test thoroughly after completion
4. Provide detailed results
