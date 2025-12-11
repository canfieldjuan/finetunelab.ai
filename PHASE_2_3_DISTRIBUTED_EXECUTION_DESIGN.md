# Phase 2.3: Distributed Execution - Design Document

**Status:** Design Phase  
**Priority:** HIGH (Audit Gap)  
**Estimated Effort:** 3-4 weeks

---

## Executive Summary

Phase 2.3 addresses the critical audit gap: **"Single orchestrator instance bottleneck"**. This phase transforms the DAG orchestration system from a single-instance deployment to a horizontally scalable, distributed system capable of executing workflows across multiple worker machines.

### Goals

1. **Horizontal Scaling**: Support multiple worker nodes processing jobs in parallel
2. **Message Queue Integration**: Reliable job distribution via BullMQ + Redis
3. **External State Store**: Shared execution state across orchestrator instances
4. **Worker Management**: Registration, heartbeat, health monitoring, failover
5. **Load Balancing**: Intelligent job distribution based on worker capacity
6. **Fault Tolerance**: Automatic job redistribution on worker failure

### Current Limitations (from Audit)

> **Critical Gap**: "Single orchestrator instance bottleneck"  
> **Use Case**: "Cannot scale horizontally for high-throughput workflows"  
> **Current Limitation**: "All jobs executed on single machine, in-memory state"  
> **Priority**: HIGH - Must Have for Production Scale

---

## Architecture Overview

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  (API Requests: POST /execute, GET /status, GET /workers)       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Distributed Orchestrator                      │
│  • Job Scheduling & Dispatching                                 │
│  • Worker Selection & Load Balancing                            │
│  • Execution State Management                                   │
│  • Failure Detection & Recovery                                 │
└─────┬──────────────────────────────────────────────┬────────────┘
      │                                               │
      │ Submit Jobs                                   │ Read/Write State
      │                                               │
┌─────▼─────────────────────────┐     ┌──────────────▼─────────────┐
│      Message Queue (Redis)    │     │   State Store (Redis)       │
│    • BullMQ Job Queue         │     │ • Execution State (JSONB)   │
│    • Priority Handling        │     │ • Worker Registry           │
│    • Retry Logic              │     │ • Distributed Locks         │
│    • Dead Letter Queue        │     │ • Checkpoint Metadata       │
└───────┬───────────────────────┘     └────────────────────────────┘
        │                                              │
        │ Consume Jobs                                 │ Update State
        │                                              │
┌───────▼────────────┐  ┌──────────────┐  ┌──────────▼──────────┐
│   Worker Node 1    │  │ Worker Node 2 │  │   Worker Node N     │
│ • Job Execution    │  │ • Job Exec.   │  │ • Job Execution     │
│ • Heartbeat        │  │ • Heartbeat   │  │ • Heartbeat         │
│ • Result Reporting │  │ • Result Rep. │  │ • Result Reporting  │
└────────────────────┘  └──────────────┘  └─────────────────────┘
```

### Data Flow

1. **Job Submission**:
   - Client → API → Distributed Orchestrator
   - Orchestrator validates DAG, creates execution
   - Orchestrator stores initial state in State Store
   - Orchestrator submits jobs to Message Queue

2. **Job Processing**:
   - Worker polls Message Queue for available jobs
   - Worker claims job, updates state to 'running'
   - Worker executes job handler
   - Worker reports result to State Store
   - Worker acknowledges job completion to Queue

3. **State Synchronization**:
   - All state changes written to State Store
   - Orchestrator polls State Store for progress
   - Multiple orchestrator instances can coordinate via State Store
   - Distributed locks prevent race conditions

4. **Failure Handling**:
   - Worker heartbeat every 30s
   - Worker Manager detects missed heartbeats
   - Jobs reassigned from dead workers
   - BullMQ automatic retry for failed jobs

---

## Component Design

### 1. Message Queue (BullMQ + Redis)

**Purpose**: Reliable, distributed job queue with priority handling and automatic retries.

**Technology Choice**: BullMQ (Redis-based)
- **Pros**: Excellent TypeScript support, Redis-backed (fast), built-in retry logic, priority queues, delayed jobs
- **Cons**: Requires Redis server, additional infrastructure
- **Alternatives Considered**: RabbitMQ (more complex), AWS SQS (cloud-only), Kafka (overkill)

**Queue Schema**:

```typescript
interface QueueJobData {
  executionId: string;
  jobId: string;
  jobType: string;
  config: Record<string, unknown>;
  dependencyOutputs: Record<string, unknown>;
  priority: number; // 1-10 (10 = highest)
  maxRetries: number;
  timeout: number; // milliseconds
  requiredCapabilities?: string[]; // e.g., ['gpu', 'high-memory']
}

interface QueueJobResult {
  success: boolean;
  output?: unknown;
  error?: string;
  logs?: string[];
  metadata?: {
    workerId: string;
    executionTime: number;
    memoryUsed: number;
  };
}
```

**Queue Configuration**:

```typescript
const queueConfig = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times
    backoff: {
      type: 'exponential',
      delay: 5000, // Start with 5s delay
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 1000, // Keep last 1000 failed jobs
  },
  limiter: {
    max: 100, // Max 100 jobs processed per duration
    duration: 1000, // 1 second
  },
};
```

**Queue Operations**:

```typescript
class JobQueue {
  private queue: Queue<QueueJobData, QueueJobResult>;

  async submitJob(job: QueueJobData): Promise<string> {
    // Add job to queue with priority
    const queueJob = await this.queue.add(job.jobId, job, {
      priority: job.priority,
      jobId: `${job.executionId}_${job.jobId}`,
    });
    return queueJob.id;
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const job = await this.queue.getJob(jobId);
    if (!job) return 'not-found';
    
    const state = await job.getState();
    return state; // 'waiting', 'active', 'completed', 'failed', 'delayed'
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    await job?.remove();
  }

  async getQueueStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }
}
```

---

### 2. Worker Manager

**Purpose**: Manage worker lifecycle, health monitoring, and job assignment.

**Worker Registry Schema (Redis)**:

```typescript
interface WorkerRegistration {
  workerId: string;
  hostname: string;
  pid: number;
  capabilities: string[]; // e.g., ['cpu', 'gpu', 'high-memory']
  maxConcurrency: number; // Max parallel jobs
  currentLoad: number; // Current active jobs
  registeredAt: number; // Timestamp
  lastHeartbeat: number; // Timestamp
  status: 'active' | 'idle' | 'busy' | 'unhealthy' | 'offline';
  metadata: {
    cpuCores: number;
    memoryGB: number;
    gpuCount: number;
    version: string;
  };
}
```

**Redis Keys**:
- `workers:{workerId}` → Worker registration data (TTL: 60s, refreshed by heartbeat)
- `workers:active` → Set of active worker IDs
- `workers:assignments:{workerId}` → Set of job IDs assigned to worker
- `workers:heartbeats` → Sorted set of (workerId, timestamp) for health checks

**Worker Manager Operations**:

```typescript
class WorkerManager {
  private redis: Redis;

  async registerWorker(worker: WorkerRegistration): Promise<void> {
    // Store worker data with TTL
    await this.redis.setex(
      `workers:${worker.workerId}`,
      60, // 60 second TTL
      JSON.stringify(worker)
    );
    
    // Add to active workers set
    await this.redis.sadd('workers:active', worker.workerId);
    
    // Record heartbeat
    await this.redis.zadd('workers:heartbeats', Date.now(), worker.workerId);
  }

  async heartbeat(workerId: string): Promise<void> {
    // Refresh worker TTL
    const workerKey = `workers:${workerId}`;
    const worker = await this.redis.get(workerKey);
    if (!worker) throw new Error('Worker not registered');
    
    await this.redis.setex(workerKey, 60, worker);
    await this.redis.zadd('workers:heartbeats', Date.now(), workerId);
  }

  async selectWorker(jobRequirements?: {
    capabilities?: string[];
    minMemoryGB?: number;
  }): Promise<string | null> {
    // Get all active workers
    const workerIds = await this.redis.smembers('workers:active');
    
    // Load worker data
    const workers = await Promise.all(
      workerIds.map(id => this.getWorker(id))
    );
    
    // Filter by requirements
    let eligible = workers.filter(w => w && w.status === 'active');
    
    if (jobRequirements?.capabilities) {
      eligible = eligible.filter(w =>
        jobRequirements.capabilities!.every(cap =>
          w!.capabilities.includes(cap)
        )
      );
    }
    
    if (jobRequirements?.minMemoryGB) {
      eligible = eligible.filter(w =>
        w!.metadata.memoryGB >= jobRequirements.minMemoryGB!
      );
    }
    
    if (eligible.length === 0) return null;
    
    // Select worker with lowest load
    eligible.sort((a, b) => a!.currentLoad - b!.currentLoad);
    return eligible[0]!.workerId;
  }

  async detectUnhealthyWorkers(): Promise<string[]> {
    const now = Date.now();
    const threshold = now - 90000; // 90 seconds ago
    
    // Get workers with heartbeat older than threshold
    const unhealthy = await this.redis.zrangebyscore(
      'workers:heartbeats',
      0,
      threshold
    );
    
    // Mark workers as offline
    for (const workerId of unhealthy) {
      await this.markWorkerOffline(workerId);
    }
    
    return unhealthy;
  }

  async markWorkerOffline(workerId: string): Promise<void> {
    await this.redis.srem('workers:active', workerId);
    await this.redis.del(`workers:${workerId}`);
    await this.redis.zrem('workers:heartbeats', workerId);
  }

  async getWorkerStats(): Promise<{
    total: number;
    active: number;
    idle: number;
    busy: number;
    offline: number;
  }> {
    const workerIds = await this.redis.smembers('workers:active');
    const workers = await Promise.all(workerIds.map(id => this.getWorker(id)));
    
    return {
      total: workers.length,
      active: workers.filter(w => w?.status === 'active').length,
      idle: workers.filter(w => w?.status === 'idle').length,
      busy: workers.filter(w => w?.status === 'busy').length,
      offline: 0, // Offline workers removed from active set
    };
  }
}
```

---

### 3. State Store (Redis + Supabase)

**Purpose**: Centralized execution state accessible by all orchestrator instances and workers.

**State Storage Strategy**:
- **Redis**: Fast, in-memory cache for active execution state (TTL: 24 hours)
- **Supabase**: Durable, long-term storage for completed/archived executions
- **Write Pattern**: Write-through (update both Redis and Supabase)
- **Read Pattern**: Read from Redis first, fallback to Supabase

**Redis Schema**:

```typescript
// Keys:
// executions:{executionId} → Full execution state (JSONB)
// executions:{executionId}:jobs:{jobId} → Individual job state
// executions:{executionId}:locks → Distributed lock
// executions:active → Set of active execution IDs
```

**State Store Operations**:

```typescript
class StateStore {
  private redis: Redis;
  private supabase: SupabaseClient;

  async saveExecution(execution: DAGExecution): Promise<void> {
    const serialized = StateSerializer.serialize(execution);
    
    // Write to Redis (fast, in-memory)
    await this.redis.setex(
      `executions:${execution.id}`,
      86400, // 24 hour TTL
      JSON.stringify(serialized)
    );
    
    // Add to active set
    if (execution.status === 'running') {
      await this.redis.sadd('executions:active', execution.id);
    } else {
      await this.redis.srem('executions:active', execution.id);
    }
    
    // Write to Supabase (durable, long-term)
    await this.supabase
      .from('dag_executions')
      .upsert({
        id: execution.id,
        name: execution.name,
        status: execution.status,
        state: serialized,
        updated_at: new Date().toISOString(),
      });
  }

  async getExecution(executionId: string): Promise<DAGExecution | null> {
    // Try Redis first
    const cached = await this.redis.get(`executions:${executionId}`);
    if (cached) {
      return StateSerializer.deserialize(JSON.parse(cached));
    }
    
    // Fallback to Supabase
    const { data, error } = await this.supabase
      .from('dag_executions')
      .select('state')
      .eq('id', executionId)
      .single();
    
    if (error || !data) return null;
    
    const execution = StateSerializer.deserialize(data.state);
    
    // Cache in Redis for next read
    await this.redis.setex(
      `executions:${executionId}`,
      86400,
      JSON.stringify(data.state)
    );
    
    return execution;
  }

  async updateJobStatus(
    executionId: string,
    jobId: string,
    status: JobStatus,
    output?: unknown,
    error?: string
  ): Promise<void> {
    // Acquire distributed lock
    const lock = await this.acquireLock(executionId);
    
    try {
      // Load execution
      const execution = await this.getExecution(executionId);
      if (!execution) throw new Error('Execution not found');
      
      // Update job
      const job = execution.jobs.get(jobId);
      if (!job) throw new Error('Job not found');
      
      job.status = status;
      if (output !== undefined) job.output = output;
      if (error) job.error = error;
      if (status === 'completed' || status === 'failed') {
        job.completedAt = new Date();
      }
      
      // Save updated execution
      await this.saveExecution(execution);
    } finally {
      await this.releaseLock(lock);
    }
  }

  async acquireLock(executionId: string, ttl: number = 30000): Promise<string> {
    const lockKey = `executions:${executionId}:lock`;
    const lockValue = `${Date.now()}_${Math.random()}`;
    
    // Try to acquire lock (NX = only if not exists, PX = expire after ttl ms)
    const acquired = await this.redis.set(lockKey, lockValue, 'PX', ttl, 'NX');
    
    if (!acquired) {
      throw new Error('Could not acquire lock - execution locked by another process');
    }
    
    return lockValue;
  }

  async releaseLock(lockValue: string): Promise<void> {
    // Lua script to atomically check and delete lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    await this.redis.eval(script, 1, lockValue);
  }
}
```

---

### 4. Distributed Orchestrator

**Purpose**: Coordinate workflow execution across multiple workers using message queue and state store.

**Key Changes from Current Orchestrator**:

| Current (Single-Instance) | Distributed |
|---------------------------|-------------|
| In-memory execution state | Redis-backed state store |
| Direct job handler invocation | Jobs submitted to queue |
| Single machine job execution | Jobs distributed to workers |
| No worker management | Worker registration & health monitoring |
| Local parallelism only | Horizontal scaling across machines |

**Distributed Orchestrator Operations**:

```typescript
class DistributedOrchestrator {
  private stateStore: StateStore;
  private jobQueue: JobQueue;
  private workerManager: WorkerManager;

  async execute(
    name: string,
    jobs: JobConfig[],
    options?: ExecutionOptions
  ): Promise<DAGExecution> {
    // Validate DAG
    this.validateDAG(jobs);
    
    // Create execution
    const execution: DAGExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name,
      status: 'running',
      startedAt: new Date(),
      jobs: new Map(),
    };
    
    // Initialize jobs
    for (const jobConfig of jobs) {
      execution.jobs.set(jobConfig.id, {
        jobId: jobConfig.id,
        status: 'pending',
        config: jobConfig,
        logs: [],
        attempts: 0,
      });
    }
    
    // Save to state store
    await this.stateStore.saveExecution(execution);
    
    // Start execution in background
    this.executeDAG(execution.id).catch(error => {
      console.error(`[DISTRIBUTED] Execution ${execution.id} failed:`, error);
    });
    
    return execution;
  }

  private async executeDAG(executionId: string): Promise<void> {
    const execution = await this.stateStore.getExecution(executionId);
    if (!execution) throw new Error('Execution not found');
    
    const levels = this.computeLevels(execution);
    
    for (const level of levels) {
      await this.executeLevelDistributed(execution, level);
    }
    
    execution.status = 'completed';
    execution.completedAt = new Date();
    await this.stateStore.saveExecution(execution);
  }

  private async executeLevelDistributed(
    execution: DAGExecution,
    level: string[]
  ): Promise<void> {
    // Get jobs for this level
    const jobs = level.map(jobId => execution.jobs.get(jobId)!);
    
    // Submit all jobs to queue
    const queueJobIds = await Promise.all(
      jobs.map(job => this.submitJobToQueue(execution.id, job))
    );
    
    // Wait for all jobs to complete
    await this.waitForJobsToComplete(execution.id, level);
  }

  private async submitJobToQueue(
    executionId: string,
    job: JobExecution
  ): Promise<string> {
    // Get dependency outputs
    const dependencyOutputs: Record<string, unknown> = {};
    for (const depId of job.config.dependsOn || []) {
      const execution = await this.stateStore.getExecution(executionId);
      const depJob = execution?.jobs.get(depId);
      if (depJob?.output) {
        dependencyOutputs[depId] = depJob.output;
      }
    }
    
    // Submit to queue
    const queueJobData: QueueJobData = {
      executionId,
      jobId: job.jobId,
      jobType: job.config.type,
      config: job.config.config,
      dependencyOutputs,
      priority: job.config.priority || 5,
      maxRetries: job.config.retryConfig?.maxRetries || 3,
      timeout: job.config.timeoutMs || 300000, // 5 minutes default
      requiredCapabilities: job.config.requiredCapabilities,
    };
    
    return await this.jobQueue.submitJob(queueJobData);
  }

  private async waitForJobsToComplete(
    executionId: string,
    jobIds: string[]
  ): Promise<void> {
    const pollInterval = 1000; // 1 second
    
    while (true) {
      const execution = await this.stateStore.getExecution(executionId);
      if (!execution) throw new Error('Execution not found');
      
      const allCompleted = jobIds.every(jobId => {
        const job = execution.jobs.get(jobId);
        return job && (job.status === 'completed' || job.status === 'failed');
      });
      
      if (allCompleted) break;
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
}
```

---

### 5. Worker Node

**Purpose**: Execute jobs from the queue and report results.

**Worker Architecture**:

```typescript
class DAGWorker {
  private workerId: string;
  private workerManager: WorkerManager;
  private stateStore: StateStore;
  private jobQueue: Queue;
  private handlers: Map<string, JobHandler>;
  private activeJobs: Set<string> = new Set();

  async start(): Promise<void> {
    // Register worker
    const registration: WorkerRegistration = {
      workerId: this.workerId,
      hostname: os.hostname(),
      pid: process.pid,
      capabilities: this.detectCapabilities(),
      maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '4'),
      currentLoad: 0,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      metadata: {
        cpuCores: os.cpus().length,
        memoryGB: os.totalmem() / 1024 / 1024 / 1024,
        gpuCount: 0, // TODO: Detect GPUs
        version: process.env.WORKER_VERSION || '1.0.0',
      },
    };
    
    await this.workerManager.registerWorker(registration);
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Start processing jobs
    this.processJobs();
  }

  private startHeartbeat(): void {
    setInterval(async () => {
      try {
        await this.workerManager.heartbeat(this.workerId);
      } catch (error) {
        console.error('[WORKER] Heartbeat failed:', error);
      }
    }, 30000); // Every 30 seconds
  }

  private async processJobs(): Promise<void> {
    // Create worker that polls queue
    const worker = new Worker<QueueJobData, QueueJobResult>(
      'dag-jobs',
      async (job) => {
        return await this.executeJob(job.data);
      },
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        concurrency: parseInt(process.env.MAX_CONCURRENCY || '4'),
      }
    );

    worker.on('completed', (job, result) => {
      console.log(`[WORKER] Job ${job.id} completed`);
      this.activeJobs.delete(job.id);
    });

    worker.on('failed', (job, error) => {
      console.error(`[WORKER] Job ${job?.id} failed:`, error);
      if (job) this.activeJobs.delete(job.id);
    });
  }

  private async executeJob(jobData: QueueJobData): Promise<QueueJobResult> {
    const startTime = Date.now();
    this.activeJobs.add(jobData.jobId);
    
    try {
      // Update job status to running
      await this.stateStore.updateJobStatus(
        jobData.executionId,
        jobData.jobId,
        'running'
      );
      
      // Get job handler
      const handler = this.handlers.get(jobData.jobType);
      if (!handler) {
        throw new Error(`No handler for job type: ${jobData.jobType}`);
      }
      
      // Execute job
      const context: JobContext = {
        jobId: jobData.jobId,
        config: jobData.config,
        dependencyOutputs: jobData.dependencyOutputs,
        logger: {
          log: (message: string) => console.log(`[JOB ${jobData.jobId}] ${message}`),
          error: (message: string) => console.error(`[JOB ${jobData.jobId}] ${message}`),
        },
      };
      
      const output = await handler.execute(context);
      
      // Update job status to completed
      await this.stateStore.updateJobStatus(
        jobData.executionId,
        jobData.jobId,
        'completed',
        output
      );
      
      return {
        success: true,
        output,
        metadata: {
          workerId: this.workerId,
          executionTime: Date.now() - startTime,
          memoryUsed: process.memoryUsage().heapUsed,
        },
      };
    } catch (error) {
      // Update job status to failed
      await this.stateStore.updateJobStatus(
        jobData.executionId,
        jobData.jobId,
        'failed',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
      
      throw error;
    } finally {
      this.activeJobs.delete(jobData.jobId);
    }
  }

  private detectCapabilities(): string[] {
    const capabilities: string[] = ['cpu'];
    
    // Check for GPU (simplified - would need actual GPU detection)
    if (process.env.GPU_ENABLED === 'true') {
      capabilities.push('gpu');
    }
    
    // Check for high memory (>16GB)
    if (os.totalmem() > 16 * 1024 * 1024 * 1024) {
      capabilities.push('high-memory');
    }
    
    return capabilities;
  }
}
```

---

## Deployment Architecture

### Development Setup (Single Machine)

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  orchestrator:
    build: .
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_KEY: ${SUPABASE_KEY}
    ports:
      - "3000:3000"
  
  worker:
    build: .
    command: npm run worker
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
      WORKER_ID: worker-1
      MAX_CONCURRENCY: 4
    deploy:
      replicas: 2
```

### Production Setup (Multi-Machine)

```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer (nginx)                   │
└───────────┬──────────────────────────┬──────────────────────┘
            │                          │
┌───────────▼──────────┐   ┌───────────▼──────────┐
│  Orchestrator 1      │   │  Orchestrator 2      │
│  (API Server)        │   │  (API Server)        │
└───────────┬──────────┘   └───────────┬──────────┘
            │                          │
            └──────────┬───────────────┘
                       │
        ┌──────────────▼──────────────┐
        │   Redis Cluster (HA)        │
        │   • Message Queue           │
        │   • State Store Cache       │
        │   • Worker Registry         │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │   Supabase (PostgreSQL)     │
        │   • Durable State Store     │
        │   • Execution History       │
        └─────────────────────────────┘

┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  Worker Pool 1 │  │  Worker Pool 2 │  │  Worker Pool N │
│  (CPU Workers) │  │ (GPU Workers)  │  │ (High-Mem)     │
│  • 4 workers   │  │  • 2 workers   │  │  • 2 workers   │
└────────────────┘  └────────────────┘  └────────────────┘
```

---

## Performance Considerations

### Scalability Targets

| Metric | Current (Single-Instance) | Target (Distributed) |
|--------|---------------------------|---------------------|
| **Concurrent Jobs** | 10-20 (limited by CPU) | 100+ (horizontal scale) |
| **Jobs/Hour** | 100-200 | 1000+ |
| **Execution Throughput** | 1 workflow at a time | 10+ concurrent workflows |
| **Worker Nodes** | 1 | 10-100 |
| **Failover Time** | N/A (single point of failure) | <30s (automatic job redistribution) |

### Bottlenecks & Mitigation

**1. Redis Performance**
- **Bottleneck**: Redis single-threaded, can become bottleneck at high load
- **Mitigation**: 
  - Use Redis Cluster for horizontal scaling
  - Separate queues for different job priorities
  - Use Redis pipelining for bulk operations
  - Cache frequently accessed data in orchestrator memory

**2. State Store Synchronization**
- **Bottleneck**: Frequent state updates cause lock contention
- **Mitigation**:
  - Batch state updates where possible
  - Use optimistic locking instead of pessimistic
  - Cache execution state in orchestrator with TTL
  - Reduce polling frequency (1s → 5s for completed jobs)

**3. Worker Communication Overhead**
- **Bottleneck**: Network latency for job submission/result retrieval
- **Mitigation**:
  - Batch job submissions to queue
  - Use BullMQ's built-in result caching
  - Workers write results directly to state store
  - Minimize payload size (avoid large outputs in queue)

---

## Migration Strategy

### Phase 1: Add Message Queue (Week 1)
- Install BullMQ + Redis
- Create JobQueue class
- Add queue submission to orchestrator
- Keep local execution as fallback

### Phase 2: Add State Store (Week 1)
- Create StateStore class
- Migrate execution state to Redis
- Keep Supabase as durable backup
- Add distributed locking

### Phase 3: Create Worker Manager (Week 2)
- Implement WorkerManager class
- Add worker registration/heartbeat
- Build worker selection logic
- Add health monitoring

### Phase 4: Build Worker Nodes (Week 2)
- Create DAGWorker class
- Implement job polling
- Add job execution
- Test with local workers

### Phase 5: Integration & Testing (Week 3)
- End-to-end testing with multiple workers
- Failure scenario testing
- Performance benchmarking
- Load testing

### Phase 6: API & Documentation (Week 3-4)
- Add distributed execution endpoints
- Create worker management APIs
- Write deployment guides
- Create monitoring dashboards

---

## Testing Strategy

### Unit Tests
- JobQueue operations (submit, cancel, stats)
- WorkerManager operations (register, heartbeat, select)
- StateStore operations (save, load, lock)
- Worker job execution

### Integration Tests
- Multi-worker job execution
- Worker failure and job redistribution
- Concurrent execution stress tests
- Network partition scenarios

### Performance Tests
- 100 concurrent jobs across 10 workers
- 1000 jobs/hour throughput
- Worker failover latency (<30s)
- State store lock contention under load

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Redis single point of failure | Medium | High | Use Redis Sentinel or Cluster for HA |
| Network partition between orchestrator/workers | Low | High | Job timeout + automatic retry |
| State synchronization bugs (race conditions) | Medium | High | Comprehensive testing of distributed locks |
| Worker resource exhaustion | High | Medium | Worker-level resource limits + health checks |
| Message queue overflow | Low | Medium | Queue size limits + dead letter queue |

---

## Success Metrics

**Week 1-2 (Implementation)**:
- ✅ Message queue integrated (BullMQ + Redis)
- ✅ State store operational (Redis + Supabase)
- ✅ Worker manager functional (registration, heartbeat, selection)

**Week 3 (Integration)**:
- ✅ Worker nodes executing jobs from queue
- ✅ Multi-worker execution working
- ✅ Failure scenarios handled (worker crash, job timeout)

**Week 4 (Production Ready)**:
- ✅ 10+ workers processing jobs simultaneously
- ✅ 100+ concurrent jobs executing
- ✅ <30s failover time on worker crash
- ✅ API endpoints for worker management
- ✅ Comprehensive documentation

---

## Next Steps

1. **Review Design** - Team review of architecture and approach
2. **Set Up Infrastructure** - Redis cluster, worker machines
3. **Implement Phase 2.3.2** - Message queue integration (BullMQ)
4. **Implement Phase 2.3.3** - Worker manager
5. **Continue systematic implementation** - Following task breakdown

**Ready to proceed with implementation?**
