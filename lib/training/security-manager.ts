/**
 * Security Manager for DAG Orchestrator
 * 
 * Provides:
 * - Resource limits enforcement (CPU, memory, time)
 * - Audit logging for sensitive operations
 * - Input validation and sanitization
 * - Job execution monitoring
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Constants
// ============================================================================

const RESOURCE_LIMITS = {
  DEFAULT_MAX_EXECUTION_TIME_MS: 3600000, // 1 hour
  DEFAULT_MAX_MEMORY_MB: 2048, // 2GB
  DEFAULT_MAX_CPU_PERCENT: 80, // 80% CPU
  CRITICAL_MEMORY_THRESHOLD_PERCENT: 90, // 90% of limit
} as const;

const AUDIT_EVENT_TYPES = {
  EXECUTION_START: 'execution.start',
  EXECUTION_COMPLETE: 'execution.complete',
  EXECUTION_FAILED: 'execution.failed',
  EXECUTION_CANCELLED: 'execution.cancelled',
  JOB_START: 'job.start',
  JOB_COMPLETE: 'job.complete',
  JOB_FAILED: 'job.failed',
  JOB_TIMEOUT: 'job.timeout',
  JOB_MEMORY_LIMIT: 'job.memory_limit',
  RESOURCE_VIOLATION: 'resource.violation',
  SECURITY_VIOLATION: 'security.violation',
  CONFIG_CHANGE: 'config.change',
} as const;

const LOG_LEVELS = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

// ============================================================================
// Types
// ============================================================================

export interface ResourceLimits {
  maxExecutionTimeMs?: number;
  maxMemoryMB?: number;
  maxCpuPercent?: number;
  enforceMemoryLimit?: boolean;
  enforceCpuLimit?: boolean;
  enforceTimeLimit?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  eventType: string;
  level: string;
  executionId?: string;
  jobId?: string;
  userId?: string;
  details: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ResourceUsage {
  memoryMB: number;
  cpuPercent: number;
  executionTimeMs: number;
  timestamp: Date;
}

export interface SecurityViolation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  executionId?: string;
  jobId?: string;
  details: Record<string, unknown>;
}

// ============================================================================
// Security Manager Class
// ============================================================================

export class SecurityManager {
  private supabaseUrl: string | null;
  private supabaseKey: string | null;
  private resourceMonitors: Map<string, NodeJS.Timeout>;
  private violations: SecurityViolation[];

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabaseUrl = supabaseUrl || null;
    this.supabaseKey = supabaseKey || null;
    this.resourceMonitors = new Map();
    this.violations = [];

    console.log('[SecurityManager] Initialized', {
      hasSupabase: !!(this.supabaseUrl && this.supabaseKey),
      resourceMonitorsActive: 0,
    });
  }

  // ==========================================================================
  // Resource Limits Enforcement
  // ==========================================================================

  /**
   * Validate resource limits configuration
   */
  validateResourceLimits(limits: ResourceLimits): { valid: boolean; errors: string[] } {
    console.log('[SecurityManager] Validating resource limits:', limits);
    const errors: string[] = [];

    if (limits.maxExecutionTimeMs !== undefined) {
      if (limits.maxExecutionTimeMs <= 0) {
        errors.push('maxExecutionTimeMs must be positive');
      }
      if (limits.maxExecutionTimeMs > 86400000) { // 24 hours
        errors.push('maxExecutionTimeMs cannot exceed 24 hours');
      }
    }

    if (limits.maxMemoryMB !== undefined) {
      if (limits.maxMemoryMB <= 0) {
        errors.push('maxMemoryMB must be positive');
      }
      if (limits.maxMemoryMB > 32768) { // 32GB
        errors.push('maxMemoryMB cannot exceed 32GB');
      }
    }

    if (limits.maxCpuPercent !== undefined) {
      if (limits.maxCpuPercent <= 0 || limits.maxCpuPercent > 100) {
        errors.push('maxCpuPercent must be between 0 and 100');
      }
    }

    const valid = errors.length === 0;
    console.log('[SecurityManager] Validation result:', { valid, errorCount: errors.length });

    return { valid, errors };
  }

  /**
   * Get effective resource limits (with defaults)
   */
  getEffectiveResourceLimits(limits?: ResourceLimits): Required<ResourceLimits> {
    return {
      maxExecutionTimeMs: limits?.maxExecutionTimeMs ?? RESOURCE_LIMITS.DEFAULT_MAX_EXECUTION_TIME_MS,
      maxMemoryMB: limits?.maxMemoryMB ?? RESOURCE_LIMITS.DEFAULT_MAX_MEMORY_MB,
      maxCpuPercent: limits?.maxCpuPercent ?? RESOURCE_LIMITS.DEFAULT_MAX_CPU_PERCENT,
      enforceMemoryLimit: limits?.enforceMemoryLimit ?? true,
      enforceCpuLimit: limits?.enforceCpuLimit ?? true,
      enforceTimeLimit: limits?.enforceTimeLimit ?? true,
    };
  }

  /**
   * Check if resource usage exceeds limits
   */
  checkResourceViolation(
    usage: ResourceUsage,
    limits: ResourceLimits,
    executionId: string,
    jobId?: string
  ): SecurityViolation | null {
    const effectiveLimits = this.getEffectiveResourceLimits(limits);

    // Check memory limit
    if (effectiveLimits.enforceMemoryLimit && usage.memoryMB > effectiveLimits.maxMemoryMB) {
      const violation: SecurityViolation = {
        type: 'memory_limit_exceeded',
        severity: 'high',
        message: `Memory usage (${usage.memoryMB}MB) exceeds limit (${effectiveLimits.maxMemoryMB}MB)`,
        timestamp: new Date(),
        executionId,
        jobId,
        details: {
          currentMemoryMB: usage.memoryMB,
          limitMemoryMB: effectiveLimits.maxMemoryMB,
          percentUsed: (usage.memoryMB / effectiveLimits.maxMemoryMB) * 100,
        },
      };

      console.error('[SecurityManager] Memory limit violation:', violation);
      this.violations.push(violation);
      return violation;
    }

    // Check CPU limit
    if (effectiveLimits.enforceCpuLimit && usage.cpuPercent > effectiveLimits.maxCpuPercent) {
      const violation: SecurityViolation = {
        type: 'cpu_limit_exceeded',
        severity: 'medium',
        message: `CPU usage (${usage.cpuPercent}%) exceeds limit (${effectiveLimits.maxCpuPercent}%)`,
        timestamp: new Date(),
        executionId,
        jobId,
        details: {
          currentCpuPercent: usage.cpuPercent,
          limitCpuPercent: effectiveLimits.maxCpuPercent,
        },
      };

      console.warn('[SecurityManager] CPU limit violation:', violation);
      this.violations.push(violation);
      return violation;
    }

    // Check execution time limit
    if (effectiveLimits.enforceTimeLimit && usage.executionTimeMs > effectiveLimits.maxExecutionTimeMs) {
      const violation: SecurityViolation = {
        type: 'time_limit_exceeded',
        severity: 'high',
        message: `Execution time (${usage.executionTimeMs}ms) exceeds limit (${effectiveLimits.maxExecutionTimeMs}ms)`,
        timestamp: new Date(),
        executionId,
        jobId,
        details: {
          currentExecutionTimeMs: usage.executionTimeMs,
          limitExecutionTimeMs: effectiveLimits.maxExecutionTimeMs,
        },
      };

      console.error('[SecurityManager] Time limit violation:', violation);
      this.violations.push(violation);
      return violation;
    }

    return null;
  }

  /**
   * Start monitoring resource usage for an execution
   */
  startResourceMonitoring(
    executionId: string,
    limits: ResourceLimits,
    onViolation: (violation: SecurityViolation) => void
  ): void {
    console.log('[SecurityManager] Starting resource monitoring for execution:', executionId);

    // Clear any existing monitor
    this.stopResourceMonitoring(executionId);

    const startTime = Date.now();
    const monitorInterval = 5000; // Check every 5 seconds

    const interval = setInterval(() => {
      const usage: ResourceUsage = {
        memoryMB: process.memoryUsage().heapUsed / (1024 * 1024),
        cpuPercent: process.cpuUsage().user / 10000, // Approximate
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date(),
      };

      console.log('[SecurityManager] Resource usage:', {
        executionId,
        memoryMB: Math.round(usage.memoryMB),
        cpuPercent: Math.round(usage.cpuPercent),
        executionTimeMs: usage.executionTimeMs,
      });

      const violation = this.checkResourceViolation(usage, limits, executionId);
      if (violation) {
        onViolation(violation);
      }
    }, monitorInterval);

    this.resourceMonitors.set(executionId, interval);
    console.log('[SecurityManager] Resource monitor started for:', executionId);
  }

  /**
   * Stop monitoring resource usage
   */
  stopResourceMonitoring(executionId: string): void {
    const interval = this.resourceMonitors.get(executionId);
    if (interval) {
      clearInterval(interval);
      this.resourceMonitors.delete(executionId);
      console.log('[SecurityManager] Resource monitor stopped for:', executionId);
    }
  }

  // ==========================================================================
  // Audit Logging
  // ==========================================================================

  /**
   * Log an audit event
   */
  async logAuditEvent(
    eventType: string,
    level: string,
    details: Record<string, unknown>,
    executionId?: string,
    jobId?: string,
    userId?: string
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      eventType,
      level,
      executionId,
      jobId,
      userId,
      details,
    };

    console.log(`[SecurityManager] [AUDIT] [${level.toUpperCase()}] ${eventType}:`, {
      executionId,
      jobId,
      userId,
      details,
    });

    // Store in Supabase if configured
    if (this.supabaseUrl && this.supabaseKey) {
      try {
        const supabase = createClient(this.supabaseUrl, this.supabaseKey);
        
        const { error } = await supabase.from('dag_audit_logs').insert({
          id: entry.id,
          timestamp: entry.timestamp.toISOString(),
          event_type: entry.eventType,
          level: entry.level,
          execution_id: entry.executionId,
          job_id: entry.jobId,
          user_id: entry.userId,
          details: entry.details,
        });

        if (error) {
          console.error('[SecurityManager] Failed to store audit log:', error);
        } else {
          console.log('[SecurityManager] Audit log stored:', entry.id);
        }
      } catch (error) {
        console.error('[SecurityManager] Error storing audit log:', error);
      }
    }
  }

  /**
   * Log execution start
   */
  async logExecutionStart(executionId: string, name: string, userId?: string): Promise<void> {
    await this.logAuditEvent(
      AUDIT_EVENT_TYPES.EXECUTION_START,
      LOG_LEVELS.INFO,
      { name, startTime: new Date().toISOString() },
      executionId,
      undefined,
      userId
    );
  }

  /**
   * Log execution completion
   */
  async logExecutionComplete(
    executionId: string,
    duration: number,
    totalJobs: number,
    completedJobs: number,
    failedJobs: number
  ): Promise<void> {
    await this.logAuditEvent(
      AUDIT_EVENT_TYPES.EXECUTION_COMPLETE,
      LOG_LEVELS.INFO,
      { duration, totalJobs, completedJobs, failedJobs },
      executionId
    );
  }

  /**
   * Log execution failure
   */
  async logExecutionFailed(executionId: string, error: string): Promise<void> {
    await this.logAuditEvent(
      AUDIT_EVENT_TYPES.EXECUTION_FAILED,
      LOG_LEVELS.ERROR,
      { error },
      executionId
    );
  }

  /**
   * Log job timeout
   */
  async logJobTimeout(executionId: string, jobId: string, timeoutMs: number): Promise<void> {
    await this.logAuditEvent(
      AUDIT_EVENT_TYPES.JOB_TIMEOUT,
      LOG_LEVELS.WARN,
      { timeoutMs },
      executionId,
      jobId
    );
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(violation: SecurityViolation): Promise<void> {
    await this.logAuditEvent(
      AUDIT_EVENT_TYPES.SECURITY_VIOLATION,
      LOG_LEVELS.CRITICAL,
      {
        violationType: violation.type,
        severity: violation.severity,
        message: violation.message,
        details: violation.details,
      },
      violation.executionId,
      violation.jobId
    );
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  /**
   * Get all recorded violations
   */
  getViolations(): SecurityViolation[] {
    return [...this.violations];
  }

  /**
   * Get violations for a specific execution
   */
  getExecutionViolations(executionId: string): SecurityViolation[] {
    return this.violations.filter((v) => v.executionId === executionId);
  }

  /**
   * Clear violations
   */
  clearViolations(): void {
    console.log('[SecurityManager] Clearing violations, count:', this.violations.length);
    this.violations = [];
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clean up all resources
   */
  cleanup(): void {
    console.log('[SecurityManager] Cleaning up resources');
    
    // Stop all resource monitors
    for (const [executionId, interval] of this.resourceMonitors.entries()) {
      clearInterval(interval);
      console.log('[SecurityManager] Stopped monitor for:', executionId);
    }
    
    this.resourceMonitors.clear();
    console.log('[SecurityManager] Cleanup complete');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let securityManagerInstance: SecurityManager | null = null;

export function getSecurityManager(
  supabaseUrl?: string,
  supabaseKey?: string
): SecurityManager {
  if (!securityManagerInstance) {
    securityManagerInstance = new SecurityManager(supabaseUrl, supabaseKey);
    console.log('[SecurityManager] Singleton instance created');
  }
  return securityManagerInstance;
}

export function resetSecurityManager(): void {
  if (securityManagerInstance) {
    securityManagerInstance.cleanup();
    securityManagerInstance = null;
    console.log('[SecurityManager] Singleton instance reset');
  }
}
