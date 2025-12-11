# VLLM Stop Server Bug Fix

**Date:** 2025-11-30
**Issue:** Stop Server button doesn't kill VLLM processes that survive server restarts
**Root Cause:** Process tracking relies on in-memory Map that gets cleared on restart

---

## 🐛 The Bug

### **What Happens:**
1. User deploys VLLM server → Process starts (PID 327646)
2. Next.js server restarts (common in development)
3. In-memory `this.processes` Map is cleared
4. VLLM process keeps running in background
5. User clicks "Stop Server"
6. Code can't find process in Map → Updates DB but doesn't kill process
7. VLLM continues eating 20GB VRAM

### **Code Location:**
**File:** `/lib/services/inference-server-manager.ts`
**Lines:** 626-632

```typescript
const process = this.processes.get(serverId);
if (!process) {
  console.warn('[InferenceServerManager] Process not found:', serverId);
  // Update database anyway
  await this.updateServerStatus(serverId, userId, 'stopped');
  return;  // ← BUG: Returns without killing actual process!
}
```

---

## ✅ The Fix

### **Strategy:**
Instead of relying solely on in-memory Map, use the `process_id` stored in the database and kill by PID.

### **Updated Code:**

```typescript
async stopServer(serverId: string, userId: string | null): Promise<void> {
  console.log('[InferenceServerManager] Stopping server:', serverId);

  // First, try to get process from memory
  const memoryProcess = this.processes.get(serverId);

  // Also get the PID from database as fallback
  const serverInfo = await this.getServerStatus(serverId, userId);
  const pid = serverInfo?.pid || memoryProcess?.pid;

  if (!memoryProcess && !pid) {
    console.warn('[InferenceServerManager] No process found in memory or database');
    // Update database anyway
    await this.updateServerStatus(serverId, userId, 'stopped');
    return;
  }

  // If we have a PID (from DB or memory), try to kill it
  if (pid) {
    try {
      console.log('[InferenceServerManager] Attempting to kill PID:', pid);

      // Try graceful shutdown first (SIGTERM)
      process.kill(pid, 'SIGTERM');

      // Wait up to 5 seconds for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          try {
            // Check if still alive
            process.kill(pid, 0);
            // Still alive, force kill
            console.warn('[InferenceServerManager] Force killing PID:', pid);
            process.kill(pid, 'SIGKILL');
          } catch {
            // Process already dead
            console.log('[InferenceServerManager] Process already terminated');
          }
          resolve();
        }, 5000);

        // Set up interval to check if process died
        const checkInterval = setInterval(() => {
          try {
            process.kill(pid, 0); // Check if alive
          } catch {
            // Process is dead
            clearTimeout(timeout);
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });

      console.log('[InferenceServerManager] Process killed successfully');
    } catch (error) {
      // Process might already be dead, or we don't have permission
      console.warn('[InferenceServerManager] Kill failed (process may already be dead):', error);
    }
  }

  // If we had it in memory, remove it
  if (memoryProcess) {
    this.processes.delete(serverId);
  }

  // Update database
  await this.updateServerStatus(serverId, userId, 'stopped', new Date().toISOString());
}
```

---

## 🔍 Additional Fix: Clean Up Zombie Processes

### **Problem:**
If server crashes or restarts, database might show "running" but process is dead.

### **Solution:**
Add a cleanup method to check DB against actual running processes:

```typescript
/**
 * Clean up zombie processes - servers marked as running but process is dead
 */
async cleanupZombieProcesses(userId: string | null): Promise<void> {
  console.log('[InferenceServerManager] Checking for zombie processes...');

  // Get all "running" servers for this user
  let query = supabase
    .from('local_inference_servers')
    .select('*')
    .eq('status', 'running');

  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.is('user_id', null);
  }

  const { data: servers, error } = await query;

  if (error || !servers || servers.length === 0) {
    return;
  }

  for (const server of servers) {
    if (!server.process_id) {
      // No PID stored, mark as stopped
      await this.updateServerStatus(server.id, userId, 'stopped');
      continue;
    }

    try {
      // Check if process is actually alive
      process.kill(server.process_id, 0);
      console.log('[InferenceServerManager] Process still alive:', server.process_id);
    } catch {
      // Process is dead, update database
      console.log('[InferenceServerManager] Zombie process found, cleaning up:', server.process_id);
      await this.updateServerStatus(server.id, userId, 'stopped');
    }
  }
}
```

### **Call on Server Start:**

**File:** `/lib/services/inference-server-manager.ts`
**Location:** In constructor or initialization

```typescript
constructor() {
  this.processes = new Map();

  // Clean up zombie processes on startup
  this.cleanupZombieProcesses(null).catch(err =>
    console.error('[InferenceServerManager] Failed to cleanup zombies:', err)
  );
}
```

---

## 📋 Implementation Checklist

- [ ] Update `stopServer` method to use PID from database
- [ ] Add zombie process cleanup method
- [ ] Call cleanup on server manager initialization
- [ ] Test: Deploy VLLM → Restart Next.js → Click Stop → Verify process dies
- [ ] Test: Kill Next.js while VLLM running → Restart → Check DB cleanup
- [ ] Add logging for debugging

---

## 🧪 Testing Steps

1. **Test Normal Stop:**
   ```bash
   # Deploy VLLM server
   # Click "Stop Server" in UI
   # Check: nvidia-smi (should show VRAM freed)
   # Check: Database status should be "stopped"
   ```

2. **Test After Server Restart:**
   ```bash
   # Deploy VLLM server
   # Restart Next.js server (Ctrl+C, npm run dev)
   # Click "Stop Server" in UI
   # Check: nvidia-smi (should show VRAM freed) ← This was failing before
   # Check: Database status should be "stopped"
   ```

3. **Test Zombie Cleanup:**
   ```bash
   # Deploy VLLM server
   # Kill VLLM process manually: kill <PID>
   # Restart Next.js
   # Check: Database should auto-update to "stopped"
   ```

---

## 🎯 Success Criteria

- ✅ Stop button kills process even after Next.js restart
- ✅ Zombie processes (dead but marked running) get cleaned up
- ✅ VRAM is properly freed when stop is clicked
- ✅ Database state matches actual process state

---

**End of Document**
