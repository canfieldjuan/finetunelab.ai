/**
 * Phase 2.4: Human-in-the-Loop Types
 * 
 * Type definitions for approval workflows, notifications, and audit logging.
 */

// =============================================================================
// Approval Status and Actions
// =============================================================================

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  TIMEOUT = 'timeout',
  ESCALATED = 'escalated',
  CANCELLED = 'cancelled',
}

export enum TimeoutAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  ESCALATE = 'escalate',
}

export enum NotificationChannel {
  SLACK = 'slack',
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  IN_APP = 'in-app',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  READ = 'read',
}

export enum ApprovalAction {
  CREATED = 'created',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  TIMEOUT = 'timeout',
  ESCALATED = 'escalated',
  CANCELLED = 'cancelled',
  COMMENTED = 'commented',
  NOTIFIED = 'notified',
}

// =============================================================================
// Approval Request Types
// =============================================================================

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  jobId: string;
  executionId: string;
  
  // Approval details
  title: string;
  description?: string;
  context: Record<string, unknown>;
  
  // Status
  status: ApprovalStatus;
  
  // Requester
  requestedBy: string;
  requestedAt: Date;
  
  // Decision
  decidedBy?: string;
  decidedAt?: Date;
  decision?: 'approved' | 'rejected';
  comment?: string;
  reason?: string;
  
  // Timeout
  timeoutMs: number;
  expiresAt: Date;
  timeoutAction: TimeoutAction;
  
  // Notification
  notifyUsers: string[];
  notifyChannels: NotificationChannel[];
  notifyRoles?: string[];
  notificationSentAt?: Date;
  
  // Policy
  requireMinApprovers: number;
  allowedApprovers?: string[];
  approvers: string[];
  requireAllApprovers: boolean;
  
  // Escalation
  escalateToUsers?: string[];
  escalationLevel: number;
  
  // Metadata
  metadata: Record<string, unknown>;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalRequestInput {
  workflowId: string;
  jobId: string;
  executionId: string;
  title: string;
  description?: string;
  context?: Record<string, unknown>;
  notifyUsers: string[];
  notifyChannels?: NotificationChannel[];
  notifyRoles?: string[];
  timeoutMs?: number;
  timeoutAction?: TimeoutAction;
  requireMinApprovers?: number;
  allowedApprovers?: string[];
  requireAllApprovers?: boolean;
  escalateToUsers?: string[];
  metadata?: Record<string, unknown>;
  requestedBy: string;
}

export interface ApprovalDecision {
  requestId: string;
  userId: string;
  comment?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalRequestFilters {
  workflowId?: string;
  jobId?: string;
  executionId?: string;
  status?: ApprovalStatus;
  requestedBy?: string;
  decidedBy?: string;
  userId?: string; // For filtering by notify_users or allowed_approvers
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// =============================================================================
// Notification Types
// =============================================================================

export interface ApprovalNotification {
  id: string;
  approvalRequestId: string;
  channel: NotificationChannel;
  recipient: string;
  status: NotificationStatus;
  
  // Delivery tracking
  sentAt?: Date;
  readAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  
  // Content
  subject?: string;
  body?: string;
  metadata: Record<string, unknown>;
  
  // External tracking
  externalId?: string;
  externalUrl?: string;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationInput {
  approvalRequestId: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationTemplate {
  subject: string;
  body: string;
  priority: 'low' | 'medium' | 'high';
  channels: NotificationChannel[];
}

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: unknown[];
  threadTs?: string;
  attachments?: unknown[];
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface WebhookPayload {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  body: Record<string, unknown>;
  secret?: string;
}

export interface InAppNotification {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  link?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Audit Log Types
// =============================================================================

export interface ApprovalAuditLog {
  id: string;
  approvalRequestId: string;
  action: ApprovalAction;
  
  // Actor
  userId?: string;
  userEmail?: string;
  userName?: string;
  
  // Request context
  ipAddress?: string;
  userAgent?: string;
  
  // Action data
  oldStatus?: ApprovalStatus;
  newStatus?: ApprovalStatus;
  comment?: string;
  metadata: Record<string, unknown>;
  
  // Timestamp
  createdAt: Date;
}

export interface AuditLogInput {
  approvalRequestId: string;
  action: ApprovalAction;
  userId?: string;
  userEmail?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  oldStatus?: ApprovalStatus;
  newStatus?: ApprovalStatus;
  comment?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Approval Job Configuration Types
// =============================================================================

export interface ApprovalJobConfig {
  // Approval type
  approvalType: 'manual' | 'auto' | 'conditional';
  
  // Notification configuration
  notifyChannels: NotificationChannel[];
  notifyUsers: string[];
  notifyRoles?: string[];
  
  // Timeout configuration
  timeoutMs: number;
  timeoutAction: TimeoutAction;
  escalateToUsers?: string[];
  
  // Context to display
  contextFields?: string[];
  context?: Record<string, unknown>;
  
  // Approval message
  title: string;
  description?: string;
  reason?: string;
  
  // Policy constraints
  requireMinApprovers?: number;
  allowedApprovers?: string[];
  requireAllApprovers?: boolean;
  
  // Auto-approval conditions (for 'auto' or 'conditional' types)
  autoApproveConditions?: ApprovalCondition[];
  
  // Requester
  requestedBy?: string;
  
  // Additional metadata
  metadata?: Record<string, unknown>;
  
  // Checkpoint integration
  createCheckpoint?: boolean;
  checkpointName?: string;
}

export interface ApprovalCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

// =============================================================================
// Approval Manager Types
// =============================================================================

export interface ApprovalManagerConfig {
  // Database configuration
  supabase?: unknown; // SupabaseClient type
  
  // Timeout check interval (ms)
  timeoutCheckInterval?: number;
  
  // Notification service
  notificationService?: unknown; // NotificationService type
  
  // Enable audit logging
  enableAuditLog?: boolean;
  
  // Default timeout (ms)
  defaultTimeoutMs?: number;
  
  // Default timeout action
  defaultTimeoutAction?: TimeoutAction;
}

export interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  timeout: number;
  escalated: number;
  cancelled: number;
  avgDecisionTimeMs: number;
  avgTimeoutMs: number;
}

export interface UserApprovalSummary {
  userId: string;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  expiringCount: number; // Expiring within 1 hour
  urgentCount: number; // Expiring within 15 minutes
}

// =============================================================================
// Approval Handler Types
// =============================================================================

export interface ApprovalHandlerContext {
  approvalManager: unknown; // ApprovalManager type
  notificationService?: unknown; // NotificationService type
  jobContext: Record<string, unknown>;
}

export interface ApprovalResult {
  approved: boolean;
  status: ApprovalStatus;
  decision?: 'approved' | 'rejected';
  decidedBy?: string;
  decidedAt?: Date;
  comment?: string;
  reason?: string;
  requestId?: string;
  message?: string;
  error?: string;
}

// =============================================================================
// UI Component Types
// =============================================================================

export interface ApprovalModalProps {
  requestId: string;
  onApprove: (decision: ApprovalDecision) => Promise<void>;
  onReject: (decision: ApprovalDecision) => Promise<void>;
  onCancel: () => void;
  isOpen: boolean;
}

export interface PendingApprovalsDashboardProps {
  userId: string;
  filters?: ApprovalRequestFilters;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  onViewDetails?: (requestId: string) => void;
}

export interface ApprovalHistoryViewerProps {
  workflowId?: string;
  userId?: string;
  filters?: ApprovalRequestFilters;
  onExport?: (data: ApprovalRequest[]) => void;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface CreateApprovalResponse {
  success: boolean;
  request: ApprovalRequest;
  message?: string;
  error?: string;
}

export interface GetApprovalsResponse {
  success: boolean;
  approvals: ApprovalRequest[];
  count: number;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface ApproveRejectResponse {
  success: boolean;
  decision: {
    id: string;
    status: 'approved' | 'rejected';
    decidedBy: string;
    decidedAt: string;
    comment?: string;
    reason?: string;
  };
  message?: string;
  error?: string;
}

export interface ApprovalHistoryResponse {
  success: boolean;
  history: ApprovalRequest[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface ApprovalStatsResponse {
  success: boolean;
  stats: ApprovalStats;
  userSummary?: UserApprovalSummary;
  error?: string;
}

// =============================================================================
// Utility Types
// =============================================================================

export type ApprovalPermission =
  | 'approval:create'
  | 'approval:approve'
  | 'approval:reject'
  | 'approval:view:pending'
  | 'approval:view:history'
  | 'approval:cancel'
  | 'approval:escalate'
  | 'approval:admin';

export interface ApprovalError extends Error {
  code: string;
  requestId?: string;
  userId?: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// Export helper type guards
// =============================================================================

export function isApprovalRequest(obj: unknown): obj is ApprovalRequest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'workflowId' in obj &&
    'status' in obj &&
    Object.values(ApprovalStatus).includes((obj as ApprovalRequest).status)
  );
}

export function isApprovalDecision(obj: unknown): obj is ApprovalDecision {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'requestId' in obj &&
    'userId' in obj
  );
}

export function isPendingApproval(request: ApprovalRequest): boolean {
  return (
    request.status === ApprovalStatus.PENDING &&
    new Date(request.expiresAt) > new Date()
  );
}

export function isExpiredApproval(request: ApprovalRequest): boolean {
  return (
    request.status === ApprovalStatus.PENDING &&
    new Date(request.expiresAt) <= new Date()
  );
}

export function canUserApprove(
  request: ApprovalRequest,
  userId: string
): boolean {
  // Check if user is in allowed approvers list (if specified)
  if (request.allowedApprovers && request.allowedApprovers.length > 0) {
    return request.allowedApprovers.includes(userId);
  }
  
  // Check if user is in notify users list
  if (request.notifyUsers.includes(userId)) {
    return true;
  }
  
  // If no restrictions, any user can approve
  return true;
}

export function getTimeUntilExpiry(request: ApprovalRequest): number {
  return new Date(request.expiresAt).getTime() - Date.now();
}

export function isUrgentApproval(request: ApprovalRequest): boolean {
  const timeLeft = getTimeUntilExpiry(request);
  return timeLeft > 0 && timeLeft < 15 * 60 * 1000; // Less than 15 minutes
}

export function isExpiringApproval(request: ApprovalRequest): boolean {
  const timeLeft = getTimeUntilExpiry(request);
  return timeLeft > 0 && timeLeft < 60 * 60 * 1000; // Less than 1 hour
}
