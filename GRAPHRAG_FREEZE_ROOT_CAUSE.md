# GraphRAG Freeze Root Cause Analysis

## Executive Summary

**Problem**: Clicking "Add to KGraph" button freezes the entire application

**Root Cause**: Graphiti service is NOT running (port 8001)

**Evidence**:
- curl http://localhost:8001/health FAILED
- No process listening on port 8001
- Graphiti client configured to connect to http://localhost:8001 (`.env` line 37)

---

## Technical Analysis

### 1. The Freeze Path

**User Action**: Clicks "Add to KGraph" button on a conversation

**Code Flow**:
```
components/Chat.tsx:956
  └─> handlePromoteConversation()
      └─> fetch("/api/conversations/promote")

app/api/conversations/promote/route.ts:165
  └─> await episodeService.addDocument(...)

lib/graphrag/graphiti/episode-service.ts:53
  └─> await this.client.addEpisode(episode)

lib/graphrag/graphiti/client.ts:129-133
  └─> await this.request('/episodes', {POST})
      └─> await fetch('http://localhost:8001/episodes')

          ❌ CONNECTION REFUSED - Service not running
          ⏱️ Waits for timeout (300000ms = 5 minutes)
```

### 2. Why It Times Out

From `lib/graphrag/graphiti/client.ts` (lines 69-73):
```typescript
constructor(config?: Partial<GraphitiConfig>) {
  this.baseUrl = config?.baseUrl ||
                 process.env.GRAPHITI_API_URL ||
                 'http://localhost:8001';
  const defaultTimeout = parseInt(
    process.env.GRAPHITI_TIMEOUT || '300000',
    10
  );
  this.timeout = config?.timeout || defaultTimeout;
}
```

**Configuration**:
- URL: `http://localhost:8001` (from `.env` line 37)
- Timeout: `300000ms` (5 minutes)
- Timeout IS configured with AbortController (lines 85-86)

**The Problem**:
- The timeout is set to **5 MINUTES**
- User experiences this as a "freeze" because there's no UI feedback
- After 5 minutes, it would throw an error: `"Graphiti API timeout after 300000ms"`

---

## 3. Environment Configuration

**File**: `.env` (Lines 30-37)
```bash
# Neo4j Configuration (for GraphRAG Knowledge Graph)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password123

# Graphiti Service (GraphRAG)
GRAPHITI_API_URL=http://localhost:8001
```

**Expected Services**:
1. **Neo4j Database**: Port 7687 (bolt protocol)
2. **Graphiti API**: Port 8001 (HTTP REST API)

---

## 4. Verification Commands

### Check if Graphiti service is running:
```bash
curl http://localhost:8001/health
```
**Expected**: `{"status":"healthy"}` or `{"status":"ok"}`
**Actual**: Connection refused

### Check if Neo4j is running:
```bash
# Windows
netstat -ano | findstr :7687
netstat -ano | findstr :8001

# Linux/Mac
lsof -i :7687
lsof -i :8001
```

### Check Docker containers:
```bash
docker ps | grep neo4j
docker ps | grep graphiti
```

---

## 5. How to Fix

### Option A: Start Graphiti Services (Linux/Mac/WSL)

**Script Location**: `start-graphiti.sh`

```bash
./start-graphiti.sh
```

This will:
1. Start Neo4j database (Docker container on port 7687)
2. Start Graphiti wrapper server (Python on port 8001)
3. Wait for services to become healthy
4. Display service URLs and credentials

### Option B: Manual Startup

#### Step 1: Start Neo4j
```bash
cd graphiti-main
docker-compose up -d neo4j
```

#### Step 2: Start Graphiti Wrapper
```bash
cd graphiti-wrapper
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install fastapi uvicorn pydantic graphiti-core
python main.py
```

### Option C: Windows Alternative

Since `start-graphiti.sh` is a bash script, on Windows you'll need:
- **WSL (Windows Subsystem for Linux)**: Run the script in WSL
- **Git Bash**: Run the script in Git Bash
- **PowerShell Equivalent**: Need to create a `.ps1` version

---

## 6. Verification After Fix

### 1. Check Graphiti Health
```bash
curl http://localhost:8001/health
```
Expected response:
```json
{"status":"healthy","version":"1.0.0"}
```

### 2. Check Neo4j Browser
Open in browser: `http://localhost:7474`
- Username: `neo4j`
- Password: `password123`

### 3. Test in Application
1. Go to chat page
2. Click "Add to KGraph" on a conversation
3. Should see "Graph" badge appear within seconds
4. No freeze

---

## 7. Alternative Fix: Better Error Handling

If Graphiti service is intentionally not running, we should handle this gracefully:

### Quick Fix Options:

**Option 1**: Reduce timeout (make it fail faster)
```env
# In .env
GRAPHITI_TIMEOUT=10000  # 10 seconds instead of 5 minutes
```

**Option 2**: Add loading indicator in UI
- Show spinner when promoting conversation
- Show error message if promotion fails
- Don't block the entire UI

**Option 3**: Check service availability first
- Add health check before attempting promotion
- Disable "Add to KGraph" button if service is down
- Show warning: "GraphRAG service not available"

---

## 8. Files Involved

| File | Purpose | Status |
|------|---------|--------|
| `.env` | Configuration | ✅ Configured correctly |
| `lib/graphrag/graphiti/client.ts` | API client | ✅ Has timeout configured |
| `lib/graphrag/graphiti/episode-service.ts` | Service layer | ✅ Working as designed |
| `app/api/conversations/promote/route.ts` | API endpoint | ⚠️ No error handling for service down |
| `components/Chat.tsx` | UI component | ⚠️ No loading indicator |
| `start-graphiti.sh` | Service startup | ❌ Not executed |

---

## 9. Recommended Actions

### Immediate (Fixes the freeze):
1. ✅ **Start Graphiti services** using `start-graphiti.sh`
2. ✅ **Verify** with `curl http://localhost:8001/health`
3. ✅ **Test** "Add to KGraph" button in UI

### Short-term (Better UX):
1. Add loading spinner when promoting conversation
2. Reduce timeout from 5 minutes to 10-30 seconds
3. Show error message if Graphiti is unavailable

### Long-term (Production-ready):
1. Add health check before enabling GraphRAG features
2. Disable "Add to KGraph" button when service is down
3. Add service status indicator in UI
4. Consider making promotion async (background job)

---

## 10. Summary

**What happened**:
- User clicked "Add to KGraph"
- API tried to connect to http://localhost:8001
- Service is not running
- Connection waits for 5-minute timeout
- User experiences this as "freeze"

**Why it happened**:
- Graphiti service was never started
- No service health check before attempting connection
- No UI feedback during long-running operation

**How to fix**:
- Start Graphiti services with `./start-graphiti.sh`
- Or improve error handling if service is intentionally disabled
