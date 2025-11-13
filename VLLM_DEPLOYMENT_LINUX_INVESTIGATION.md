# vLLM Deployment Linux Investigation

**Date:** 2025-11-09
**Issue:** Deploy to vLLM button not working on Linux after migration
**Current Status:** Docker-based deployment, Docker not installed

---

## Current Implementation

### Where the Button Appears
**File:** `app/training/monitor/page.tsx:460-465`

The "Deploy to vLLM" button appears after training completes:
```typescript
{currentStatus && (
  <div className="flex justify-center">
    <DeployModelButton
      jobId={jobId}
      modelName={currentStatus.status === 'completed' ? 'Trained Model' : undefined}
      status={currentStatus.status as 'running' | 'completed' | 'failed'}
    />
  </div>
)}
```

### How It Works

#### 1. vLLM Availability Check
**Component:** `DeployModelButton.tsx:75-100`
**API:** `/api/training/vllm/check` → `lib/services/vllm-checker.ts`

```typescript
// Checks if vLLM Python package is installed
const pythonPath = process.env.VLLM_PYTHON_PATH || 'python';
await execAsync(`${pythonPath} -c "import vllm; print('OK')"`);
```

**Current check:** Python vLLM package availability
**Result on your system:** ❓ Unknown (need to check)

#### 2. Deployment Method Selection
**Component:** `DeployModelButton.tsx:206-273`

User can choose:
- **vLLM** - Fast inference, OpenAI-compatible API
- **Ollama** - Local models manager

#### 3. Deployment API
**File:** `app/api/training/deploy/route.ts`

**Critical Check (lines 70-88):**
```typescript
if (server_type === 'vllm') {
  // Check Docker availability
  try {
    execSync('docker --version', { timeout: 5000 });
    console.log('Docker is available for vLLM container deployment');
  } catch (dockerError) {
    return NextResponse.json({
      error: 'Docker not available',
      details: 'Docker is required for vLLM deployments. Please ensure Docker Desktop is running.',
    }, { status: 400 });
  }
}
```

**Your system:** ❌ Docker not found

#### 4. Docker-Based Deployment
**File:** `lib/services/inference-server-manager.ts:1380-1490`

Current implementation uses Docker containers:
```typescript
const dockerCmd = [
  'docker run -d',
  `--name ${containerName}`,
  '--gpus all',  // ← Requires NVIDIA Container Toolkit
  `-p ${port}:8000`,
  `-v "${normalizedPath}:/model"`,
  dockerImage,  // vllm/vllm-openai:v0.6.3.post1
  '--model /model',
  '--trust-remote-code',
  `--gpu-memory-utilization 0.8`,
  '--enable-lora',
  '--enable-auto-tool-choice',
];
```

**Why Docker?**
- Cross-platform compatibility (was designed for Windows)
- Isolated environment
- NVIDIA GPU support via Container Toolkit
- Easy version management

---

## Current Deployment Architecture

### Docker-Based (Current)
```
User clicks "Deploy to vLLM"
     ↓
Check Docker installed (deploy/route.ts:75)
     ↓
Start vLLM Docker container (inference-server-manager.ts:1380)
     ├─ Mount model: /model
     ├─ Mount adapter: /adapter (if LoRA)
     ├─ Expose port: 8002-8020
     └─ GPU access: --gpus all
     ↓
Wait for container healthy (30 sec timeout)
     ↓
Register model in llm_models table
     ↓
Redirect to /models page
```

---

## Linux Native Options

### Option 1: Install Docker (Fastest - Recommended)
Keep existing implementation, just install Docker.

**Pros:**
- ✅ No code changes needed
- ✅ Works exactly as designed
- ✅ Isolation and resource management
- ✅ Easy GPU access with NVIDIA Container Toolkit

**Cons:**
- ❌ Additional dependency
- ❌ Requires setup (Docker + NVIDIA Container Toolkit)
- ❌ Overhead from containerization

**Installation:**
```bash
# 1. Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# 2. Install NVIDIA Container Toolkit (for GPU access)
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker

# 3. Test
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

**Effort:** ~30 min setup
**Code changes:** None

---

### Option 2: Native vLLM Process (Better for Linux)
Spawn vLLM Python process directly without Docker.

**Pros:**
- ✅ No Docker dependency
- ✅ Better performance (no container overhead)
- ✅ Direct GPU access
- ✅ More Linux-native approach

**Cons:**
- ❌ Requires code changes
- ❌ Python environment management
- ❌ Need to handle process lifecycle

**Implementation:**
```typescript
// New method in inference-server-manager.ts
private async startVLLMNative(
  modelPath: string,
  modelName: string,
  port: number,
  config: VLLMConfig
): Promise<ChildProcess> {
  const pythonPath = process.env.VLLM_PYTHON_PATH || 'python';

  const args = [
    '-m', 'vllm.entrypoints.openai.api_server',
    '--model', modelPath,
    '--served-model-name', modelName,
    '--host', '0.0.0.0',
    '--port', port.toString(),
    '--gpu-memory-utilization', (config.gpuMemoryUtilization || 0.8).toString(),
    '--trust-remote-code',
    '--enable-lora',
    '--max-loras', '4',
  ];

  const vllmProcess = spawn(pythonPath, args, {
    env: { ...process.env, CUDA_VISIBLE_DEVICES: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return vllmProcess;
}
```

**Effort:** ~4-6 hours coding + testing
**Code changes:** Medium (inference-server-manager.ts, deploy/route.ts)

---

### Option 3: Hybrid Approach
Support both Docker and native modes.

**Implementation:**
```typescript
// In deploy/route.ts
if (server_type === 'vllm') {
  const useDocker = process.env.VLLM_USE_DOCKER !== 'false';

  if (useDocker) {
    // Check Docker availability
    try {
      execSync('docker --version');
      // Use Docker-based deployment
    } catch {
      // Fall back to native if Docker not available
      useDocker = false;
    }
  }

  if (!useDocker) {
    // Use native vLLM process
  }
}
```

**Pros:**
- ✅ Works on both Windows (Docker) and Linux (native)
- ✅ Automatic fallback
- ✅ Best of both worlds

**Cons:**
- ❌ Most code changes
- ❌ Two code paths to maintain

**Effort:** ~6-8 hours coding + testing
**Code changes:** Large

---

## Recommendation

### For Quick Fix: Option 1 (Install Docker)
If you want the Deploy button working ASAP:

```bash
# Run this script
sudo apt-get update
sudo apt-get install -y docker.io docker-compose nvidia-container-toolkit
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
sudo systemctl restart docker

# Log out and back in for group changes
# Then test: docker run hello-world
```

**Time:** 30 minutes
**Effort:** Minimal
**Risk:** Low

### For Long-Term: Option 2 (Native vLLM)
If you want a cleaner Linux solution:

**Benefits:**
- No container overhead
- Direct GPU access
- More control over process
- Easier debugging

**Implementation Plan:**
1. Create `startVLLMNative()` method
2. Update `deploy/route.ts` to use native mode
3. Handle process lifecycle (start, stop, monitor)
4. Update vLLM checker to verify Python env
5. Test with trained models

**Time:** 4-6 hours
**Effort:** Medium
**Risk:** Medium

---

## Current System Requirements

### For Docker-Based Deployment
- ✅ NVIDIA GPU
- ❌ Docker (not installed)
- ❌ NVIDIA Container Toolkit (not installed)
- ✅ vLLM Python package (check: `python -c "import vllm"`)

### For Native Deployment
- ✅ NVIDIA GPU
- ✅ Python 3.8+
- ❓ vLLM Python package (need to verify)
- ❓ CUDA drivers (need to verify)

---

## Testing Checklist

### Docker-Based (Option 1)
- [ ] Install Docker
- [ ] Install NVIDIA Container Toolkit
- [ ] Test GPU access: `docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi`
- [ ] Pull vLLM image: `docker pull vllm/vllm-openai:v0.6.3.post1`
- [ ] Deploy trained model via UI
- [ ] Verify model appears in /models page
- [ ] Test inference via API

### Native Process (Option 2)
- [ ] Verify vLLM installed: `python -c "import vllm; print(vllm.__version__)"`
- [ ] Verify GPU access: `python -c "import torch; print(torch.cuda.is_available())"`
- [ ] Implement native spawning
- [ ] Test model deployment
- [ ] Verify port allocation
- [ ] Test process lifecycle (start/stop)
- [ ] Load test with concurrent models

---

## Environment Variables

### Current (Docker-Based)
```bash
# Optional: Custom Docker image
VLLM_DOCKER_IMAGE=vllm/vllm-openai:v0.6.3.post1

# Optional: Container name
VLLM_DOCKER_CONTAINER_NAME=vllm-server

# Optional: Python path for vLLM check
VLLM_PYTHON_PATH=python
```

### Proposed (Native)
```bash
# Enable native mode (disable Docker)
VLLM_USE_DOCKER=false

# Python with vLLM installed
VLLM_PYTHON_PATH=/path/to/python

# GPU device selection
CUDA_VISIBLE_DEVICES=0

# vLLM log level
VLLM_LOG_LEVEL=INFO
```

---

## Files to Modify (Option 2)

### Core Changes
1. **`lib/services/inference-server-manager.ts`**
   - Add `startVLLMNative()` method (~150 lines)
   - Add process management for native mode
   - Handle LoRA adapters in native mode
   - Update port allocation

2. **`app/api/training/deploy/route.ts`**
   - Add Docker detection logic (~20 lines)
   - Fallback to native if Docker unavailable
   - Update error messages

3. **`lib/services/vllm-checker.ts`**
   - Add CUDA availability check (~30 lines)
   - Verify vLLM can access GPU
   - Check VLLM_PYTHON_PATH

### Optional Changes
4. **`components/training/DeployModelButton.tsx`**
   - Update UI messaging (Docker vs native)
   - Show deployment mode in dialog

5. **`.env.example`**
   - Document new environment variables

---

## Next Steps

**Choose your path:**

**A) Quick fix (30 min):** Install Docker + NVIDIA Container Toolkit
**B) Long-term (4-6 hours):** Implement native vLLM spawning
**C) Hybrid (6-8 hours):** Support both Docker and native

**Recommendation:** Start with A, then implement B in a future PR for better Linux support.

---

## Additional Notes

### LoRA Adapter Support
Current implementation handles LoRA adapters by:
- Detecting adapter directory structure
- Finding local base model
- Mounting both base + adapter to Docker
- Using vLLM native LoRA support (`--enable-lora`)

**Native mode will need:**
- Same detection logic ✅
- Pass both paths to vLLM command ✅
- Ensure adapter loading works without container ⚠️

### Port Management
- vLLM servers auto-allocate ports 8002-8020
- Each model gets dedicated port
- Status tracked in `llm_models` table
- Must handle port conflicts

### Model Storage
- Training outputs: `lib/training/logs/job_{jobId}/`
- Checkpoints: `lib/training/logs/job_{jobId}/checkpoint-{step}/`
- Models cached: `~/.cache/huggingface/` (for base models)

---

**Ready to proceed?** Let me know which option you prefer and I'll help implement it!
