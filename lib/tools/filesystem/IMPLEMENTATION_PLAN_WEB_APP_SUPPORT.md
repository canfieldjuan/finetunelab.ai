# Filesystem Tool - Web App Support Implementation Plan

**Date Created:** 2025-11-15
**Purpose:** Add remote filesystem access via local agent for web app deployment
**Status:** Planning Phase

---

## Overview

Convert filesystem tool from direct Node.js `fs` access (localhost only) to hybrid mode supporting both:
1. **Local mode** - Direct `fs` access (current - for desktop apps)
2. **Remote mode** - HTTP API calls to local agent (new - for web apps)

---

## Architecture Summary

### Current (Local Development):
```
Next.js Server (localhost:3000)
    │
    └─→ Direct fs.readFile() access
        └─→ User's filesystem
```

### Target (Web App):
```
Web App (fine-tune-labs.ai on Vercel)
    │
    └─→ HTTP API calls
        └─→ Local Agent (localhost:8000 on user's PC)
            └─→ User's filesystem (~/AI_Models/, ~/checkpoints/)
```

---

## Phased Implementation Plan

### **Phase 1: Local Agent Filesystem API** 🎯 START HERE
**Goal:** Add filesystem endpoints to training_server.py

**Files to Modify:**
1. `lib/training/training_server.py`

**New Endpoints:**
```python
# Models directory operations
GET  /api/filesystem/models                    # List models in AI_MODELS_DIR
GET  /api/filesystem/models/{model_name}/info  # Get model metadata
POST /api/filesystem/models/scan               # Deep scan for models

# Checkpoints operations
GET  /api/filesystem/checkpoints/{job_id}      # List checkpoints for job
GET  /api/filesystem/checkpoints/{job_id}/{checkpoint}/info  # Checkpoint metadata
POST /api/filesystem/checkpoints/{job_id}/{checkpoint}/download # Stream checkpoint

# Generic filesystem (sandboxed)
POST /api/filesystem/list                      # List directory (within allowed paths)
POST /api/filesystem/read                      # Read file (within allowed paths)
POST /api/filesystem/info                      # Get file/dir info
```

**Security Requirements:**
- ✅ Path validation (no `../` escapes)
- ✅ Whitelist allowed directories via env vars
- ✅ Size limits on file reads
- ✅ Rate limiting on API calls
- ✅ CORS configuration for web app domain

**Environment Variables:**
```bash
AI_MODELS_DIR=/home/user/AI_Models
CHECKPOINTS_DIR=/home/user/Desktop/web-ui/lib/training/logs
FILESYSTEM_ALLOWED_PATHS=/home/user/AI_Models,/home/user/checkpoints
FILESYSTEM_MAX_FILE_SIZE=104857600  # 100MB
```

**Implementation Steps:**
1. ✅ Add path validation utility functions
2. ✅ Create `/api/filesystem/models` endpoint
3. ✅ Create `/api/filesystem/checkpoints/{job_id}` endpoint
4. ✅ Create generic `/api/filesystem/list` endpoint
5. ✅ Create `/api/filesystem/read` endpoint
6. ✅ Add security middleware
7. ✅ Add comprehensive error handling
8. ✅ Test all endpoints locally

**Success Criteria:**
- Can list models via `curl http://localhost:8000/api/filesystem/models`
- Can read file via `curl -X POST http://localhost:8000/api/filesystem/read -d '{"path":"..."}'`
- Path validation blocks `../` attacks
- Returns proper error codes (400, 403, 404, 500)

---

### **Phase 2: Filesystem Tool Remote Mode**
**Goal:** Extend filesystem tool to support HTTP API calls

**Files to Modify:**
1. `lib/tools/filesystem/index.ts`
2. `lib/tools/filesystem/operations/listDirectory.ts`
3. `lib/tools/filesystem/operations/readFile.ts`
4. New: `lib/tools/filesystem/adapters/remoteAdapter.ts`
5. New: `lib/tools/filesystem/adapters/localAdapter.ts`

**Pattern: Adapter Layer**
```typescript
// Current: Direct fs calls
async listDirectory(path: string) {
  return await fs.readdir(path);
}

// New: Adapter-based
async listDirectory(path: string) {
  if (this.mode === 'remote') {
    return await this.remoteAdapter.listDirectory(path);
  }
  return await this.localAdapter.listDirectory(path);
}
```

**Implementation Steps:**
1. ✅ Create adapter interface
2. ✅ Extract current logic into `LocalAdapter`
3. ✅ Create `RemoteAdapter` (HTTP client)
4. ✅ Add mode detection (env var or config)
5. ✅ Update FilesystemTool class to use adapters
6. ✅ Test both modes

**Environment Variables:**
```bash
FILESYSTEM_MODE=remote  # 'local' or 'remote'
LOCAL_AGENT_URL=http://localhost:8000
LOCAL_AGENT_TIMEOUT=30000  # 30 seconds
```

**Success Criteria:**
- `FILESYSTEM_MODE=local` works as before (backward compatible)
- `FILESYSTEM_MODE=remote` makes HTTP calls to agent
- Errors propagate correctly in both modes
- No breaking changes to existing code

---

### **Phase 3: Web UI Integration**
**Goal:** Add agent detection and connection UI

**Files to Create:**
1. `components/filesystem/AgentDetector.tsx` - Check if agent is running
2. `components/filesystem/AgentStatus.tsx` - Show connection status
3. `components/filesystem/AgentInstallPrompt.tsx` - Guide user to install agent

**Files to Modify:**
1. `app/layout.tsx` or global provider - Add agent detection
2. `components/training/TrainingWorkflow.tsx` - Show agent status

**Implementation Steps:**
1. ✅ Create AgentDetector component
2. ✅ Add health check API call (`http://localhost:8000/health`)
3. ✅ Add visual indicators (green = connected, red = disconnected)
4. ✅ Add "Install Agent" button with instructions
5. ✅ Test cross-browser compatibility

**Success Criteria:**
- UI detects agent running on localhost:8000
- Shows clear error message if agent not running
- Provides installation instructions
- Works in Chrome, Firefox, Safari, Edge

---

### **Phase 4: Agent Installer Script**
**Goal:** Create easy installer for users

**Files to Create:**
1. `installers/install-agent.sh` (Linux/Mac)
2. `installers/install-agent.ps1` (Windows)
3. `installers/README.md` (User guide)

**Installer Features:**
- ✅ Detect OS and Python version
- ✅ Create virtual environment
- ✅ Install dependencies
- ✅ Set up systemd service (Linux) / LaunchAgent (Mac) / Task Scheduler (Windows)
- ✅ Configure firewall exceptions
- ✅ Set default AI_MODELS_DIR

**Implementation Steps:**
1. ✅ Create bash script for Linux/Mac
2. ✅ Create PowerShell script for Windows
3. ✅ Add OS detection logic
4. ✅ Add service auto-start configuration
5. ✅ Test on Ubuntu, macOS, Windows 11

**Success Criteria:**
- One-command install: `curl -sSL https://ftl.ai/install.sh | bash`
- Agent starts on system boot
- User can uninstall easily
- Works on Ubuntu 20.04+, macOS 12+, Windows 10+

---

### **Phase 5: CORS & Security Hardening**
**Goal:** Secure web app ↔ local agent communication

**Files to Modify:**
1. `lib/training/training_server.py` - Add CORS middleware

**Security Enhancements:**
- ✅ CORS whitelist: Only allow fine-tune-labs.ai domain
- ✅ Optional: JWT token authentication
- ✅ Optional: User approval for each filesystem operation
- ✅ Rate limiting per IP
- ✅ Request signing to prevent CSRF

**Implementation Steps:**
1. ✅ Add FastAPI CORS middleware
2. ✅ Configure allowed origins
3. ✅ Add request validation
4. ✅ Add optional JWT auth layer
5. ✅ Test with production web app domain

**Environment Variables:**
```bash
CORS_ALLOWED_ORIGINS=https://fine-tune-labs.ai,http://localhost:3000
FILESYSTEM_REQUIRE_AUTH=true
FILESYSTEM_AUTH_TOKEN=<generated-jwt-secret>
```

**Success Criteria:**
- Web app can call agent from fine-tune-labs.ai
- Blocks requests from unauthorized domains
- Optional: User approves sensitive operations
- No CSRF vulnerabilities

---

### **Phase 6: Testing & Documentation**
**Goal:** Comprehensive testing and user documentation

**Test Files to Create:**
1. `lib/tools/filesystem/__tests__/remoteAdapter.test.ts`
2. `lib/training/__tests__/filesystem_api.test.py`
3. `e2e-tests/agent-connection.spec.ts`

**Documentation Files to Create:**
1. `docs/WEB_APP_ARCHITECTURE.md` - System architecture
2. `docs/LOCAL_AGENT_SETUP.md` - Agent installation guide
3. `docs/FILESYSTEM_API.md` - API reference
4. `docs/TROUBLESHOOTING.md` - Common issues

**Implementation Steps:**
1. ✅ Unit tests for remote adapter
2. ✅ Integration tests for agent API
3. ✅ E2E tests for full workflow
4. ✅ Write user documentation
5. ✅ Write developer documentation
6. ✅ Performance testing

**Success Criteria:**
- 90%+ code coverage
- All tests pass
- Documentation is clear and complete
- Performance: <100ms API response time

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| **CORS issues in production** | High | Thorough testing with production domains |
| **Path traversal attacks** | Critical | Multi-layer path validation |
| **Agent not running** | High | Clear UI feedback + installation guide |
| **Firewall blocking localhost** | Medium | Installer configures firewall exceptions |
| **Large model file downloads** | Medium | Streaming + progress indicators |
| **Cross-platform compatibility** | Medium | Test on Linux, Mac, Windows |

---

## Rollout Strategy

### Stage 1: Internal Testing (Week 1)
- ✅ Phase 1 & 2 complete
- ✅ Test with local development setup
- ✅ Verify no breaking changes

### Stage 2: Beta Users (Week 2-3)
- ✅ Phase 3 & 4 complete
- ✅ Select 10 beta users
- ✅ Provide installer script
- ✅ Collect feedback

### Stage 3: Public Release (Week 4)
- ✅ Phase 5 & 6 complete
- ✅ All tests passing
- ✅ Documentation complete
- ✅ Security audit passed

---

## Dependencies

**Python Libraries (add to requirements.txt):**
```txt
fastapi>=0.104.0
python-multipart>=0.0.6
aiofiles>=23.0.0
pyjwt>=2.8.0  # Optional for auth
```

**Node.js Packages (add to package.json):**
```json
{
  "dependencies": {
    "cross-fetch": "^4.0.0"
  }
}
```

---

## Success Metrics

**Technical:**
- ✅ 100% backward compatibility (local mode still works)
- ✅ API response time <100ms for file list
- ✅ API response time <500ms for file read (small files)
- ✅ Zero path traversal vulnerabilities
- ✅ 90%+ test coverage

**User Experience:**
- ✅ Agent detection in <2 seconds
- ✅ Clear error messages when agent offline
- ✅ One-click installer works on all platforms
- ✅ 95%+ of beta users successfully install agent

---

## Next Steps

1. **Review this plan** - Get approval before implementation
2. **Start Phase 1** - Add filesystem API to training_server.py
3. **Test incrementally** - Verify each phase before moving to next
4. **Update progress log** - Document all changes

---

## Notes

- All changes maintain backward compatibility
- Filesystem tool can run in local mode indefinitely
- Remote mode is opt-in via environment variable
- No changes to existing filesystem operations
- Security is top priority
