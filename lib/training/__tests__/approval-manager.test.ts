/**
 * ApprovalManager Unit Tests
 * 
 * Tests for approval lifecycle management, permission checks, and statistics
 */

import { ApprovalManager } from '../approval-manager';
import { ApprovalStatus } from '../types/approval-types';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('ApprovalManager', () => {
  let approvalManager: ApprovalManager;
   
  let mockSupabase: unknown;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    approvalManager = new ApprovalManager({
      enableAuditLog: false, // Disable for unit tests
    });
  });

  afterEach(() => {
    approvalManager.stopTimeoutChecker();
  });

  describe('createRequest', () => {
    it('should create a new approval request successfully', async () => {
      const mockRequest = {
        id: 'test-id-1',
        workflow_id: 'workflow-1',
        job_id: 'job-1',
        execution_id: 'exec-1',
        title: 'Test Approval',
        description: 'Test description',
        status: ApprovalStatus.PENDING,
        requested_by: 'user-1',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };

      mockSupabase.insert.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockRequest,
            error: null,
          }),
        }),
      });

      const result = await approvalManager.createRequest({
        workflowId: 'workflow-1',
        jobId: 'job-1',
        executionId: 'exec-1',
        title: 'Test Approval',
        description: 'Test description',
        requestedBy: 'user-1',
        notifyUsers: ['user-2', 'user-3'],
        timeoutMs: 3600000,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('test-id-1');
      expect(result.status).toBe(ApprovalStatus.PENDING);
      expect(mockSupabase.from).toHaveBeenCalledWith('approval_requests');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should handle creation errors gracefully', async () => {
      mockSupabase.insert.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      });

      await expect(
        approvalManager.createRequest({
          workflowId: 'workflow-1',
          jobId: 'job-1',
          executionId: 'exec-1',
          title: 'Test',
          requestedBy: 'user-1',
          notifyUsers: [],
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('getRequest', () => {
    it('should retrieve an approval request by ID', async () => {
      const mockRequest = {
        id: 'test-id-1',
        workflow_id: 'workflow-1',
        status: ApprovalStatus.PENDING,
        title: 'Test Approval',
      };

      mockSupabase.single.mockResolvedValue({
        data: mockRequest,
        error: null,
      });

      const result = await approvalManager.getRequest('test-id-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-id-1');
      expect(mockSupabase.from).toHaveBeenCalledWith('approval_requests');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'test-id-1');
    });

    it('should return null for non-existent request', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await approvalManager.getRequest('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('approve', () => {
    it('should approve a pending request successfully', async () => {
      const mockRequest = {
        id: 'test-id-1',
        status: ApprovalStatus.PENDING,
        require_min_approvers: 1,
        current_approver_count: 0,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: mockRequest,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { ...mockRequest, status: ApprovalStatus.APPROVED },
        error: null,
      });

      const result = await approvalManager.approve('test-id-1', {
        userId: 'user-1',
        comment: 'LGTM',
      });

      expect(result).toBeDefined();
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it('should handle multi-approver workflows', async () => {
      const mockRequest = {
        id: 'test-id-1',
        status: ApprovalStatus.PENDING,
        require_min_approvers: 3,
        current_approver_count: 1,
        approvers: ['user-1'],
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: mockRequest,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { ...mockRequest, current_approver_count: 2 },
        error: null,
      });

      await approvalManager.approve('test-id-1', { userId: 'user-2' });

      // Verify it's still pending (need 3 approvers, only have 2)
      const updateCall = mockSupabase.update.mock.calls[0][0];
      expect(updateCall.status).toBe(ApprovalStatus.PENDING);
    });

    it('should reject approval of non-pending requests', async () => {
      const mockRequest = {
        id: 'test-id-1',
        status: ApprovalStatus.APPROVED,
      };

      mockSupabase.single.mockResolvedValue({
        data: mockRequest,
        error: null,
      });

      await expect(
        approvalManager.approve('test-id-1', { userId: 'user-1' })
      ).rejects.toThrow('not in pending state');
    });
  });

  describe('reject', () => {
    it('should reject a pending request with reason', async () => {
      const mockRequest = {
        id: 'test-id-1',
        status: ApprovalStatus.PENDING,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: mockRequest,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { ...mockRequest, status: ApprovalStatus.REJECTED },
        error: null,
      });

      const result = await approvalManager.reject('test-id-1', {
        userId: 'user-1',
        reason: 'Security concerns',
        comment: 'Please fix',
      });

      expect(result).toBeDefined();
      expect(mockSupabase.update).toHaveBeenCalled();
      const updateCall = mockSupabase.update.mock.calls[0][0];
      expect(updateCall.status).toBe(ApprovalStatus.REJECTED);
      expect(updateCall.reason).toBe('Security concerns');
    });

    it('should require a reason for rejection', async () => {
      const mockRequest = {
        id: 'test-id-1',
        status: ApprovalStatus.PENDING,
      };

      mockSupabase.single.mockResolvedValue({
        data: mockRequest,
        error: null,
      });

      await expect(
        approvalManager.reject('test-id-1', { userId: 'user-1', reason: '' })
      ).rejects.toThrow('Reason is required');
    });
  });

  describe('cancel', () => {
    it('should cancel a pending request', async () => {
      const mockRequest = {
        id: 'test-id-1',
        status: ApprovalStatus.PENDING,
      };

      mockSupabase.single.mockResolvedValue({
        data: mockRequest,
        error: null,
      });

      await approvalManager.cancel('test-id-1', 'user-1', 'No longer needed');

      expect(mockSupabase.update).toHaveBeenCalled();
      const updateCall = mockSupabase.update.mock.calls[0][0];
      expect(updateCall.status).toBe(ApprovalStatus.CANCELLED);
    });
  });

  describe('canApprove', () => {
    it('should return true for allowed approvers', async () => {
      const mockRequest = {
        id: 'test-id-1',
        status: ApprovalStatus.PENDING,
        allowed_approvers: ['user-1', 'user-2'],
        approvers: [],
      };

      mockSupabase.single.mockResolvedValue({
        data: mockRequest,
        error: null,
      });

      const result = await approvalManager.canApprove('test-id-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false for users who already approved', async () => {
      const mockRequest = {
        id: 'test-id-1',
        status: ApprovalStatus.PENDING,
        allowed_approvers: ['user-1', 'user-2'],
        approvers: ['user-1'],
      };

      mockSupabase.single.mockResolvedValue({
        data: mockRequest,
        error: null,
      });

      const result = await approvalManager.canApprove('test-id-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return true when no restrictions (empty allowed_approvers)', async () => {
      const mockRequest = {
        id: 'test-id-1',
        status: ApprovalStatus.PENDING,
        allowed_approvers: [],
        approvers: [],
      };

      mockSupabase.single.mockResolvedValue({
        data: mockRequest,
        error: null,
      });

      const result = await approvalManager.canApprove('test-id-1', 'anyone');

      expect(result).toBe(true);
    });

    it('should return false for non-pending requests', async () => {
      const mockRequest = {
        id: 'test-id-1',
        status: ApprovalStatus.APPROVED,
        allowed_approvers: ['user-1'],
      };

      mockSupabase.single.mockResolvedValue({
        data: mockRequest,
        error: null,
      });

      const result = await approvalManager.canApprove('test-id-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('getPendingApprovals', () => {
    it('should return pending approvals for a user', async () => {
      const mockApprovals = [
        { id: '1', status: ApprovalStatus.PENDING },
        { id: '2', status: ApprovalStatus.PENDING },
      ];

      mockSupabase.order.mockReturnValue({
        data: mockApprovals,
        error: null,
      });

      const result = await approvalManager.getPendingApprovals({ userId: 'user-1' });

      expect(result).toHaveLength(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('approval_requests');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', ApprovalStatus.PENDING);
    });

    it('should apply filters correctly', async () => {
      mockSupabase.order.mockReturnValue({
        data: [],
        error: null,
      });

      await approvalManager.getPendingApprovals({
        workflowId: 'workflow-1',
        limit: 10,
        offset: 0,
      });

      expect(mockSupabase.eq).toHaveBeenCalledWith('workflow_id', 'workflow-1');
      expect(mockSupabase.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('getStats', () => {
    it('should calculate approval statistics correctly', async () => {
      const mockData = [
        { status: ApprovalStatus.APPROVED, created_at: '2025-01-01', decided_at: '2025-01-01' },
        { status: ApprovalStatus.APPROVED, created_at: '2025-01-01', decided_at: '2025-01-01' },
        { status: ApprovalStatus.REJECTED, created_at: '2025-01-01', decided_at: '2025-01-01' },
        { status: ApprovalStatus.PENDING, created_at: '2025-01-01', decided_at: null },
      ];

      mockSupabase.order.mockReturnValue({
        data: mockData,
        error: null,
      });

      const stats = await approvalManager.getStats();

      expect(stats.total).toBe(4);
      expect(stats.approved).toBe(2);
      expect(stats.rejected).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.avgDecisionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('timeout handling', () => {
    it('should start and stop timeout checker', () => {
      expect(approvalManager['timeoutCheckTimer']).toBeUndefined();

      approvalManager.startTimeoutChecker();
      expect(approvalManager['timeoutCheckTimer']).toBeDefined();

      approvalManager.stopTimeoutChecker();
      expect(approvalManager['timeoutCheckTimer']).toBeUndefined();
    });

    it('should not start multiple timeout checkers', () => {
      approvalManager.startTimeoutChecker();
      const timer1 = approvalManager['timeoutCheckTimer'];

      approvalManager.startTimeoutChecker();
      const timer2 = approvalManager['timeoutCheckTimer'];

      expect(timer1).toBe(timer2);
      
      approvalManager.stopTimeoutChecker();
    });
  });
});
