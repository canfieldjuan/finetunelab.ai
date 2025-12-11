# Hardcoded Values Audit - COMPREHENSIVE SCAN

**Date**: Current (Extended Analysis)  
**Purpose**: Identify ALL hardcoded values including URLs, API keys, connection strings, timeouts  
**Scope**: Full TypeScript/JavaScript codebase  
**Total Findings**: 100+ instances across 3 major categories

---

## Executive Summary

**CRITICAL FINDING**: 40+ hardcoded `http://localhost:8000` URLs in DAG example files **WITHOUT** environment variable fallbacks. This prevents production deployment and port customization.

### Findings by Category

1. **URLs & Endpoints** (High Priority) - 80+ instances
   - 🔴 40 without env fallbacks (DAG examples)
   - ✅ 40 with proper env fallbacks
2. **API Keys** (Low Priority) - 25 instances (all safe placeholders)
3. **Connection Strings** (Low Priority) - 1 instance (tutorial example)
4. **Timeouts** (Info Only) - 25+ instances (reasonable defaults)

### Original Summary

Previous audit identified **25+ hardcoded configuration values** for deployment flexibility, performance tuning, and operational maintenance. This extended scan found **4x more issues** requiring immediate attention.

---

## CATEGORY 1: URLs & Endpoints (HIGH PRIORITY)

### 🔴 CRITICAL - DAG Example Files (No Environment Fallbacks)

#### File: `lib/training/dag-conditional-examples.ts`

**Issue**: 25+ hardcoded `'http://localhost:8000'` without env variable fallbacks  
**Lines**: 37, 48, 58, 112, 123, 134, 158, 188, 245, 256, 267, 278, 289, 300, 323, 380, 390, 400, 468, 478, 488, 498, 509

**Current Pattern** (BROKEN):

```typescript
apiEndpoint: 'http://localhost:8000',  // ❌ No fallback
```

**Impact**:

- ❌ Cannot deploy to remote training servers
- ❌ Cannot customize ports for local development
- ❌ Breaks in containerized environments
- ❌ Impossible to run multiple instances

---

#### File: `lib/training/dag-examples.ts`

**Issue**: 15+ hardcoded `'http://localhost:8000'`  
**Lines**: 38, 54, 103, 119, 134, 149, 163

**Current Pattern** (BROKEN):

```typescript
apiEndpoint: 'http://localhost:8000',  // ❌ No fallback
```

---

### 🟡 MEDIUM - Partial Hardcoding

#### File: `lib/services/inference-server-manager.ts`

**Line 433**: Hardcoded Ollama URL without env fallback

```typescript
const baseUrl = 'http://localhost:11434';  // ❌ No fallback
```

**Lines 443, 467**: Hardcoded port numbers

```typescript
port: 11434, // Ollama default port
```

**Note**: Line 301 in same file DOES have proper fallback ✅

---

#### File: `test_config_builder.js`

**Line 43**: Test file with hardcoded URL

```typescript
base_url: 'http://localhost:8000'  // ⚠️ Test file
```

---

### ✅ GOOD EXAMPLES - Proper Environment Variable Fallbacks

#### File: `lib/training/job-handlers.ts`

```typescript
// Line 398 ✅
base_url: process.env.LOCAL_TRAINING_SERVER_URL || 'http://localhost:8000',

// Line 734 ✅
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
```

#### File: `lib/training/notification-service.ts`

```typescript
// Line 212 ✅
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
```

#### File: `components/training/LocalPackageDownloader.tsx`

```typescript
// Line 224 ✅
const trainingServerUrl = process.env.NEXT_PUBLIC_TRAINING_SERVER_URL || 'http://localhost:8000';
```

#### File: `lib/services/inference-server-manager.ts`

```typescript
// Line 301 ✅
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
```

---

### 🔵 INFO - Third-Party Code (llama.cpp)

**Path**: `lib/training/llama.cpp/tools/server/**`

- `public_simplechat/simplechat.js:725` - `http://127.0.0.1:8080`
- `webui/vite.config.ts:134-136` - `http://localhost:8080`
- `bench/script.js:8` - Has env var fallback ✅

**Status**: Upstream third-party code, may need local patch.

---

## CATEGORY 2: API Keys & Secrets (LOW PRIORITY - ALL SAFE)

### File: `lib/models/model-templates.ts`

**25 instances** of `placeholder_api_key` (lines 29-422)

**All are UI placeholders** (NOT real keys):

```typescript
placeholder_api_key: 'sk-proj-...',        // OpenAI UI placeholder
placeholder_api_key: 'sk-ant-...',         // Anthropic UI placeholder
placeholder_api_key: 'hf_...',             // HuggingFace UI placeholder
placeholder_api_key: 'No API key required' // Ollama UI text
```

✅ **Status**: Safe - These are form field placeholder text for user guidance.

### Documentation Comments (Safe)

- `app/api/training/deploy/runpod/route.ts:78` - Comment showing example ✅
- `public/feedback-widget.js:10` - Integration documentation ✅

---

## CATEGORY 3: Connection Strings (LOW PRIORITY)

#### File: `lib/training/llama.cpp/tools/server/webui/src/stories/fixtures/ai-tutorial.ts`

**Line 141**: Tutorial example with generic credentials

```typescript
DATABASE_URL="postgresql://user:password@localhost:5432/chat"
```

✅ **Status**: Tutorial/fixture code with generic credentials. **Low risk**.

---

## Category 1: Service URLs and Ports

### **CRITICAL: Training Server URL**

**Location**: `components/LocalPackageDownloader.tsx:224`  

```typescript
const response = await fetch("http://localhost:8000/api/training/execute", {
```

**Issue**: Hardcoded localhost URL prevents deployment flexibility  
**Recommendation**: Add `TRAINING_SERVER_URL` to `.env.local`  
**Priority**: HIGH - Required for production deployment  
**Impact**: Cannot deploy training server to different host/port

---

### Already Configurable URLs ✅

These service URLs are already environment-configurable:

- `OLLAMA_BASE_URL` - Ollama service endpoint
- `GRAPHITI_API_URL` - Graphiti knowledge graph service
- `VLLM_EXTERNAL_URL` - vLLM inference server
- `NEXT_PUBLIC_APP_URL` - Next.js application URL
- `GRAPHITI_TIMEOUT` - Graphiti client timeout (`graphiti/client.ts:72`)
- `VLLM_HEALTH_CHECK_TIMEOUT_MS` - vLLM health check timeout (already in `.env.local`)

---

## Category 2: Polling Intervals

### **Job Queue Polling**

**Location**: `lib/job-handlers.ts:30`  

```typescript
maxAttempts = 360,
pollInterval = 5000
```

**Issue**: Fixed 5-second polling interval and 360-attempt limit  
**Calculation**: 360 attempts × 5s = 1800s (30 minutes)  
**Recommendation**: Add to `.env.local`:

```env
JOB_MAX_ATTEMPTS=360
JOB_POLL_INTERVAL_MS=5000
```

**Priority**: MEDIUM - Useful for operational tuning  
**Impact**: Cannot adjust job timeout behavior without code changes

---

### **Approval Handler Polling**

**Location**: `lib/approval-handler.ts:26`  

```typescript
pollInterval = 5000
```

**Issue**: Hardcoded 5-second polling  
**Recommendation**: `APPROVAL_POLL_INTERVAL_MS=5000`  
**Priority**: MEDIUM  
**Impact**: Cannot optimize approval workflow polling

---

### **Distributed Orchestrator Polling**

**Location**: `lib/distributed-orchestrator.ts:281`  

```typescript
pollIntervalMs = 1000
```

**Issue**: Hardcoded 1-second polling for distributed operations  
**Recommendation**: `DISTRIBUTED_ORCHESTRATOR_POLL_INTERVAL_MS=1000`  
**Priority**: MEDIUM  
**Impact**: Cannot tune distributed job coordination

---

### **Runtime Parameter Update Callback (NEW FEATURE)**

**Locations**:

- `lib/training/standalone_trainer.py:673` (SFT)
- `lib/training/standalone_trainer.py:736` (DPO)
- `lib/training/standalone_trainer.py:757` (RLHF)
- `lib/training/standalone_trainer.py:778` (ORPO)

```python
callback=RuntimeParameterUpdateCallback(
    check_interval=10,
    # ...
)
```

**Issue**: Hardcoded 10-step check interval across all training methods  
**Recommendation**: Add to `.env.local`:

```env
PARAM_UPDATE_CHECK_INTERVAL=10
```

**Priority**: MEDIUM - Just implemented, but worth making configurable  
**Impact**: Cannot adjust polling frequency without modifying 4 code locations

---

## Category 3: Timeout Values

### **Already Configurable** ✅

**Location**: `lib/training/standalone_trainer.py:69`  

```python
HTTP_REQUEST_TIMEOUT = int(os.getenv("HTTP_REQUEST_TIMEOUT", "10"))
```

**Status**: ✅ ALREADY CONFIGURABLE  
**Good Practice**: This is an example of proper environment variable usage

---

### **Training Server Timeouts**

**Location**: `lib/training/training_server.py`  
Multiple hardcoded timeouts found:

- 60 seconds
- 30 seconds  
- 10 seconds
- 5 seconds

**Issue**: Various timeout values hardcoded throughout training server  
**Recommendation**: Create configurable timeout hierarchy:

```env
TRAINING_SERVER_DEFAULT_TIMEOUT=60
TRAINING_SERVER_REQUEST_TIMEOUT=30
TRAINING_SERVER_HEALTH_CHECK_TIMEOUT=10
TRAINING_SERVER_STARTUP_TIMEOUT=5
```

**Priority**: MEDIUM  
**Impact**: Cannot tune training server timeout behavior

---

### **Approval Manager Timeouts**

**Location**: `lib/approval-manager.ts:50,53`  

```typescript
timeoutCheckInterval = 60000,
defaultTimeoutMs = 3600000
```

**Issue**: Hardcoded 60-second check interval and 1-hour default timeout  
**Calculation**: 60000ms = 1 minute, 3600000ms = 60 minutes  
**Recommendation**:

```env
APPROVAL_CHECK_INTERVAL_MS=60000
APPROVAL_DEFAULT_TIMEOUT_MS=3600000
```

**Priority**: MEDIUM  
**Impact**: Cannot adjust approval timeout behavior

---

## Category 4: Rate Limits

### **Already Configurable** ✅

**Location**: `.env.local:54,63`  

```env
SEARCH_RATE_LIMIT=1200
```

**Status**: ✅ ALREADY CONFIGURABLE  
**Good Practice**: Rate limiting is properly externalized

---

## Recommendations by Priority

### **HIGH Priority (Production Blockers)**

1. **Training Server URL**
   - Variable: `TRAINING_SERVER_URL`
   - Default: `http://localhost:8000`
   - Location: `components/LocalPackageDownloader.tsx`
   - Reason: Required for non-localhost deployments

### **MEDIUM Priority (Operational Flexibility)**

2. **Job Queue Configuration**
   - Variables: `JOB_MAX_ATTEMPTS`, `JOB_POLL_INTERVAL_MS`
   - Locations: `lib/job-handlers.ts`
   - Reason: Tuning job timeout behavior

3. **Approval System Configuration**
   - Variables: `APPROVAL_POLL_INTERVAL_MS`, `APPROVAL_CHECK_INTERVAL_MS`, `APPROVAL_DEFAULT_TIMEOUT_MS`
   - Locations: `lib/approval-handler.ts`, `lib/approval-manager.ts`
   - Reason: Optimizing approval workflow

4. **Distributed Orchestration**
   - Variable: `DISTRIBUTED_ORCHESTRATOR_POLL_INTERVAL_MS`
   - Location: `lib/distributed-orchestrator.ts`
   - Reason: Tuning distributed job coordination

5. **Runtime Parameter Updates**
   - Variable: `PARAM_UPDATE_CHECK_INTERVAL`
   - Locations: `lib/training/standalone_trainer.py` (4 occurrences)
   - Reason: Fine-tuning parameter update frequency

6. **Training Server Timeouts**
   - Variables: Multiple timeout values
   - Location: `lib/training/training_server.py`
   - Reason: Operational timeout management

### **LOW Priority (Nice to Have)**

7. **Python Virtual Environment Paths**
   - Currently using relative paths
   - Could externalize for custom deployment structures

---

## Implementation Approach

### Phase 1: Critical Path (Training Server URL)

**Goal**: Enable non-localhost deployments

**Steps**:

1. Add `TRAINING_SERVER_URL=http://localhost:8000` to `.env.local`
2. Update `components/LocalPackageDownloader.tsx` to read from env:

   ```typescript
   const trainingServerUrl = process.env.NEXT_PUBLIC_TRAINING_SERVER_URL || 'http://localhost:8000';
   const response = await fetch(`${trainingServerUrl}/api/training/execute`, {
   ```

3. Test with local and remote training servers
4. Update deployment documentation

**Estimated Effort**: 30 minutes  
**Breaking Changes**: None (backward compatible with default)

---

### Phase 2: Polling Intervals and Timeouts

**Goal**: Make operational parameters tunable

**Steps**:

1. Add all recommended variables to `.env.local` with current values as defaults
2. Update each file to read from environment:
   - `lib/job-handlers.ts`
   - `lib/approval-handler.ts`
   - `lib/approval-manager.ts`
   - `lib/distributed-orchestrator.ts`
   - `lib/training/standalone_trainer.py`
   - `lib/training/training_server.py`
3. Add validation for numeric values
4. Update documentation with tuning guidelines

**Estimated Effort**: 2-3 hours  
**Breaking Changes**: None (all have defaults)

---

### Phase 3: Training Server Timeout Hierarchy

**Goal**: Comprehensive timeout management

**Steps**:

1. Design timeout hierarchy based on operation types
2. Add environment variables with sensible defaults
3. Update `training_server.py` to use centralized timeout logic
4. Add timeout monitoring and logging
5. Document timeout tuning best practices

**Estimated Effort**: 1-2 hours  
**Breaking Changes**: None (backward compatible)

---

## Environment Variable Naming Conventions

Following these conventions for consistency:

- **Service URLs**: `<SERVICE>_<PURPOSE>_URL` (e.g., `TRAINING_SERVER_URL`)
- **Timeouts**: `<COMPONENT>_<PURPOSE>_TIMEOUT` or `<COMPONENT>_<PURPOSE>_TIMEOUT_MS`
- **Intervals**: `<COMPONENT>_<PURPOSE>_INTERVAL_MS`
- **Limits**: `<COMPONENT>_<PURPOSE>_LIMIT` or `<COMPONENT>_MAX_<METRIC>`

---

## Testing Strategy

### Unit Tests

- Verify environment variable reading logic
- Test default value fallbacks
- Validate numeric value parsing

### Integration Tests

- Test with various timeout/interval configurations
- Verify polling behavior under different settings
- Test training server URL resolution

### Deployment Tests

- Verify production configuration loading
- Test with non-localhost URLs
- Validate timeout behavior in production environment

---

## Documentation Requirements

### Developer Documentation

- List all new environment variables
- Explain purpose and impact of each variable
- Provide recommended ranges for tuning

### Operations Documentation

- Timeout tuning guidelines
- Polling interval optimization strategies
- Troubleshooting guide for configuration issues

### Deployment Documentation

- Update `.env.local.example` with all new variables
- Add Docker/Kubernetes configuration examples
- Document multi-environment setup (dev/staging/prod)

---

## Excluded from This Audit

The following were found but intentionally excluded:

1. **Python Virtual Environment Packages** - Dependency configurations (not runtime config)
2. **Test Files** - Test-specific hardcoded values (acceptable)
3. **Third-party Libraries** - Vendor code (e.g., TensorBoard, uvicorn, setuptools)
4. **JSON Schema Definitions** - Data validation structures (not runtime config)

---

## Next Steps

1. **User Review**: Review this audit and prioritize recommendations
2. **Implementation Plan**: Create tickets for each phase
3. **Test Environment**: Set up testing environment for configuration changes
4. **Rollout**: Implement changes in phases with thorough testing
5. **Documentation**: Update all documentation with new environment variables

---

## Conclusion

This audit identified **25+ configuration opportunities** across the codebase. The most critical finding is the hardcoded training server URL, which prevents production deployment flexibility. Other findings focus on operational tuning and maintenance efficiency.

**Recommended Action**: Start with Phase 1 (Training Server URL) as a quick win, then proceed with Phase 2 (polling/timeouts) based on operational needs.

---

## 🚀 COMPREHENSIVE SOLUTION PLAN

### OPTION A: Centralized Constants File (RECOMMENDED)

**Why this approach?**

- ✅ Single source of truth
- ✅ TypeScript autocomplete & type safety
- ✅ Easy to maintain and update
- ✅ Prevents duplication
- ✅ Consistent across entire codebase

#### Step 1: Create Constants File

**File**: `lib/config/endpoints.ts`

```typescript
/**
 * Centralized endpoint configuration with environment variable fallbacks
 * All URLs can be customized via .env files
 */

export const ENDPOINTS = {
  // Training Server
  TRAINING_SERVER: process.env.LOCAL_TRAINING_SERVER_URL || 'http://localhost:8000',
  
  // Next.js Application
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  
  // Inference Servers
  OLLAMA: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  VLLM: process.env.VLLM_EXTERNAL_URL || 'http://localhost:8001',
  
  // APIs
  VALIDATION_API: process.env.VALIDATION_API_URL || 'http://localhost:8001',
  GOVERNANCE_API: process.env.GOVERNANCE_API_URL || 'http://localhost:9000',
  GRAPHITI_API: process.env.GRAPHITI_API_URL || 'http://localhost:8002',
} as const;

export const PORTS = {
  TRAINING_SERVER: 8000,
  APP: 3000,
  OLLAMA: 11434,
  VLLM: 8001,
  VALIDATION_API: 8001,
  GOVERNANCE_API: 9000,
  GRAPHITI_API: 8002,
} as const;

// Type exports for autocomplete
export type Endpoint = typeof ENDPOINTS[keyof typeof ENDPOINTS];
export type Port = typeof PORTS[keyof typeof PORTS];
```

---

#### Step 2: Update DAG Conditional Examples

**File**: `lib/training/dag-conditional-examples.ts`

**Before** (Line 37, 48, 58, etc.):

```typescript
apiEndpoint: 'http://localhost:8000',
```

**After**:

```typescript
import { ENDPOINTS } from '@/lib/config/endpoints';

// ... then update all 25 instances:
apiEndpoint: ENDPOINTS.TRAINING_SERVER,
```

**Automated Fix** (one command):

```bash
# Find and replace all instances
sed -i "s|apiEndpoint: 'http://localhost:8000'|apiEndpoint: ENDPOINTS.TRAINING_SERVER|g" \
  lib/training/dag-conditional-examples.ts

# Add import at top of file (after existing imports)
sed -i "1a import { ENDPOINTS } from '@/lib/config/endpoints';" \
  lib/training/dag-conditional-examples.ts
```

---

#### Step 3: Update DAG Examples

**File**: `lib/training/dag-examples.ts`

Same pattern as conditional examples:

```bash
sed -i "s|apiEndpoint: 'http://localhost:8000'|apiEndpoint: ENDPOINTS.TRAINING_SERVER|g" \
  lib/training/dag-examples.ts

sed -i "1a import { ENDPOINTS } from '@/lib/config/endpoints';" \
  lib/training/dag-examples.ts
```

---

#### Step 4: Fix Inference Server Manager

**File**: `lib/services/inference-server-manager.ts`

**Line 433 - Before**:

```typescript
const baseUrl = 'http://localhost:11434';
```

**After**:

```typescript
import { ENDPOINTS, PORTS } from '@/lib/config/endpoints';

const baseUrl = ENDPOINTS.OLLAMA;
```

**Lines 443, 467 - Before**:

```typescript
port: 11434, // Ollama default port
```

**After**:

```typescript
port: PORTS.OLLAMA,
```

---

#### Step 5: Create/Update .env.example

**File**: `.env.example`

```bash
#═══════════════════════════════════════════════════════════
# Service Endpoints Configuration
#═══════════════════════════════════════════════════════════

# Training Server
# Used by: DAG examples, job handlers, package downloader
LOCAL_TRAINING_SERVER_URL=http://localhost:8000

# Next.js Application
# Used by: Notifications, job callbacks
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_TRAINING_SERVER_URL=http://localhost:8000

# Inference Servers
# Ollama - Local LLM inference
OLLAMA_BASE_URL=http://localhost:11434

# vLLM - High-performance inference server
VLLM_EXTERNAL_URL=http://localhost:8001

# APIs
# Validation API for distributed training
VALIDATION_API_URL=http://localhost:8001

# Governance API for policy checks
GOVERNANCE_API_URL=http://localhost:9000

# Graphiti Knowledge Graph API
GRAPHITI_API_URL=http://localhost:8002

#═══════════════════════════════════════════════════════════
# Production Deployment Examples
#═══════════════════════════════════════════════════════════

# Remote Training Server
# LOCAL_TRAINING_SERVER_URL=http://training-server.example.com:8000

# Containerized Setup
# OLLAMA_BASE_URL=http://ollama:11434
# TRAINING_SERVER_URL=http://training:8000

# Cloud Deployment
# NEXT_PUBLIC_APP_URL=https://finetune.example.com
# LOCAL_TRAINING_SERVER_URL=https://api.finetune.example.com
```

---

### Files Requiring Updates (Complete Checklist)

#### 🔴 Critical (Must Fix)

- [ ] Create `lib/config/endpoints.ts`
- [ ] Update `lib/training/dag-conditional-examples.ts` (25 instances)
- [ ] Update `lib/training/dag-examples.ts` (15 instances)
- [ ] Update `lib/services/inference-server-manager.ts` (line 433)

#### 🟡 Optional (Cleanup)

- [ ] Update `test_config_builder.js` (test file)
- [ ] Create `.env.example` with all variables
- [ ] Update README.md with deployment instructions

#### ✅ Already Correct (No Changes)

- `lib/training/job-handlers.ts` ✅
- `lib/training/notification-service.ts` ✅
- `components/training/LocalPackageDownloader.tsx` ✅
- `lib/services/inference-server-manager.ts` (line 301) ✅

---

### Testing Plan

#### Phase 1: Verify Constants Export

```bash
# Test TypeScript compilation
npm run build

# Expected: No errors, endpoints properly exported
```

#### Phase 2: Test with Default Values (Localhost)

```bash
# Run without .env file
npm run dev

# Verify:
# - Training server connects to localhost:8000
# - Ollama connects to localhost:11434
# - All DAG examples work correctly
```

#### Phase 3: Test with Custom Values

```bash
# Create .env.local
cat > .env.local << EOF
LOCAL_TRAINING_SERVER_URL=http://custom-host:9000
OLLAMA_BASE_URL=http://ollama-server:12345
EOF

# Run app
npm run dev

# Verify:
# - Training endpoints use custom-host:9000
# - Ollama uses ollama-server:12345
# - No hardcoded localhost connections
```

#### Phase 4: Test DAG Execution

```bash
# Run DAG examples from UI
# Verify:
# - All 40 DAG examples execute successfully
# - Correct endpoint URLs in logs
# - No 'localhost:8000' in production builds
```

---

### Implementation Timeline

| Phase | Task | Time | Priority |
|-------|------|------|----------|
| 1 | Create `endpoints.ts` | 15 min | 🔴 Critical |
| 2 | Update DAG conditional examples | 20 min | 🔴 Critical |
| 3 | Update DAG examples | 15 min | 🔴 Critical |
| 4 | Fix inference-server-manager | 10 min | 🟡 Medium |
| 5 | Create .env.example | 15 min | 🟡 Medium |
| 6 | TypeScript compilation test | 5 min | 🔴 Critical |
| 7 | Localhost testing | 15 min | 🔴 Critical |
| 8 | Custom env testing | 15 min | 🔴 Critical |
| 9 | DAG execution testing | 20 min | 🔴 Critical |
| 10 | Documentation updates | 15 min | 🟡 Medium |

**Total Estimated Time**: ~2.5 hours for complete implementation and testing

---

### Risk Mitigation

#### Risk 1: Breaking DAG Examples

**Mitigation**:

- Test each DAG example after changes
- Keep original files as `.backup` during migration
- Rollback plan: `git checkout lib/training/dag-*.ts`

#### Risk 2: Environment Variable Misconfiguration

**Mitigation**:

- Provide clear `.env.example`
- Add runtime validation (optional)
- Document all variables in README

#### Risk 3: TypeScript Import Errors

**Mitigation**:

- Use TypeScript path alias `@/lib/config/endpoints`
- Verify tsconfig.json has correct paths
- Test compilation before deployment

---

### Automated Fix Script (OPTIONAL)

**File**: `scripts/fix-hardcoded-endpoints.sh`

```bash
#!/bin/bash
set -e

echo "🔧 Fixing hardcoded endpoints in codebase..."

# Step 1: Create endpoints.ts (already covered above)

# Step 2: Fix dag-conditional-examples.ts
echo "📝 Updating dag-conditional-examples.ts..."
sed -i "s|apiEndpoint: 'http://localhost:8000'|apiEndpoint: ENDPOINTS.TRAINING_SERVER|g" \
  lib/training/dag-conditional-examples.ts

# Add import if not exists
if ! grep -q "import { ENDPOINTS }" lib/training/dag-conditional-examples.ts; then
  sed -i "1i import { ENDPOINTS } from '@/lib/config/endpoints';\n" \
    lib/training/dag-conditional-examples.ts
fi

# Step 3: Fix dag-examples.ts
echo "📝 Updating dag-examples.ts..."
sed -i "s|apiEndpoint: 'http://localhost:8000'|apiEndpoint: ENDPOINTS.TRAINING_SERVER|g" \
  lib/training/dag-examples.ts

if ! grep -q "import { ENDPOINTS }" lib/training/dag-examples.ts; then
  sed -i "1i import { ENDPOINTS } from '@/lib/config/endpoints';\n" \
    lib/training/dag-examples.ts
fi

# Step 4: Fix inference-server-manager.ts (line 433)
echo "📝 Updating inference-server-manager.ts..."
sed -i "433s|const baseUrl = 'http://localhost:11434';|const baseUrl = ENDPOINTS.OLLAMA;|" \
  lib/services/inference-server-manager.ts

if ! grep -q "import { ENDPOINTS, PORTS }" lib/services/inference-server-manager.ts; then
  sed -i "1i import { ENDPOINTS, PORTS } from '@/lib/config/endpoints';\n" \
    lib/services/inference-server-manager.ts
fi

echo "✅ All hardcoded endpoints fixed!"
echo "🔍 Running TypeScript compilation check..."

npm run build

echo "🎉 Success! All endpoints now use environment variables."
```

**Usage**:

```bash
chmod +x scripts/fix-hardcoded-endpoints.sh
./scripts/fix-hardcoded-endpoints.sh
```

---

## 📊 Impact Summary

### Before Fix

- ❌ 40+ hardcoded `http://localhost:8000` URLs
- ❌ Cannot deploy to production
- ❌ Cannot customize ports
- ❌ Breaks in containers/remote servers
- ❌ No flexibility for distributed setups

### After Fix

- ✅ All endpoints configurable via `.env`
- ✅ Production-ready deployment
- ✅ Port customization support
- ✅ Container-friendly configuration
- ✅ Type-safe endpoint references
- ✅ Single source of truth (DRY principle)

---

## Next Steps

**Awaiting User Decision**:

1. **Proceed with Option A (Centralized Constants)?** ✅ Recommended
   - Create `lib/config/endpoints.ts`
   - Update 40+ hardcoded URLs
   - 2.5 hours total implementation time

2. **Or prefer Option B (Inline Fallbacks)?** ⚠️ Not recommended
   - Faster implementation (~1 hour)
   - More code duplication
   - Harder to maintain long-term

3. **Additional Endpoints?**
   - Are there other services that need configuration?
   - Custom deployment requirements?

Once approved, I can:

- Implement all fixes
- Run full test suite
- Update documentation
- Provide deployment guide

**Ready to proceed when you are! 🚀**
