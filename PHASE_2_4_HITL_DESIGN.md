# Phase 2.4: Human-in-the-Loop (HITL) Design

**Status**: Design Phase  
**Estimated Duration**: 1-2 weeks  
**Dependencies**: Phase 2.1, 2.2, 2.3 complete  
**Target**: Enable human approval gates in DAG workflows

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Notification System](#notification-system)
5. [Approval Workflow](#approval-workflow)
6. [API Design](#api-design)
7. [UI Components](#ui-components)
8. [Database Schema](#database-schema)
9. [Integration Points](#integration-points)
10. [Security Considerations](#security-considerations)
11. [Implementation Phases](#implementation-phases)
12. [Testing Strategy](#testing-strategy)

---

## Overview

### Problem Statement

Current DAG orchestration runs fully automated workflows without human intervention. Many real-world scenarios require:

- **Manual approval** before critical steps (deployments, model releases)
- **Human review** of intermediate results
- **Quality gates** requiring human judgment
- **Compliance requirements** for audited processes
- **Emergency intervention** points in long-running workflows

### Solution

Implement Human-in-the-Loop (HITL) capabilities that:
- ✅ Pause workflow execution at approval gates
- ✅ Notify stakeholders via multiple channels
- ✅ Provide approval UI with contextual information
- ✅ Resume execution after approval/rejection
- ✅ Handle timeouts with configurable actions
- ✅ Maintain complete audit trail

### Key Features

1. **Approval Job Type**: New job type that waits for human decision
2. **Multi-Channel Notifications**: Slack, email, webhooks, in-app
3. **Rich Context**: Provide job results, metrics, logs to approvers
4. **Timeout Handling**: Auto-approve, auto-reject, or escalate
5. **Role-Based Access**: Control who can approve specific workflows
6. **Audit Trail**: Complete history of approvals and rejections
7. **Bulk Approvals**: Approve multiple pending items at once

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DAG Orchestrator                        │
│                                                             │
│   ┌──────────────┐     ┌──────────────┐    ┌────────────┐ │
│   │ Training Job │ ──▶ │ Approval Job │ ──▶│ Deploy Job │ │
│   └──────────────┘     └───────┬──────┘    └────────────┘ │
│                                 │                           │
│                                 ▼                           │
│                      ┌──────────────────┐                  │
│                      │  Approval State  │                  │
│                      │    (pending)     │                  │
│                      └─────────┬────────┘                  │
└────────────────────────────────┼────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
         ┌──────────────────┐     ┌──────────────────┐
         │ Notification     │     │  Approval API    │
         │ Service          │     │  Endpoints       │
         │                  │     │                  │
         │ - Slack          │     │  POST /approve   │
         │ - Email          │     │  POST /reject    │
         │ - Webhook        │     │  GET  /pending   │
         │ - In-App         │     │  GET  /history   │
         └──────────────────┘     └─────────┬────────┘
                                            │
                                            ▼
                                 ┌──────────────────┐
                                 │  Approval UI     │
                                 │  - Modal         │
                                 │  - Dashboard     │
                                 │  - History View  │
                                 └──────────────────┘
```

### Component Interaction Flow

```
1. Workflow reaches approval job
   ↓
2. Orchestrator pauses at approval gate
   ↓
3. Create approval record in database
   ↓
4. Notification service sends alerts
   ↓
5. Approver reviews context and decides
   ↓
6. Decision recorded in audit log
   ↓
7. Orchestrator resumes or cancels workflow
```

---

## Core Components

### 1. Approval Job Handler

**File**: `lib/training/handlers/approval-handler.ts`

**Responsibilities**:
- Create approval requests
- Wait for approval decision
- Handle timeouts
- Resume/cancel workflow based on decision

**Key Methods**:
```typescript
interface ApprovalHandler extends JobHandler {
  // Create approval request and pause
  createApprovalRequest(context: JobContext): Promise<ApprovalRequest>;
  
  // Wait for decision (polling or event-driven)
  waitForDecision(requestId: string, timeout: number): Promise<ApprovalDecision>;
  
  // Handle timeout
  onTimeout(requestId: string, action: TimeoutAction): Promise<void>;
  
  // Resume workflow
  onApproved(requestId: string, decision: ApprovalDecision): Promise<void>;
  
  // Cancel workflow
  onRejected(requestId: string, decision: ApprovalDecision): Promise<void>;
}
```

### 2. Approval Manager

**File**: `lib/training/approval-manager.ts`

**Responsibilities**:
- Centralized approval state management
- Query pending approvals
- Record approval decisions
- Manage approval policies

**Key Methods**:
```typescript
class ApprovalManager {
  // Create new approval request
  async createRequest(request: ApprovalRequestInput): Promise<ApprovalRequest>;
  
  // Get pending approvals
  async getPendingApprovals(filters: ApprovalFilters): Promise<ApprovalRequest[]>;
  
  // Approve request
  async approve(requestId: string, decision: ApprovalDecision): Promise<void>;
  
  // Reject request
  async reject(requestId: string, decision: ApprovalDecision): Promise<void>;
  
  // Check timeout status
  async checkTimeouts(): Promise<void>;
  
  // Get approval history
  async getHistory(filters: HistoryFilters): Promise<ApprovalRecord[]>;
  
  // Check if user can approve
  async canApprove(userId: string, requestId: string): Promise<boolean>;
}
```

### 3. Notification Service

**File**: `lib/training/notification-service.ts`

**Responsibilities**:
- Send notifications via multiple channels
- Template management
- Delivery tracking
- Retry logic

**Supported Channels**:
- **Slack**: Direct message or channel post
- **Email**: SMTP or SendGrid
- **Webhook**: Custom HTTP endpoints
- **In-App**: Database notifications for UI

**Key Methods**:
```typescript
class NotificationService {
  // Send notification via all configured channels
  async notify(notification: NotificationInput): Promise<NotificationResult[]>;
  
  // Send Slack notification
  async sendSlack(message: SlackMessage): Promise<void>;
  
  // Send email notification
  async sendEmail(email: EmailMessage): Promise<void>;
  
  // Send webhook notification
  async sendWebhook(webhook: WebhookPayload): Promise<void>;
  
  // Create in-app notification
  async createInApp(notification: InAppNotification): Promise<void>;
  
  // Get notification templates
  getTemplate(type: NotificationType): NotificationTemplate;
}
```

---

## Notification System

### Channel Configuration

**Environment Variables**:
```bash
# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_APPROVAL_CHANNEL=#approvals
SLACK_ENABLED=true

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@company.com
SMTP_PASS=...
EMAIL_FROM=Training Platform <noreply@company.com>
EMAIL_ENABLED=true

# Webhook
WEBHOOK_URL=https://api.company.com/approvals
WEBHOOK_SECRET=...
WEBHOOK_ENABLED=false
```

### Notification Templates

**Approval Required**:
```typescript
{
  title: "Approval Required: {workflow_name}",
  body: `
    Workflow: {workflow_name}
    Job: {job_name}
    Requested by: {requester}
    Reason: {reason}
    
    Context:
    {context_data}
    
    Actions:
    - Approve: {approve_url}
    - Reject: {reject_url}
    - View Details: {details_url}
    
    This request will timeout in {timeout_duration}.
  `,
  priority: "high",
  channels: ["slack", "email", "in-app"]
}
```

**Approval Timeout**:
```typescript
{
  title: "Approval Timeout: {workflow_name}",
  body: `
    The approval request for {workflow_name} has timed out.
    Action taken: {timeout_action}
    
    Details: {details_url}
  `,
  priority: "medium",
  channels: ["slack", "email"]
}
```

**Approval Decision**:
```typescript
{
  title: "Approval Decision: {workflow_name}",
  body: `
    Decision: {decision}
    Approver: {approver}
    Comment: {comment}
    Timestamp: {timestamp}
    
    The workflow will now {next_action}.
  `,
  priority: "low",
  channels: ["slack", "in-app"]
}
```

---

## Approval Workflow

### Job Configuration

```typescript
{
  id: 'approval-1',
  name: 'Deployment Approval',
  type: 'approval',
  dependsOn: ['training-job', 'validation-job'],
  config: {
    // Required fields
    approvalType: 'manual', // 'manual' | 'auto' | 'conditional'
    
    // Notification configuration
    notifyChannels: ['slack', 'email'],
    notifyUsers: ['user-123', 'user-456'],
    notifyRoles: ['ml-ops', 'data-science-lead'],
    
    // Timeout configuration
    timeoutMs: 3600000, // 1 hour
    timeoutAction: 'reject', // 'approve' | 'reject' | 'escalate'
    escalateToUsers: ['manager-789'],
    
    // Context to display
    contextFields: ['model_accuracy', 'training_loss', 'validation_metrics'],
    
    // Approval message
    title: 'Deploy Model to Production',
    description: 'Approve deployment of trained model to production environment',
    reason: 'Model meets accuracy threshold (>95%)',
    
    // Policy constraints
    requireMinApprovers: 2,
    allowedApprovers: ['user-123', 'user-456', 'user-789'],
    requireAllApprovers: false,
    
    // Additional metadata
    metadata: {
      environment: 'production',
      modelVersion: '1.2.3',
      risk: 'high'
    }
  }
}
```

### Approval States

```typescript
enum ApprovalStatus {
  PENDING = 'pending',       // Waiting for approval
  APPROVED = 'approved',     // Approved by user
  REJECTED = 'rejected',     // Rejected by user
  TIMEOUT = 'timeout',       // Timed out
  ESCALATED = 'escalated',   // Escalated to next level
  CANCELLED = 'cancelled'    // Workflow cancelled
}
```

### State Transitions

```
pending ──approve──▶ approved ──▶ resume workflow
   │
   ├──reject──▶ rejected ──▶ cancel workflow
   │
   ├──timeout──▶ timeout ──▶ (auto-approve | auto-reject | escalate)
   │
   └──cancel──▶ cancelled ──▶ cancel workflow
```

---

## API Design

### REST Endpoints

#### 1. Create Approval Request

```typescript
POST /api/approvals

Request:
{
  workflowId: string;
  jobId: string;
  title: string;
  description: string;
  context: Record<string, unknown>;
  notifyUsers: string[];
  timeoutMs: number;
  timeoutAction: 'approve' | 'reject' | 'escalate';
}

Response:
{
  success: boolean;
  request: {
    id: string;
    status: ApprovalStatus;
    createdAt: string;
    expiresAt: string;
  };
}
```

#### 2. Get Pending Approvals

```typescript
GET /api/approvals/pending?userId={userId}&workflowId={workflowId}

Response:
{
  success: boolean;
  approvals: Array<{
    id: string;
    workflowId: string;
    workflowName: string;
    jobId: string;
    jobName: string;
    title: string;
    description: string;
    context: Record<string, unknown>;
    requestedBy: string;
    requestedAt: string;
    expiresAt: string;
    canApprove: boolean;
  }>;
  count: number;
}
```

#### 3. Approve Request

```typescript
POST /api/approvals/{requestId}/approve

Request:
{
  userId: string;
  comment?: string;
  metadata?: Record<string, unknown>;
}

Response:
{
  success: boolean;
  decision: {
    id: string;
    status: 'approved';
    approvedBy: string;
    approvedAt: string;
    comment: string;
  };
}
```

#### 4. Reject Request

```typescript
POST /api/approvals/{requestId}/reject

Request:
{
  userId: string;
  reason: string;
  comment?: string;
}

Response:
{
  success: boolean;
  decision: {
    id: string;
    status: 'rejected';
    rejectedBy: string;
    rejectedAt: string;
    reason: string;
    comment: string;
  };
}
```

#### 5. Get Approval History

```typescript
GET /api/approvals/history?workflowId={id}&userId={id}&status={status}

Response:
{
  success: boolean;
  history: Array<{
    id: string;
    workflowId: string;
    workflowName: string;
    status: ApprovalStatus;
    requestedBy: string;
    requestedAt: string;
    decidedBy?: string;
    decidedAt?: string;
    decision?: 'approved' | 'rejected';
    comment?: string;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}
```

#### 6. Cancel Approval Request

```typescript
POST /api/approvals/{requestId}/cancel

Request:
{
  userId: string;
  reason: string;
}

Response:
{
  success: boolean;
  message: string;
}
```

---

## UI Components

### 1. Approval Modal

**Component**: `components/training/ApprovalModal.tsx`

**Features**:
- Display approval details (title, description, context)
- Show requester information and timestamp
- Display countdown to timeout
- Approve/Reject buttons with confirmation
- Comment/reason input field
- View full workflow context
- Show approval history for this workflow

**UI Mockup**:
```
┌─────────────────────────────────────────────────────┐
│  Approval Required                              [X] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Deploy Model to Production                        │
│                                                     │
│  Workflow: Training Pipeline v1.2.3                │
│  Requested by: John Doe                            │
│  Requested: 5 minutes ago                          │
│  ⏰ Timeout in: 55 minutes                         │
│                                                     │
│  ──────────────────────────────────────────────    │
│                                                     │
│  Description:                                      │
│  Approve deployment of trained model to            │
│  production environment                            │
│                                                     │
│  Model Metrics:                                    │
│  • Accuracy: 96.5%                                 │
│  • F1 Score: 0.94                                  │
│  • Validation Loss: 0.12                           │
│                                                     │
│  Context:                                          │
│  {context_json_viewer}                             │
│                                                     │
│  ──────────────────────────────────────────────    │
│                                                     │
│  Comment (optional):                               │
│  ┌───────────────────────────────────────────┐    │
│  │                                           │    │
│  └───────────────────────────────────────────┘    │
│                                                     │
│  [View Full Workflow]  [View History]              │
│                                                     │
│  [Reject]                          [Approve] ✓     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2. Pending Approvals Dashboard

**Component**: `components/training/PendingApprovalsDashboard.tsx`

**Features**:
- List all pending approvals for current user
- Filter by workflow, date, priority
- Bulk approve/reject
- Sort by expiration time
- Badge with count on main nav

**UI Mockup**:
```
┌─────────────────────────────────────────────────────┐
│  Pending Approvals (3)                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Filters: [All Workflows ▼] [All Time ▼]          │
│  Sort by: [Expiring Soon ▼]                        │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ Deploy Model to Production              🔴  │  │
│  │ Training Pipeline v1.2.3                    │  │
│  │ Expires in 30 minutes                       │  │
│  │ [View] [Approve] [Reject]                   │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ Data Quality Check                      🟡  │  │
│  │ ETL Pipeline Daily Run                      │  │
│  │ Expires in 2 hours                          │  │
│  │ [View] [Approve] [Reject]                   │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ Model Retraining Approval               🟢  │  │
│  │ Weekly Training Job                         │  │
│  │ Expires in 1 day                            │  │
│  │ [View] [Approve] [Reject]                   │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  [Bulk Approve Selected]                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3. Approval History Viewer

**Component**: `components/training/ApprovalHistoryViewer.tsx`

**Features**:
- Timeline view of all approvals
- Filter by status, approver, date
- Export to CSV
- Audit trail details

---

## Database Schema

### Approval Requests Table

```sql
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES dag_executions(id),
  job_id VARCHAR(255) NOT NULL,
  execution_id UUID NOT NULL,
  
  -- Approval details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  context JSONB,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- 'pending', 'approved', 'rejected', 'timeout', 'escalated', 'cancelled'
  
  -- Requester
  requested_by VARCHAR(255) NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Decision
  decided_by VARCHAR(255),
  decided_at TIMESTAMPTZ,
  decision VARCHAR(50),
  comment TEXT,
  
  -- Timeout
  timeout_ms INTEGER NOT NULL DEFAULT 3600000,
  expires_at TIMESTAMPTZ NOT NULL,
  timeout_action VARCHAR(50) NOT NULL DEFAULT 'reject',
  
  -- Notification
  notify_users TEXT[], -- Array of user IDs
  notify_channels TEXT[], -- Array of channel names
  notification_sent_at TIMESTAMPTZ,
  
  -- Policy
  require_min_approvers INTEGER DEFAULT 1,
  allowed_approvers TEXT[],
  approvers TEXT[], -- Actual approvers
  
  -- Metadata
  metadata JSONB,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'approved', 'rejected', 'timeout', 'escalated', 'cancelled'
  )),
  CONSTRAINT valid_timeout_action CHECK (timeout_action IN (
    'approve', 'reject', 'escalate'
  ))
);

-- Indexes
CREATE INDEX idx_approval_requests_workflow_id ON approval_requests(workflow_id);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE INDEX idx_approval_requests_expires_at ON approval_requests(expires_at);
CREATE INDEX idx_approval_requests_requested_by ON approval_requests(requested_by);
CREATE INDEX idx_approval_requests_decided_by ON approval_requests(decided_by);
```

### Approval Notifications Table

```sql
CREATE TABLE approval_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  
  -- Channel
  channel VARCHAR(50) NOT NULL, -- 'slack', 'email', 'webhook', 'in-app'
  recipient VARCHAR(255) NOT NULL,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- 'pending', 'sent', 'failed', 'read'
  
  -- Delivery
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Content
  subject VARCHAR(500),
  body TEXT,
  metadata JSONB,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_channel CHECK (channel IN (
    'slack', 'email', 'webhook', 'in-app'
  )),
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'sent', 'failed', 'read'
  ))
);

-- Indexes
CREATE INDEX idx_approval_notifications_request_id ON approval_notifications(approval_request_id);
CREATE INDEX idx_approval_notifications_recipient ON approval_notifications(recipient);
CREATE INDEX idx_approval_notifications_status ON approval_notifications(status);
```

---

## Integration Points

### 1. DAG Orchestrator Integration

**Modifications to DAGOrchestrator**:

```typescript
// Add approval handler registration
this.registerHandler('approval', new ApprovalHandler(this.approvalManager));

// Modify executeJob to handle approval pauses
async executeJob(job: JobConfig, context: JobContext): Promise<JobResult> {
  if (job.type === 'approval') {
    // Create approval request
    const request = await this.approvalManager.createRequest({
      workflowId: context.workflowId,
      jobId: job.id,
      ...job.config
    });
    
    // Wait for decision (with timeout)
    const decision = await this.waitForApproval(request.id, job.config.timeoutMs);
    
    if (decision.status === 'approved') {
      return { status: 'completed', output: decision };
    } else {
      return { status: 'failed', error: decision.reason };
    }
  }
  
  // Regular job execution...
}

// Add method to wait for approval
async waitForApproval(requestId: string, timeoutMs: number): Promise<ApprovalDecision> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const request = await this.approvalManager.getRequest(requestId);
    
    if (request.status !== 'pending') {
      return {
        status: request.status,
        decidedBy: request.decided_by,
        comment: request.comment
      };
    }
    
    // Poll every 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Handle timeout
  return this.approvalManager.handleTimeout(requestId);
}
```

### 2. Checkpoint Integration

Approvals should create checkpoints automatically:

```typescript
{
  id: 'approval-1',
  type: 'approval',
  config: {
    createCheckpoint: true, // Auto-checkpoint before approval
    checkpointName: 'pre-deployment-approval'
  }
}
```

### 3. Distributed Execution Integration

For distributed systems, use state store for approval state:

```typescript
// Store approval state in Redis
await stateStore.setApprovalState(requestId, {
  status: 'pending',
  expiresAt: Date.now() + timeoutMs
});

// Workers poll for approval decision
const decision = await stateStore.getApprovalState(requestId);
```

---

## Security Considerations

### 1. Access Control

**Role-Based Permissions**:
```typescript
enum ApprovalPermission {
  CREATE_APPROVAL = 'approval:create',
  APPROVE = 'approval:approve',
  REJECT = 'approval:reject',
  VIEW_PENDING = 'approval:view:pending',
  VIEW_HISTORY = 'approval:view:history',
  CANCEL = 'approval:cancel',
  ESCALATE = 'approval:escalate'
}
```

**Permission Checks**:
```typescript
async canApprove(userId: string, requestId: string): Promise<boolean> {
  const request = await this.getRequest(requestId);
  
  // Check if user has approval permission
  if (!await this.hasPermission(userId, 'approval:approve')) {
    return false;
  }
  
  // Check if user is in allowed approvers list
  if (request.allowed_approvers?.length > 0) {
    return request.allowed_approvers.includes(userId);
  }
  
  return true;
}
```

### 2. Audit Trail

Log all approval-related actions:
```typescript
await this.auditLog.log({
  action: 'APPROVAL_DECISION',
  userId: decision.userId,
  requestId: request.id,
  workflowId: request.workflowId,
  decision: decision.status,
  comment: decision.comment,
  timestamp: new Date(),
  ipAddress: request.ipAddress,
  userAgent: request.userAgent
});
```

### 3. Token-Based URLs

Generate secure one-time tokens for email/Slack approval links:

```typescript
const token = await this.generateApprovalToken(requestId, userId);
const approveUrl = `https://platform.com/approve/${token}`;
```

---

## Implementation Phases

### Phase 2.4.1: Design (Current)
- ✅ Architecture design
- ✅ Database schema
- ✅ API specification
- ✅ UI mockups

### Phase 2.4.2: Approval Job Handler (3-4 days)
- Approval job type implementation
- Wait/notify mechanism
- Timeout handling
- State management

### Phase 2.4.3: Notification Integrations (3-4 days)
- Notification service base
- Slack integration
- Email integration
- Webhook support
- In-app notifications

### Phase 2.4.4: UI Components (2-3 days)
- Approval modal
- Pending approvals dashboard
- Approval history viewer
- Badge notifications

### Phase 2.4.5: API Endpoints (2 days)
- REST API implementation
- Permission checks
- Validation
- Error handling

### Phase 2.4.6: Validation Tests (2 days)
- Unit tests for all components
- Integration tests for workflows
- E2E tests for approval flow
- Timeout scenario tests

### Phase 2.4.7: Documentation (1 day)
- API documentation
- User guide
- Admin guide
- Migration guide

**Total Estimated Duration**: 13-17 days (~2-3 weeks)

---

## Testing Strategy

### Unit Tests

1. **Approval Manager Tests**:
   - Create approval request
   - Approve request
   - Reject request
   - Handle timeout
   - Check permissions

2. **Notification Service Tests**:
   - Send Slack notification
   - Send email notification
   - Send webhook notification
   - Retry logic
   - Template rendering

3. **Approval Handler Tests**:
   - Execute approval job
   - Wait for decision
   - Handle approval
   - Handle rejection
   - Handle timeout

### Integration Tests

1. **End-to-End Approval Flow**:
   ```typescript
   test('complete approval workflow', async () => {
     // 1. Start workflow with approval gate
     const execution = await orchestrator.execute(workflowId, jobs);
     
     // 2. Wait for approval request creation
     await waitFor(() => 
       approvalManager.getPendingApprovals().length > 0
     );
     
     // 3. Approve request
     const request = await approvalManager.getPendingApprovals()[0];
     await approvalManager.approve(request.id, {
       userId: 'test-user',
       comment: 'Looks good!'
     });
     
     // 4. Verify workflow continues
     await waitFor(() => 
       execution.status === 'completed'
     );
     
     expect(execution.jobs.find(j => j.id === 'approval-1').status)
       .toBe('completed');
   });
   ```

2. **Timeout Handling**:
   ```typescript
   test('approval timeout with auto-reject', async () => {
     const execution = await orchestrator.execute(workflowId, [{
       id: 'approval-1',
       type: 'approval',
       config: {
         timeoutMs: 1000, // 1 second
         timeoutAction: 'reject'
       }
     }]);
     
     // Wait for timeout
     await sleep(1500);
     
     // Verify auto-rejection
     const request = await approvalManager.getRequest('approval-1');
     expect(request.status).toBe('timeout');
     expect(execution.status).toBe('failed');
   });
   ```

3. **Multi-Approver Workflow**:
   ```typescript
   test('require multiple approvers', async () => {
     const execution = await orchestrator.execute(workflowId, [{
       id: 'approval-1',
       type: 'approval',
       config: {
         requireMinApprovers: 2,
         allowedApprovers: ['user-1', 'user-2', 'user-3']
       }
     }]);
     
     // First approval
     await approvalManager.approve('approval-1', { userId: 'user-1' });
     expect(execution.status).toBe('running'); // Still waiting
     
     // Second approval
     await approvalManager.approve('approval-1', { userId: 'user-2' });
     expect(execution.status).toBe('completed'); // Now approved
   });
   ```

### E2E Tests

1. **UI Approval Flow**:
   - User receives notification
   - Opens approval modal
   - Reviews context
   - Approves/rejects
   - Workflow continues/cancels

2. **Slack Integration**:
   - Approval notification sent to Slack
   - User clicks approve in Slack
   - Workflow resumes

---

## Success Criteria

### Functional Requirements
- ✅ Workflows can pause at approval gates
- ✅ Notifications sent via configured channels
- ✅ Approvals can be made via UI and API
- ✅ Timeouts handled correctly
- ✅ Audit trail maintained
- ✅ Role-based access control enforced

### Non-Functional Requirements
- ✅ <100ms API response time for approval decisions
- ✅ Notification delivery within 5 seconds
- ✅ Support 100+ concurrent approval requests
- ✅ 99.9% uptime for approval service
- ✅ Complete audit trail for compliance

### User Experience
- ✅ Clear, intuitive approval UI
- ✅ Mobile-responsive design
- ✅ Real-time updates on decision
- ✅ Easy bulk approval for trusted workflows

---

## Risk Assessment

### High Risk
1. **Notification Delivery Failures**
   - Mitigation: Retry logic, multiple channels, in-app fallback

2. **Timeout Edge Cases**
   - Mitigation: Comprehensive testing, clear timeout behavior documentation

3. **Race Conditions**
   - Mitigation: Database-level locking, atomic operations

### Medium Risk
1. **Slack/Email Integration Issues**
   - Mitigation: Graceful degradation, clear error messages

2. **Permission Management Complexity**
   - Mitigation: Simple, well-documented permission model

### Low Risk
1. **UI Performance with Many Pending Approvals**
   - Mitigation: Pagination, lazy loading

---

## Future Enhancements

1. **Conditional Approvals**: Auto-approve based on ML model predictions
2. **Approval Chains**: Multi-level approval workflows
3. **Delegate Approvals**: Temporary delegation to other users
4. **Approval Analytics**: Dashboard showing approval metrics
5. **Mobile App**: Native mobile app for approvals
6. **Voice Approvals**: Integrate with voice assistants
7. **Smart Routing**: AI-powered approver selection

---

## Conclusion

Phase 2.4 adds critical human-in-the-loop capabilities to the DAG orchestration system, enabling:
- ✅ Manual approval gates for critical workflows
- ✅ Multi-channel notification system
- ✅ Flexible timeout handling
- ✅ Complete audit trail for compliance
- ✅ Production-ready security and access control

This phase transforms the platform from fully automated to hybrid automation, supporting real-world enterprise requirements for human oversight and intervention.

**Ready to begin implementation!** 🚀
