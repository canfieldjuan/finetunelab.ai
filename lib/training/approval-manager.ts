/**
 * Phase 2.4: Approval Manager
 * 
 * Centralized approval state management for Human-in-the-Loop workflows.
 * Handles creation, querying, decision recording, and timeout management.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ApprovalRequest,
  ApprovalRequestInput,
  ApprovalDecision,
  ApprovalRequestFilters,
  ApprovalStatus,
  TimeoutAction,
  ApprovalStats,
  UserApprovalSummary,
  AuditLogInput,
  ApprovalAction,
  ApprovalManagerConfig,
  NotificationChannel,
} from './types/approval-types';
import { MultiChannelNotificationService, APPROVAL_TEMPLATES } from './notification-service';

export class ApprovalManager {
  private supabase: SupabaseClient;
  private timeoutCheckInterval: number;
  private timeoutCheckTimer?: NodeJS.Timeout;
  private notificationService?: MultiChannelNotificationService;
  private enableAuditLog: boolean;
  private defaultTimeoutMs: number;
  private defaultTimeoutAction: TimeoutAction;

  constructor(config: ApprovalManagerConfig = {}) {
    // Initialize Supabase client
    if (config.supabase) {
      this.supabase = config.supabase as SupabaseClient;
    } else {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
      }
      
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    // Configuration with environment variable fallbacks
    this.timeoutCheckInterval = config.timeoutCheckInterval || 
                                parseInt(process.env.APPROVAL_CHECK_INTERVAL_MS || '60000', 10);
    this.notificationService = config.notificationService as MultiChannelNotificationService;
    this.enableAuditLog = config.enableAuditLog ?? true;
    this.defaultTimeoutMs = config.defaultTimeoutMs || 
                           parseInt(process.env.APPROVAL_DEFAULT_TIMEOUT_MS || '3600000', 10);
    this.defaultTimeoutAction = config.defaultTimeoutAction || TimeoutAction.REJECT;
    
    console.log(`[ApprovalManager] Config: timeout check every ${this.timeoutCheckInterval}ms, default timeout ${this.defaultTimeoutMs}ms`);
  }

  /**
   * Start background timeout checker
   */
  startTimeoutChecker(): void {
    if (this.timeoutCheckTimer) {
      return; // Already running
    }

    this.timeoutCheckTimer = setInterval(() => {
      this.checkTimeouts().catch((error) => {
        console.error('Error checking timeouts:', error);
      });
    }, this.timeoutCheckInterval);

    console.log('Approval timeout checker started');
  }

  /**
   * Stop background timeout checker
   */
  stopTimeoutChecker(): void {
    if (this.timeoutCheckTimer) {
      clearInterval(this.timeoutCheckTimer);
      this.timeoutCheckTimer = undefined;
      console.log('Approval timeout checker stopped');
    }
  }

  /**
   * Create a new approval request
   */
  async createRequest(input: ApprovalRequestInput): Promise<ApprovalRequest> {
    const expiresAt = new Date(Date.now() + (input.timeoutMs || this.defaultTimeoutMs));

    const { data, error } = await this.supabase
      .from('approval_requests')
      .insert({
        workflow_id: input.workflowId,
        job_id: input.jobId,
        execution_id: input.executionId,
        title: input.title,
        description: input.description,
        context: input.context || {},
        requested_by: input.requestedBy,
        timeout_ms: input.timeoutMs || this.defaultTimeoutMs,
        expires_at: expiresAt.toISOString(),
        timeout_action: input.timeoutAction || this.defaultTimeoutAction,
        notify_users: input.notifyUsers,
        notify_channels: input.notifyChannels || [NotificationChannel.IN_APP],
        notify_roles: input.notifyRoles || [],
        require_min_approvers: input.requireMinApprovers || 1,
        allowed_approvers: input.allowedApprovers || null,
        require_all_approvers: input.requireAllApprovers || false,
        escalate_to_users: input.escalateToUsers || null,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create approval request: ${error.message}`);
    }

    const request = this.mapToApprovalRequest(data);

    // Log creation
    if (this.enableAuditLog) {
      await this.logAction({
        approvalRequestId: request.id,
        action: ApprovalAction.CREATED,
        userId: input.requestedBy,
        newStatus: ApprovalStatus.PENDING,
        metadata: { input },
      });
    }

    // Send notifications (if notification service is configured)
    if (this.notificationService) {
      try {
        const template = this.getNotificationTemplate(request);
        await this.notificationService.sendApprovalNotification(request, template);
        console.log(`Notifications sent for approval ${request.id}`);
      } catch (error) {
        console.error('Failed to send notifications:', error);
        // Don't fail the approval creation if notifications fail
      }
    }

    return request;
  }

  /**
   * Get appropriate notification template based on urgency
   */
  private getNotificationTemplate(request: ApprovalRequest) {
    const timeUntilExpiry = new Date(request.expiresAt).getTime() - Date.now();
    const isUrgent = timeUntilExpiry < 15 * 60 * 1000; // < 15 minutes

    if (isUrgent) {
      return APPROVAL_TEMPLATES.approvalUrgent;
    }
    return APPROVAL_TEMPLATES.approvalRequired;
  }

  /**
   * Get a single approval request by ID
   */
  async getRequest(requestId: string): Promise<ApprovalRequest | null> {
    const { data, error } = await this.supabase
      .from('approval_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get approval request: ${error.message}`);
    }

    return this.mapToApprovalRequest(data);
  }

  /**
   * Get pending approval requests
   */
  async getPendingApprovals(
    filters: ApprovalRequestFilters = {}
  ): Promise<ApprovalRequest[]> {
    let query = this.supabase
      .from('approval_requests')
      .select('*')
      .eq('status', ApprovalStatus.PENDING)
      .gt('expires_at', new Date().toISOString());

    // Apply filters
    if (filters.workflowId) {
      query = query.eq('workflow_id', filters.workflowId);
    }
    if (filters.jobId) {
      query = query.eq('job_id', filters.jobId);
    }
    if (filters.requestedBy) {
      query = query.eq('requested_by', filters.requestedBy);
    }
    if (filters.userId) {
      // Filter by notify_users or allowed_approvers
      query = query.or(
        `notify_users.cs.{${filters.userId}},allowed_approvers.cs.{${filters.userId}}`
      );
    }

    // Pagination
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    // Order by expiry time (most urgent first)
    query = query.order('expires_at', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get pending approvals: ${error.message}`);
    }

    return data.map(this.mapToApprovalRequest);
  }

  /**
   * Get all approval requests with filters
   */
  async getApprovals(filters: ApprovalRequestFilters = {}): Promise<ApprovalRequest[]> {
    let query = this.supabase.from('approval_requests').select('*');

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.workflowId) {
      query = query.eq('workflow_id', filters.workflowId);
    }
    if (filters.jobId) {
      query = query.eq('job_id', filters.jobId);
    }
    if (filters.requestedBy) {
      query = query.eq('requested_by', filters.requestedBy);
    }
    if (filters.decidedBy) {
      query = query.eq('decided_by', filters.decidedBy);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    // Pagination
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    // Order by created_at descending (most recent first)
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get approvals: ${error.message}`);
    }

    return data.map(this.mapToApprovalRequest);
  }

  /**
   * Approve an approval request
   */
  async approve(requestId: string, decision: Omit<ApprovalDecision, 'requestId'>): Promise<void> {
    // Get current request
    const request = await this.getRequest(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    // Check if already decided
    if (request.status !== ApprovalStatus.PENDING) {
      throw new Error(`Approval request already ${request.status}`);
    }

    // Check if expired
    if (new Date() > new Date(request.expiresAt)) {
      throw new Error('Approval request has expired');
    }

    // Check if user is allowed to approve
    if (request.allowedApprovers && request.allowedApprovers.length > 0) {
      if (!request.allowedApprovers.includes(decision.userId)) {
        throw new Error('User not authorized to approve this request');
      }
    }

    // Add approver to list
    const approvers = [...request.approvers, decision.userId];

    // Check if minimum approvers met
    const isFullyApproved = approvers.length >= request.requireMinApprovers;

    // Update request
    const updates: Record<string, unknown> = {
      approvers,
      comment: decision.comment,
    };

    if (isFullyApproved) {
      updates.status = ApprovalStatus.APPROVED;
      updates.decided_by = decision.userId;
      updates.decided_at = new Date().toISOString();
      updates.decision = 'approved';
    }

    const { error } = await this.supabase
      .from('approval_requests')
      .update(updates)
      .eq('id', requestId);

    if (error) {
      throw new Error(`Failed to approve request: ${error.message}`);
    }

    // Log action
    if (this.enableAuditLog) {
      await this.logAction({
        approvalRequestId: requestId,
        action: ApprovalAction.APPROVED,
        userId: decision.userId,
        oldStatus: ApprovalStatus.PENDING,
        newStatus: isFullyApproved ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
        comment: decision.comment,
        metadata: { decision, approverCount: approvers.length },
      });
    }
  }

  /**
   * Reject an approval request
   */
  async reject(requestId: string, decision: Omit<ApprovalDecision, 'requestId'>): Promise<void> {
    // Get current request
    const request = await this.getRequest(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    // Check if already decided
    if (request.status !== ApprovalStatus.PENDING) {
      throw new Error(`Approval request already ${request.status}`);
    }

    // Check if expired
    if (new Date() > new Date(request.expiresAt)) {
      throw new Error('Approval request has expired');
    }

    // Check if user is allowed to reject
    if (request.allowedApprovers && request.allowedApprovers.length > 0) {
      if (!request.allowedApprovers.includes(decision.userId)) {
        throw new Error('User not authorized to reject this request');
      }
    }

    // Update request
    const { error } = await this.supabase
      .from('approval_requests')
      .update({
        status: ApprovalStatus.REJECTED,
        decided_by: decision.userId,
        decided_at: new Date().toISOString(),
        decision: 'rejected',
        reason: decision.reason,
        comment: decision.comment,
      })
      .eq('id', requestId);

    if (error) {
      throw new Error(`Failed to reject request: ${error.message}`);
    }

    // Log action
    if (this.enableAuditLog) {
      await this.logAction({
        approvalRequestId: requestId,
        action: ApprovalAction.REJECTED,
        userId: decision.userId,
        oldStatus: ApprovalStatus.PENDING,
        newStatus: ApprovalStatus.REJECTED,
        comment: decision.comment,
        metadata: { decision },
      });
    }
  }

  /**
   * Cancel an approval request
   */
  async cancel(requestId: string, userId: string, reason: string): Promise<void> {
    const request = await this.getRequest(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.status !== ApprovalStatus.PENDING) {
      throw new Error(`Cannot cancel approval request with status ${request.status}`);
    }

    const { error } = await this.supabase
      .from('approval_requests')
      .update({
        status: ApprovalStatus.CANCELLED,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        reason,
      })
      .eq('id', requestId);

    if (error) {
      throw new Error(`Failed to cancel request: ${error.message}`);
    }

    // Log action
    if (this.enableAuditLog) {
      await this.logAction({
        approvalRequestId: requestId,
        action: ApprovalAction.CANCELLED,
        userId,
        oldStatus: ApprovalStatus.PENDING,
        newStatus: ApprovalStatus.CANCELLED,
        comment: reason,
      });
    }
  }

  /**
   * Check and handle timed out approvals
   */
  async checkTimeouts(): Promise<void> {
    // Get all pending approvals that have expired
    const { data, error } = await this.supabase
      .from('approval_requests')
      .select('*')
      .eq('status', ApprovalStatus.PENDING)
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error checking timeouts:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }

    console.log(`Found ${data.length} timed out approval(s)`);

    // Handle each timeout
    for (const item of data) {
      const request = this.mapToApprovalRequest(item);
      await this.handleTimeout(request);
    }
  }

  /**
   * Handle a single timeout
   */
  private async handleTimeout(request: ApprovalRequest): Promise<void> {
    console.log(`Handling timeout for approval ${request.id}, action: ${request.timeoutAction}`);

    let newStatus: ApprovalStatus;
    let decision: 'approved' | 'rejected' | undefined;

    switch (request.timeoutAction) {
      case TimeoutAction.APPROVE:
        newStatus = ApprovalStatus.APPROVED;
        decision = 'approved';
        break;
      case TimeoutAction.REJECT:
        newStatus = ApprovalStatus.REJECTED;
        decision = 'rejected';
        break;
      case TimeoutAction.ESCALATE:
        newStatus = ApprovalStatus.ESCALATED;
        // In future: send escalation notifications
        break;
      default:
        newStatus = ApprovalStatus.TIMEOUT;
    }

    const { error } = await this.supabase
      .from('approval_requests')
      .update({
        status: newStatus,
        decided_by: 'system',
        decided_at: new Date().toISOString(),
        decision,
        reason: 'Automatic timeout',
      })
      .eq('id', request.id);

    if (error) {
      console.error(`Failed to update timeout for ${request.id}:`, error);
      return;
    }

    // Log timeout action
    if (this.enableAuditLog) {
      await this.logAction({
        approvalRequestId: request.id,
        action: ApprovalAction.TIMEOUT,
        userId: 'system',
        oldStatus: ApprovalStatus.PENDING,
        newStatus,
        comment: `Timed out after ${request.timeoutMs}ms, action: ${request.timeoutAction}`,
      });
    }
  }

  /**
   * Get approval statistics
   */
  async getStats(startDate?: Date, endDate?: Date): Promise<ApprovalStats> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate || new Date();

    const { data, error } = await this.supabase.rpc('get_approval_statistics', {
      p_start_date: start.toISOString(),
      p_end_date: end.toISOString(),
    });

    if (error) {
      throw new Error(`Failed to get approval statistics: ${error.message}`);
    }

    const stats = data[0];
    
    return {
      total: parseInt(stats.total_requests) || 0,
      pending: parseInt(stats.pending_count) || 0,
      approved: parseInt(stats.approved_count) || 0,
      rejected: parseInt(stats.rejected_count) || 0,
      timeout: parseInt(stats.timeout_count) || 0,
      escalated: 0, // Will be calculated separately
      cancelled: 0, // Will be calculated separately
      avgDecisionTimeMs: this.parseInterval(stats.avg_decision_time),
      avgTimeoutMs: parseFloat(stats.avg_timeout_ms) || 0,
    };
  }

  /**
   * Get user approval summary
   */
  async getUserSummary(userId: string): Promise<UserApprovalSummary> {
    // Get pending approvals for user
    const pending = await this.getPendingApprovals({ userId });

    // Count expiring and urgent
    const now = Date.now();
    const expiringCount = pending.filter(
      (r) => new Date(r.expiresAt).getTime() - now < 60 * 60 * 1000 // < 1 hour
    ).length;
    const urgentCount = pending.filter(
      (r) => new Date(r.expiresAt).getTime() - now < 15 * 60 * 1000 // < 15 minutes
    ).length;

    // Get approved/rejected counts
    const { count: approvedCount } = await this.supabase
      .from('approval_requests')
      .select('*', { count: 'exact', head: true })
      .eq('decided_by', userId)
      .eq('status', ApprovalStatus.APPROVED);

    const { count: rejectedCount } = await this.supabase
      .from('approval_requests')
      .select('*', { count: 'exact', head: true })
      .eq('decided_by', userId)
      .eq('status', ApprovalStatus.REJECTED);

    return {
      userId,
      pendingCount: pending.length,
      approvedCount: approvedCount || 0,
      rejectedCount: rejectedCount || 0,
      expiringCount,
      urgentCount,
    };
  }

  /**
   * Check if user can approve a request
   */
  async canApprove(userId: string, requestId: string): Promise<boolean> {
    const request = await this.getRequest(requestId);
    if (!request) {
      return false;
    }

    // Check if pending
    if (request.status !== ApprovalStatus.PENDING) {
      return false;
    }

    // Check if expired
    if (new Date() > new Date(request.expiresAt)) {
      return false;
    }

    // Check allowed approvers
    if (request.allowedApprovers && request.allowedApprovers.length > 0) {
      return request.allowedApprovers.includes(userId);
    }

    // Check notify users
    if (request.notifyUsers.includes(userId)) {
      return true;
    }

    // Default: any user can approve
    return true;
  }

  /**
   * Log an approval action
   */
  private async logAction(input: AuditLogInput): Promise<void> {
    if (!this.enableAuditLog) {
      return;
    }

    try {
      await this.supabase.from('approval_audit_log').insert({
        approval_request_id: input.approvalRequestId,
        action: input.action,
        user_id: input.userId,
        user_email: input.userEmail,
        user_name: input.userName,
        ip_address: input.ipAddress,
        user_agent: input.userAgent,
        old_status: input.oldStatus,
        new_status: input.newStatus,
        comment: input.comment,
        metadata: input.metadata || {},
      });
    } catch (error) {
      console.error('Failed to log approval action:', error);
    }
  }

  /**
   * Map database row to ApprovalRequest
   */
  private mapToApprovalRequest(data: Record<string, unknown>): ApprovalRequest {
    return {
      id: data.id as string,
      workflowId: data.workflow_id as string,
      jobId: data.job_id as string,
      executionId: data.execution_id as string,
      title: data.title as string,
      description: data.description as string | undefined,
      context: (data.context as Record<string, unknown>) || {},
      status: data.status as ApprovalStatus,
      requestedBy: data.requested_by as string,
      requestedAt: new Date(data.requested_at as string),
      decidedBy: data.decided_by as string | undefined,
      decidedAt: data.decided_at ? new Date(data.decided_at as string) : undefined,
      decision: data.decision as 'approved' | 'rejected' | undefined,
      comment: data.comment as string | undefined,
      reason: data.reason as string | undefined,
      timeoutMs: data.timeout_ms as number,
      expiresAt: new Date(data.expires_at as string),
      timeoutAction: data.timeout_action as TimeoutAction,
      notifyUsers: (data.notify_users as string[]) || [],
      notifyChannels: (data.notify_channels as NotificationChannel[]) || [],
      notifyRoles: (data.notify_roles as string[]) || undefined,
      notificationSentAt: data.notification_sent_at
        ? new Date(data.notification_sent_at as string)
        : undefined,
      requireMinApprovers: data.require_min_approvers as number,
      allowedApprovers: (data.allowed_approvers as string[]) || undefined,
      approvers: (data.approvers as string[]) || [],
      requireAllApprovers: data.require_all_approvers as boolean,
      escalateToUsers: (data.escalate_to_users as string[]) || undefined,
      escalationLevel: data.escalation_level as number,
      metadata: (data.metadata as Record<string, unknown>) || {},
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  /**
   * Parse PostgreSQL interval to milliseconds
   */
  private parseInterval(interval: string | null): number {
    if (!interval) return 0;
    
    // Simple parser for PostgreSQL interval format
    const hours = interval.match(/(\d+) hours?/);
    const minutes = interval.match(/(\d+) minutes?/);
    const seconds = interval.match(/(\d+) seconds?/);
    
    let ms = 0;
    if (hours) ms += parseInt(hours[1]) * 60 * 60 * 1000;
    if (minutes) ms += parseInt(minutes[1]) * 60 * 1000;
    if (seconds) ms += parseInt(seconds[1]) * 1000;
    
    return ms;
  }

  /**
   * Cleanup and close
   */
  async close(): Promise<void> {
    this.stopTimeoutChecker();
  }
}

// Singleton instance
let approvalManagerInstance: ApprovalManager | null = null;

export function getApprovalManager(config?: ApprovalManagerConfig): ApprovalManager {
  if (!approvalManagerInstance) {
    approvalManagerInstance = new ApprovalManager(config);
    approvalManagerInstance.startTimeoutChecker();
  }
  return approvalManagerInstance;
}

export function closeApprovalManager(): void {
  if (approvalManagerInstance) {
    approvalManagerInstance.close();
    approvalManagerInstance = null;
  }
}
