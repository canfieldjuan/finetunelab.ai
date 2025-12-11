# VLLM VRAM Release Fix

**Date:** 2025-11-30
**Issue:** Stop Server button doesn't release VRAM - child processes remain alive
**Error:** `WARNING: destroy_process_group() was not called before program exit`

---

## 🐛 The Problem

When stopping a VLLM server from the UI, the GPU compute stops but VRAM remains occupied. Attempting to deploy a new model fails with ProcessGroupNCCL warnings about unreleased resources.

### User Report:
> "I can physically hear my GPU fan slow down but when i try to redeploy a model i get the same error about process group not being destroyed"

### Root Cause:
VLLM spawns **child processes** that hold VRAM independently:

```
python3(1816382)                    ← Parent process (what we were killing)
  └─VLLM::EngineCore(1816505)      ← Child process holding VRAM (was NOT killed!)
      ├─{thread}(1816506)
      ├─{thread}(1816507)
      └─... (20+ threads)
```

**The bug:** `process.kill(pid, 'SIGTERM')` only kills the parent process, leaving the VLLM::EngineCore child process alive and holding VRAM.

---

## 🔍 Investigation

### 1. Verified VLLM Process Structure:
```bash
$ pstree -p 1816382
python3(1816382)-+-VLLM::EngineCor(1816505)-+-{VLLM::EngineCor}(1816506)
                 |                          |-{VLLM::EngineCor}(1816507)
                 |                          ... (20+ threads)
```

### 2. Checked Which Process Holds VRAM:
```bash
$ fuser -v /dev/nvidia0 2>&1 | grep -E "1816382|1816505"
juan-canfield  1816382 F.... python3
juan-canfield  1816505 F...m VLLM::EngineCor  ← This one holds the VRAM!
```

The `F...m` flag indicates memory-mapped GPU access.

### 3. Tested Kill Behavior:

**Before (buggy):**
```bash
$ kill 1816382           # Kills parent only
$ ps -fp 1816505         # Child still alive! ❌
```

**After (fixed):**
```bash
$ kill -- -1816382       # Negative PID = kill process group
$ ps -fp 1816505         # Child killed too! ✅
```

### 4. Verified VRAM Release:
```bash
$ nvidia-smi | grep "Processes:"
|=========================================================================================|
| No running processes found                                         |  ✅ VRAM released!
```

---

## ✅ The Fix

Changed `process.kill()` to kill the **entire process group** instead of just the parent process.

**File:** `/lib/services/inference-server-manager.ts`
**Lines:** 650-705

### Before (Buggy Code):
```typescript
// Only kills the parent process
process.kill(pid, 'SIGTERM');
```

### After (Fixed Code):
```typescript
// Kill entire process group (negative PID)
try {
  process.kill(-pid, 'SIGTERM');  // Negative PID = process group
} catch (error) {
  // Fallback to individual process if group kill fails
  process.kill(pid, 'SIGTERM');
}
```

### Key Changes:

1. **Line 659:** `process.kill(-pid, 'SIGTERM')` - Use negative PID to kill process group
2. **Line 675:** `process.kill(-pid, 'SIGKILL')` - Force kill entire process group if graceful fails
3. **Fallback logic:** If process group kill fails, fall back to individual process kill

---

## 🎯 How Process Groups Work

In Unix/Linux, processes can be organized into **process groups**:

- **Process Group ID (PGID)** = Usually the same as the parent process PID
- **Killing a process group:** Use negative PID: `kill(-pid, signal)`
- **Why it matters:** Child processes inherit the PGID from their parent

### Example:
```
Parent:  PID=1000, PGID=1000
Child:   PID=1001, PGID=1000  ← Same PGID!

kill(1000, 'SIGTERM')   → Only parent dies
kill(-1000, 'SIGTERM')  → Both parent and child die ✅
```

---

## 📊 Impact

### Before Fix:
| Action | Parent Process | Child Process | VRAM |
|--------|---------------|---------------|------|
| Stop Server | Killed ✅ | Still Alive ❌ | Held ❌ |
| Deploy New Model | - | Conflict ❌ | Full ❌ |

### After Fix:
| Action | Parent Process | Child Process | VRAM |
|--------|---------------|---------------|------|
| Stop Server | Killed ✅ | Killed ✅ | Released ✅ |
| Deploy New Model | - | - | Available ✅ |

---

## 🧪 Testing the Fix

### Test Case 1: Start and Stop VLLM Server

1. **Start VLLM from UI:**
   - Deploy any model
   - Check process tree:
     ```bash
     ps aux | grep vllm
     # Should see python3 parent + VLLM::EngineCore child
     ```

2. **Stop VLLM from UI:**
   - Click "Stop Server" button
   - Check processes after stop:
     ```bash
     ps aux | grep vllm
     # Should see NO processes
     ```

3. **Verify VRAM released:**
   ```bash
   nvidia-smi | grep "Processes:"
   # Should show no running processes
   ```

### Test Case 2: Rapid Start/Stop

1. Start server
2. Immediately stop it
3. Start again
4. Should work without errors

### Test Case 3: Deploy Multiple Times

1. Deploy model A
2. Stop model A
3. Deploy model B
4. Should not get ProcessGroupNCCL error

---

## 💡 Why This Happened

### VLLM Architecture:
- **Main process:** HTTP API server (python3)
- **Child process:** VLLM::EngineCore (actual inference engine)
- **Child process holds VRAM:** Model weights, KV cache, CUDA contexts

### When Parent Dies:
- API server stops (no more requests)
- EngineCore keeps running (orphaned process)
- VRAM stays allocated
- CUDA contexts not released
- ProcessGroupNCCL not cleaned up

---

## 🔧 Edge Cases Handled

### 1. Process Group Doesn't Exist
```typescript
try {
  process.kill(-pid, 'SIGTERM');
} catch (error) {
  // Fallback to individual process
  process.kill(pid, 'SIGTERM');
}
```

### 2. Process Already Dead
```typescript
try {
  process.kill(pid, 0);  // Check if alive
} catch {
  console.log('Process already terminated');
}
```

### 3. Graceful Shutdown Timeout
```typescript
setTimeout(() => {
  // After 5s, force kill if still alive
  process.kill(-pid, 'SIGKILL');
}, 5000);
```

---

## 📝 Related Issues

### Similar Symptoms:
- "GPU memory not released after stopping"
- "Can't deploy new model - out of memory"
- "ProcessGroupNCCL warning on exit"
- "Zombie VLLM processes"

### All Fixed By:
Killing the entire process group instead of just the parent.

---

## 🚀 Prevention

### For Future Server Implementations:

1. **Always kill process groups** for servers that spawn children
2. **Verify cleanup** by checking `ps` and `nvidia-smi`
3. **Add cleanup hooks** for unexpected exits
4. **Test rapid start/stop** cycles

### Code Pattern:
```typescript
// ✅ Good: Kill process group
process.kill(-pid, 'SIGTERM');

// ❌ Bad: Kill only parent
process.kill(pid, 'SIGTERM');
```

---

## 📚 References

- **Node.js process.kill():** https://nodejs.org/api/process.html#processkillpid-signal
- **Unix Process Groups:** `man 2 kill` (negative PID behavior)
- **VLLM Architecture:** Engine runs in separate process for isolation
- **CUDA Context Management:** Requires explicit cleanup or process termination

---

## ✅ Success Criteria

After applying this fix:

- ✅ Stop Server button kills all VLLM processes
- ✅ VRAM is completely released (verified with nvidia-smi)
- ✅ No ProcessGroupNCCL warnings
- ✅ Can immediately deploy new model after stopping
- ✅ No zombie processes left behind
- ✅ GPU fan returns to idle speed

---

## 🔍 Debugging Commands

If you suspect VRAM is not releasing:

```bash
# 1. Check for VLLM processes
ps aux | grep vllm

# 2. Check process tree
pstree -p $(pgrep -f vllm)

# 3. Check GPU usage
nvidia-smi

# 4. Check which processes hold GPU
fuser -v /dev/nvidia0

# 5. Check process group
ps -o pid,pgid,cmd -p <PID>

# 6. Manually kill process group (if needed)
kill -- -<PGID>
```

---

**End of Document**
