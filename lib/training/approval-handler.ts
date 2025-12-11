/**
 * Phase 2.4: Approval Handler
 * 
 * Job handler for approval gates in DAG workflows.
 * Integrates with ApprovalManager to pause execution until manual approval.
 */

import { JobHandler, JobContext, JobResult } from './types/job-types';
import {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalJobConfig,
  ApprovalResult,
  TimeoutAction,
  NotificationChannel,
} from './types/approval-types';
import { getApprovalManager } from './approval-manager';

export class ApprovalHandler implements JobHandler {
  type = 'approval';
  
  private pollInterval: number;
  private maxPollAttempts: number;

  constructor(config: { pollInterval?: number; maxPollAttempts?: number } = {}) {
    // Get configuration from environment or use provided values or defaults
    this.pollInterval = config.pollInterval || 
                        parseInt(process.env.APPROVAL_POLL_INTERVAL_MS || '5000', 10);
    this.maxPollAttempts = config.maxPollAttempts || 720; // 1 hour at 5s intervals
    
    const totalTimeoutMinutes = (this.maxPollAttempts * this.pollInterval) / 60000;
    console.log(`[ApprovalHandler] Config: ${this.maxPollAttempts} attempts × ${this.pollInterval}ms = ${totalTimeoutMinutes.toFixed(1)} minutes timeout`);
  }

  /**
   * Execute approval job - create approval request and wait for decision
   */
  async execute(context: JobContext): Promise<JobResult> {
    const config = context.config as unknown as ApprovalJobConfig;
    
    // Validate required fields
    if (!config.title) {
      return {
        success: false,
        error: 'Approval title is required',
      };
    }

    if (!config.notifyUsers || config.notifyUsers.length === 0) {
      return {
        success: false,
        error: 'At least one user to notify is required',
      };
    }

    try {
      // Create approval request
      const approvalManager = getApprovalManager();
      const request = await approvalManager.createRequest({
        workflowId: context.workflowId,
        jobId: context.jobId,
        executionId: context.executionId || `exec_${Date.now()}`,
        title: config.title,
        description: config.description,
        context: this.buildApprovalContext(context, config),
        requestedBy: config.requestedBy || 'system',
        timeoutMs: config.timeoutMs,
        timeoutAction: config.timeoutAction || TimeoutAction.REJECT,
        notifyUsers: config.notifyUsers,
        notifyChannels: config.notifyChannels || [NotificationChannel.IN_APP],
        notifyRoles: config.notifyRoles,
        requireMinApprovers: config.requireMinApprovers || 1,
        allowedApprovers: config.allowedApprovers,
        requireAllApprovers: config.requireAllApprovers || false,
        escalateToUsers: config.escalateToUsers,
        metadata: {
          jobType: context.type,
          workflowName: context.workflowId,
          autoApproveConditions: config.autoApproveConditions,
          ...config.metadata,
        },
      });

      console.log(`Approval request created: ${request.id}`);

      // Check for auto-approval conditions
      if (config.autoApproveConditions && config.autoApproveConditions.length > 0) {
        const shouldAutoApprove = this.checkAutoApprovalConditions(
          config.autoApproveConditions,
          context
        );
        
        if (shouldAutoApprove) {
          console.log('Auto-approval conditions met, approving automatically');
          await approvalManager.approve(request.id, {
            userId: 'system',
            comment: 'Auto-approved based on configured conditions',
          });
          
          return {
            success: true,
            output: {
              approvalId: request.id,
              status: ApprovalStatus.APPROVED,
              decision: 'approved',
              autoApproved: true,
            },
          };
        }
      }

      // Wait for approval decision
      const result = await this.waitForDecision(request.id);

      return {
        success: result.approved,
        output: {
          approvalId: request.id,
          status: result.status,
          decision: result.decision,
          decidedBy: result.decidedBy,
          comment: result.comment,
          reason: result.reason,
        },
        error: result.approved ? undefined : result.reason || 'Approval request was rejected',
      };
    } catch (error) {
      console.error('Error in approval handler:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in approval handler',
      };
    }
  }

  /**
   * Wait for approval decision by polling
   */
  private async waitForDecision(requestId: string): Promise<ApprovalResult> {
    const approvalManager = getApprovalManager();
    let attempts = 0;

    while (attempts < this.maxPollAttempts) {
      // Get current request
      const request = await approvalManager.getRequest(requestId);
      
      if (!request) {
        return {
          approved: false,
          status: ApprovalStatus.REJECTED,
          reason: 'Approval request not found',
        };
      }

      // Check if decided
      if (request.status !== ApprovalStatus.PENDING) {
        return this.mapToApprovalResult(request);
      }

      // Check if expired
      if (new Date() > new Date(request.expiresAt)) {
        // Timeout will be handled by ApprovalManager's background checker
        // Wait a bit for it to process
        await this.sleep(this.pollInterval);
        
        // Re-fetch to get updated status
        const updatedRequest = await approvalManager.getRequest(requestId);
        if (updatedRequest) {
          return this.mapToApprovalResult(updatedRequest);
        }
      }

      // Wait before next poll
      await this.sleep(this.pollInterval);
      attempts++;
    }

    // Max attempts reached
    return {
      approved: false,
      status: ApprovalStatus.TIMEOUT,
      reason: 'Maximum polling attempts reached',
    };
  }

  /**
   * Check if auto-approval conditions are met
   */
  private checkAutoApprovalConditions(
    conditions: Array<{ field: string; operator: string; value: unknown }>,
    context: JobContext
  ): boolean {
    // All conditions must be true for auto-approval
    return conditions.every((condition) => {
      const fieldValue = this.getFieldValue(context, condition.field);
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });
  }

  /**
   * Get field value from context using dot notation
   */
  private getFieldValue(context: JobContext, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(
    fieldValue: unknown,
    operator: string,
    conditionValue: unknown
  ): boolean {
    switch (operator) {
      case '==':
      case 'equals':
        return fieldValue === conditionValue;
      case '!=':
      case 'notEquals':
        return fieldValue !== conditionValue;
      case '>':
      case 'greaterThan':
        return typeof fieldValue === 'number' &&
               typeof conditionValue === 'number' &&
               fieldValue > conditionValue;
      case '>=':
      case 'greaterThanOrEquals':
        return typeof fieldValue === 'number' &&
               typeof conditionValue === 'number' &&
               fieldValue >= conditionValue;
      case '<':
      case 'lessThan':
        return typeof fieldValue === 'number' &&
               typeof conditionValue === 'number' &&
               fieldValue < conditionValue;
      case '<=':
      case 'lessThanOrEquals':
        return typeof fieldValue === 'number' &&
               typeof conditionValue === 'number' &&
               fieldValue <= conditionValue;
      case 'contains':
        return typeof fieldValue === 'string' &&
               typeof conditionValue === 'string' &&
               fieldValue.includes(conditionValue);
      case 'startsWith':
        return typeof fieldValue === 'string' &&
               typeof conditionValue === 'string' &&
               fieldValue.startsWith(conditionValue);
      case 'endsWith':
        return typeof fieldValue === 'string' &&
               typeof conditionValue === 'string' &&
               fieldValue.endsWith(conditionValue);
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case 'notIn':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Build approval context from job context
   */
  private buildApprovalContext(
    context: JobContext,
    config: ApprovalJobConfig
  ): Record<string, unknown> {
    return {
      workflowId: context.workflowId,
      jobId: context.jobId,
      jobType: context.type,
      executionId: context.executionId,
      parentJobId: context.parentJobId,
      dependencies: context.dependencies,
      previousResults: context.previousResults,
      approvalTitle: config.title,
      approvalDescription: config.description,
      customContext: config.context || {},
    };
  }

  /**
   * Map ApprovalRequest to ApprovalResult
   */
  private mapToApprovalResult(request: ApprovalRequest): ApprovalResult {
    const approved = request.status === ApprovalStatus.APPROVED;

    return {
      approved,
      status: request.status,
      decision: request.decision,
      decidedBy: request.decidedBy,
      decidedAt: request.decidedAt,
      comment: request.comment,
      reason: request.reason,
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate job configuration
   */
  validate(inputConfig: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const config = inputConfig as unknown as ApprovalJobConfig;
    const errors: string[] = [];

    if (!config.title) {
      errors.push('title is required');
    }

    if (!config.notifyUsers || config.notifyUsers.length === 0) {
      errors.push('notifyUsers must contain at least one user');
    }

    if (config.timeoutMs && config.timeoutMs < 0) {
      errors.push('timeoutMs must be positive');
    }

    if (config.requireMinApprovers && config.requireMinApprovers < 1) {
      errors.push('requireMinApprovers must be at least 1');
    }

    if (
      config.allowedApprovers &&
      config.requireMinApprovers &&
      config.allowedApprovers.length < config.requireMinApprovers
    ) {
      errors.push('allowedApprovers must have at least requireMinApprovers users');
    }

    if (config.autoApproveConditions) {
      config.autoApproveConditions.forEach((condition, index) => {
        if (!condition.field) {
          errors.push(`autoApproveConditions[${index}].field is required`);
        }
        if (!condition.operator) {
          errors.push(`autoApproveConditions[${index}].operator is required`);
        }
        if (condition.value === undefined) {
          errors.push(`autoApproveConditions[${index}].value is required`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get job status
   */
  async getStatus(jobId: string, executionId: string): Promise<{
    status: string;
    progress?: number;
    message?: string;
  }> {
    try {
      const approvalManager = getApprovalManager();
      const approvals = await approvalManager.getApprovals({
        jobId,
        executionId,
        limit: 1,
      });

      if (approvals.length === 0) {
        return { status: 'unknown', message: 'Approval request not found' };
      }

      const request = approvals[0];
      const timeRemaining = new Date(request.expiresAt).getTime() - Date.now();
      const progress = Math.max(
        0,
        Math.min(100, ((request.timeoutMs - timeRemaining) / request.timeoutMs) * 100)
      );

      return {
        status: request.status,
        progress: Math.round(progress),
        message: this.getStatusMessage(request),
      };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get human-readable status message
   */
  private getStatusMessage(request: ApprovalRequest): string {
    const timeRemaining = new Date(request.expiresAt).getTime() - Date.now();
    const minutesRemaining = Math.ceil(timeRemaining / 60000);

    switch (request.status) {
      case ApprovalStatus.PENDING:
        if (minutesRemaining < 1) {
          return 'Expiring soon';
        } else if (minutesRemaining < 15) {
          return `Urgent: ${minutesRemaining} minutes remaining`;
        } else {
          return `Waiting for approval (${minutesRemaining} minutes remaining)`;
        }
      case ApprovalStatus.APPROVED:
        return `Approved by ${request.decidedBy}`;
      case ApprovalStatus.REJECTED:
        return `Rejected by ${request.decidedBy}${request.reason ? `: ${request.reason}` : ''}`;
      case ApprovalStatus.TIMEOUT:
        return 'Timed out';
      case ApprovalStatus.ESCALATED:
        return `Escalated (level ${request.escalationLevel})`;
      case ApprovalStatus.CANCELLED:
        return 'Cancelled';
      default:
        return request.status;
    }
  }

  /**
   * Cancel approval job
   */
  async cancel(jobId: string, executionId: string, reason: string): Promise<void> {
    const approvalManager = getApprovalManager();
    const approvals = await approvalManager.getApprovals({
      jobId,
      executionId,
      status: ApprovalStatus.PENDING,
      limit: 1,
    });

    if (approvals.length > 0) {
      await approvalManager.cancel(approvals[0].id, 'system', reason);
    }
  }
}

// Export singleton instance
let approvalHandlerInstance: ApprovalHandler | null = null;

export function getApprovalHandler(
  config?: { pollInterval?: number; maxPollAttempts?: number }
): ApprovalHandler {
  if (!approvalHandlerInstance) {
    approvalHandlerInstance = new ApprovalHandler(config);
  }
  return approvalHandlerInstance;
}
