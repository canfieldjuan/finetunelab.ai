# Phased Implementation Plan: Docker vLLM Deployment Fix

**Session Date:** November 2, 2025  
**Feature:** Automatic Docker container restart for fine-tuned model deployment  
**Status:** ⚠️ GAPS IDENTIFIED - Awaiting Approval

---

## 🎯 Executive Summary

### Current State

- ✅ Re-deployment works (existing server → new model)
- ❌ First deployment BROKEN (no Docker container started)
- ⚠️ Missing error handling and validation

### Target State

- ✅ First deployment starts Docker automatically
- ✅ Re-deployment restarts Docker with new model
- ✅ Comprehensive error handling and rollback
- ✅ Path validation and Docker availability checks
- ✅ Configurable via environment variables

### Affected Files

1. `lib/services/inference-server-manager.ts` - Core logic (8 functions to modify)
2. `app/api/training/deploy/route.ts` - Deployment API (no changes needed)
3. `app/api/servers/start/route.ts` - Server restart API (no changes needed)
4. `.env` - New configuration variables (3 additions)

### Breaking Changes

**NONE** - All changes are additive and backward compatible.

---

## 📋 Implementation Phases

### **PHASE 1: Critical Fixes** 🔴 P0

**Goal:** Fix broken first-time deployment flow  
**Impact:** Enables basic functionality  
**Estimated Time:** 2-3 hours  
**Risk:** Low (isolated to new code paths)

#### Tasks

1. **Add Docker availability check** (NEW function)
   - File: `inference-server-manager.ts`
   - Function: `private async isDockerRunning(): Promise<boolean>`
   - Location: After line 1030 (after Docker helpers)
   - Logic: Execute `docker info` and check for success
   - Error handling: Return false on failure, don't throw

2. **Add filesystem path validation** (NEW function)
   - File: `inference-server-manager.ts`
   - Function: `private async validateModelPath(path: string): Promise<void>`
   - Location: After `isDockerRunning()`
   - Logic: Check if path exists using `fs.existsSync()`
   - Error handling: Throw descriptive error if not found

3. **Fix first-time deployment in registerExternalVLLM()**
   - File: `inference-server-manager.ts`
   - Location: Lines 638-652 (after database insert, before return)
   - Change: Add Docker container startup logic for local paths
   - Logic:

     ```typescript
     // After successful DB insert (line 638)
     console.log('[InferenceServerManager] External vLLM registered with ID:', serverId);
     
     // NEW CODE START
     // For local checkpoints, start Docker container
     const isLocalPath = /^[a-zA-Z]:[\\\/]/.test(config.modelPath);
     if (isLocalPath) {
       const containerName = process.env.VLLM_DOCKER_CONTAINER_NAME || 'vllm-server';
       
       try {
         // Check Docker is running
         const dockerRunning = await this.isDockerRunning();
         if (!dockerRunning) {
           throw new Error('Docker Desktop is not running. Please start Docker and try again.');
         }
         
         // Validate model path exists
         await this.validateModelPath(config.modelPath);
         
         // Stop existing container if any
         const exists = await this.dockerContainerExists(containerName);
         if (exists) {
           console.log('[InferenceServerManager] Stopping existing container...');
           await this.stopDockerContainer(containerName);
         }
         
         // Start new container
         console.log('[InferenceServerManager] Starting Docker container for first deployment...');
         await this.startVLLMDockerContainer(
           containerName,
           config.modelPath,
           config.modelName,
           port,
           config
         );
         
         // Wait for health
         await this.waitForDockerHealthy(containerName, baseUrl);
         
         console.log('[InferenceServerManager] Docker container is ready!');
       } catch (error) {
         // Rollback: Mark server as error state
         await supabaseClient
           .from('local_inference_servers')
           .update({ 
             status: 'error',
             error_message: error instanceof Error ? error.message : 'Unknown error'
           })
           .eq('id', serverId);
         
         throw error; // Re-throw to fail deployment
       }
     }
     // NEW CODE END
     
     return {
       serverId,
       baseUrl,
       port,
       status: 'running',
     };
     ```

4. **Update re-deployment path with validation**
   - File: `inference-server-manager.ts`
   - Location: Lines 528-567 (local path handling in existing server flow)
   - Change: Add Docker and path validation before restart
   - Logic: Insert checks before `dockerContainerExists()` call

#### Verification Tests

- [ ] Test 1: Deploy local checkpoint (first time) → Container starts
- [ ] Test 2: Deploy again (different checkpoint) → Container restarts
- [ ] Test 3: Docker not running → Clear error message
- [ ] Test 4: Invalid model path → Clear error message
- [ ] Test 5: Database rollback on failure → Status = 'error'

#### Files Modified

- `lib/services/inference-server-manager.ts` (3 new functions, 2 modified sections)

---

### **PHASE 2: Enhanced Error Handling** 🟡 P1

**Goal:** Robust error recovery and cleanup  
**Impact:** Production-ready reliability  
**Estimated Time:** 2 hours  
**Risk:** Medium (modifies error paths)

#### Tasks

1. **Improve Windows path detection**
   - File: `inference-server-manager.ts`
   - Locations: Lines 525, 641 (both `isLocalPath` checks)
   - Current: `config.modelPath.includes('C:\\') || config.modelPath.includes('c:\\')`
   - New: `/^[a-zA-Z]:[\\\/]/.test(config.modelPath) || config.modelPath.startsWith('\\\\')`
   - Handles: All drive letters (D:, E:, etc.) and UNC paths (\\server\share)

2. **Add orphaned container cleanup**
   - File: `inference-server-manager.ts`
   - Location: In `waitForDockerHealthy()` function (lines 1027-1074)
   - Change: Wrap health check in try/catch, cleanup on timeout
   - Logic:

     ```typescript
     try {
       await this.waitForDockerHealthy(containerName, baseUrl);
     } catch (error) {
       // Health check failed - cleanup orphaned container
       console.error('[InferenceServerManager] Health check failed, cleaning up container');
       try {
         await this.stopDockerContainer(containerName);
       } catch (cleanupError) {
         console.error('[InferenceServerManager] Failed to cleanup container:', cleanupError);
       }
       throw error; // Re-throw original error
     }
     ```

3. **Add database rollback to re-deployment path**
   - File: `inference-server-manager.ts`
   - Location: Lines 568-575 (error catch in re-deployment)
   - Current: Throws error
   - New: Rollback database update before throwing
   - Logic:

     ```typescript
     } catch (error) {
       console.error('[InferenceServerManager] Failed to restart Docker container:', error);
       
       // Rollback database - restore old model info
       await supabaseClient
         .from('local_inference_servers')
         .update({
           status: 'error',
           error_message: `Failed to load new model: ${error instanceof Error ? error.message : 'Unknown error'}`
         })
         .eq('id', existing.id);
       
       throw new Error(`Docker restart failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
     }
     ```

4. **Add port conflict detection**
   - File: `inference-server-manager.ts`
   - Function: NEW `private async isPortAvailable(port: number): Promise<boolean>`
   - Location: After `validateModelPath()`
   - Uses: Node.js `net` module to check port availability
   - Called: Before `startVLLMDockerContainer()` in both paths

#### Verification Tests

- [ ] Test 1: Deploy to D:\ drive → Works correctly
- [ ] Test 2: Health check timeout → Container cleaned up
- [ ] Test 3: Re-deployment fails → Database shows old model + error
- [ ] Test 4: Port in use by another process → Clear error

#### Files Modified

- `lib/services/inference-server-manager.ts` (1 new function, 3 modified error handlers)

---

### **PHASE 3: Configuration & Flexibility** 🟢 P2

**Goal:** Make system configurable via environment variables  
**Impact:** Easier maintenance and customization  
**Estimated Time:** 1 hour  
**Risk:** Low (optional configuration)

#### Tasks

1. **Add environment variables**
   - File: `.env`
   - New variables:

     ```bash
     # vLLM Docker Configuration
     VLLM_DOCKER_CONTAINER_NAME=vllm-server
     VLLM_DOCKER_IMAGE=vllm/vllm-openai:v0.6.3.post1
     VLLM_HEALTH_CHECK_TIMEOUT_MS=120000
     ```

2. **Update Docker helper to use env vars**
   - File: `inference-server-manager.ts`
   - Function: `startVLLMDockerContainer()`
   - Line 993: Replace hardcoded `'vllm/vllm-openai:v0.6.3.post1'`
   - With: `process.env.VLLM_DOCKER_IMAGE || 'vllm/vllm-openai:v0.6.3.post1'`

3. **Update container name references**
   - File: `inference-server-manager.ts`
   - Locations: Lines 529, 641 (both places using `'vllm-server'`)
   - Replace with: `process.env.VLLM_DOCKER_CONTAINER_NAME || 'vllm-server'`

4. **Update health check timeout**
   - File: `inference-server-manager.ts`
   - Function: `waitForDockerHealthy()` default parameter
   - Line 1029: `maxWaitMs: number = 120000`
   - With: `maxWaitMs: number = parseInt(process.env.VLLM_HEALTH_CHECK_TIMEOUT_MS || '120000')`

#### Verification Tests

- [ ] Test 1: Custom container name in .env → Used correctly
- [ ] Test 2: Custom Docker image → Container starts with new image
- [ ] Test 3: Custom timeout → Health check respects new value
- [ ] Test 4: Missing env vars → Falls back to defaults

#### Files Modified

- `.env` (3 new variables)
- `lib/services/inference-server-manager.ts` (4 hardcoded values → env vars)

---

### **PHASE 4: Enhanced Logging & Monitoring** 🟢 P3

**Goal:** Better debugging and observability  
**Impact:** Easier troubleshooting  
**Estimated Time:** 1 hour  
**Risk:** Low (logging only)

#### Tasks

1. **Add structured logging to Docker operations**
   - File: `inference-server-manager.ts`
   - All Docker helper functions
   - Add: Timestamp, user ID, model path to all logs
   - Format: `[YYYY-MM-DD HH:mm:ss] [UserID: xxx] [ModelPath: yyy] Message`

2. **Add deployment telemetry**
   - File: `inference-server-manager.ts`
   - Track: Deployment success/failure rates
   - Track: Average container startup time
   - Track: Common error types
   - Store in: Console logs (future: database metrics table)

3. **Add Docker command output logging**
   - File: `inference-server-manager.ts`
   - All `execSync()` calls
   - Capture: stdout and stderr
   - Log: On error for debugging

#### Verification Tests

- [ ] Test 1: All logs include timestamps
- [ ] Test 2: User ID appears in logs
- [ ] Test 3: Docker errors show full output
- [ ] Test 4: Performance metrics logged

#### Files Modified

- `lib/services/inference-server-manager.ts` (logging enhancements)

---

## 🔄 Implementation Order

### Day 1: Critical Fixes

1. **Morning** (2 hours)
   - Implement Phase 1, Tasks 1-2 (Docker check, path validation)
   - Write unit tests for new functions
   - Verify functions work independently

2. **Afternoon** (2 hours)
   - Implement Phase 1, Task 3 (first-time deployment fix)
   - Test first deployment flow end-to-end
   - Verify database rollback on failure

3. **Evening** (1 hour)
   - Implement Phase 1, Task 4 (re-deployment validation)
   - Run all Phase 1 verification tests
   - Document any issues found

### Day 2: Error Handling & Configuration

1. **Morning** (2 hours)
   - Implement Phase 2, Tasks 1-3 (path detection, cleanup, rollback)
   - Test error scenarios
   - Verify cleanup happens on failure

2. **Afternoon** (1 hour)
   - Implement Phase 2, Task 4 (port conflict detection)
   - Run all Phase 2 verification tests

3. **Evening** (1 hour)
   - Implement Phase 3 (configuration via .env)
   - Test with custom values
   - Document configuration options

### Day 3: Polish & Documentation

1. **Morning** (1 hour)
   - Implement Phase 4 (enhanced logging)
   - Test logging output

2. **Afternoon** (2 hours)
   - End-to-end testing of all scenarios
   - Performance testing (container startup times)
   - Load testing (multiple deployments)

3. **Evening** (1 hour)
   - Update documentation
   - Create deployment guide
   - Write troubleshooting guide

---

## 📊 Risk Assessment

### High Risk Areas

**NONE** - All changes are in new code paths or additive

### Medium Risk Areas

1. **First-time deployment flow** (Phase 1, Task 3)
   - Risk: Could break if database insert fails after Docker starts
   - Mitigation: Rollback mechanism + comprehensive testing
   - Likelihood: Low
   - Impact: Medium (deployment fails, but can retry)

2. **Error rollback logic** (Phase 2, Task 3)
   - Risk: Could leave database in inconsistent state
   - Mitigation: Use transactions where possible
   - Likelihood: Low
   - Impact: Medium (manual cleanup needed)

### Low Risk Areas

1. Path validation (Phase 1, Task 2) - Pure validation, no side effects
2. Docker availability check (Phase 1, Task 1) - Read-only check
3. Configuration via env vars (Phase 3) - Optional with fallbacks
4. Enhanced logging (Phase 4) - Logging only, no logic changes

---

## 🧪 Testing Strategy

### Unit Tests

- [ ] `isDockerRunning()` - Returns true/false correctly
- [ ] `validateModelPath()` - Throws on invalid path
- [ ] `isPortAvailable()` - Detects port conflicts
- [ ] Windows path regex - Matches all drive letters and UNC paths

### Integration Tests

- [ ] First deployment with local checkpoint
- [ ] Re-deployment with different checkpoint
- [ ] Deployment with HuggingFace model (backward compat)
- [ ] Error scenarios (Docker not running, invalid path, port conflict)
- [ ] Database rollback on failure

### End-to-End Tests

- [ ] Deploy via UI → Container starts → Model loads → Chat works
- [ ] Deploy twice → Old container stopped → New container started
- [ ] Deploy with Docker stopped → Clear error in UI
- [ ] Deploy invalid path → Clear error in UI

### Performance Tests

- [ ] Container startup time < 30 seconds
- [ ] Health check completes < 2 minutes
- [ ] Multiple deployments don't leak containers

---

## 📝 Rollback Plan

### If Critical Issues Found

1. **Immediate Rollback**
   - Revert `inference-server-manager.ts` to previous version
   - Keep database migration (safe, backward compatible)
   - Document issue in GitHub issue

2. **Partial Rollback**
   - Keep Phase 1 fixes if working
   - Disable Phase 2/3/4 if problematic
   - Use feature flag to control new flow

3. **Emergency Fallback**
   - User can manually start Docker container
   - System detects running container and uses it
   - No code changes needed (existing behavior)

---

## 📚 Documentation Updates Needed

### User Documentation

1. **Deployment Guide** (NEW)
   - How to deploy fine-tuned models
   - Prerequisites (Docker Desktop running)
   - Troubleshooting common errors

2. **Configuration Reference** (UPDATE)
   - New environment variables
   - Default values
   - When to customize

### Developer Documentation

1. **Architecture Docs** (UPDATE)
   - Docker integration flow
   - Error handling strategy
   - Database rollback mechanism

2. **API Docs** (UPDATE)
   - New error codes
   - New response messages
   - Deployment status meanings

---

## ✅ Success Criteria

### Must Have (Phase 1)

- [x] First deployment starts Docker container automatically
- [ ] Re-deployment restarts container with new model
- [ ] Clear error messages for common failures
- [ ] Database rollback on deployment failure

### Should Have (Phase 2)

- [ ] All Windows path formats supported
- [ ] Orphaned containers cleaned up automatically
- [ ] Port conflicts detected before deployment
- [ ] Comprehensive error recovery

### Nice to Have (Phase 3-4)

- [ ] Configurable via environment variables
- [ ] Enhanced logging for debugging
- [ ] Performance metrics tracked

---

## 🎯 Next Steps (Awaiting Approval)

1. **Review this plan** - Confirm phases and approach
2. **Approve Phase 1** - Begin critical fixes
3. **Set timeline** - Decide on implementation schedule
4. **Assign testing** - Who will verify each phase

**Once approved, implementation begins with Phase 1, Task 1.**
