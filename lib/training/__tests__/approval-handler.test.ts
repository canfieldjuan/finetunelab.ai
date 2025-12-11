/**
 * ApprovalHandler Unit Tests
 * 
 * Tests for DAG integration and approval workflow execution
 */

import { ApprovalHandler } from '../approval-handler';
import { ApprovalStatus } from '../types/approval-types';
import { JobContext } from '../types/job-types';
import * as ApprovalManagerModule from '../approval-manager';

// Mock getApprovalManager
jest.mock('../approval-manager', () => ({
  getApprovalManager: jest.fn(),
}));

describe('ApprovalHandler', () => {
  let approvalHandler: ApprovalHandler;
  let mockApprovalManager: {
    createRequest: jest.Mock;
    getRequest: jest.Mock;
    approve: jest.Mock;
    cancel: jest.Mock;
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock ApprovalManager
    mockApprovalManager = {
      createRequest: jest.fn(),
      getRequest: jest.fn(),
      approve: jest.fn(),
      cancel: jest.fn(),
    };

    // Mock getApprovalManager to return our mock
    (ApprovalManagerModule.getApprovalManager as jest.Mock).mockReturnValue(mockApprovalManager);

    approvalHandler = new ApprovalHandler({
      pollInterval: 100, // Fast polling for tests
      maxPollAttempts: 10,
    });
  });

  describe('execute', () => {
    it('should validate required title field', async () => {
      const context: JobContext = {
        jobId: 'job-1',
        workflowId: 'workflow-1',
        type: 'approval',
        config: {
          notifyUsers: ['user-1'],
        },
      };

      const result = await approvalHandler.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('title is required');
    });

    it('should validate required notifyUsers field', async () => {
      const context: JobContext = {
        jobId: 'job-1',
        workflowId: 'workflow-1',
        type: 'approval',
        config: {
          title: 'Test Approval',
        },
      };

      const result = await approvalHandler.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('user to notify is required');
    });

    it('should create approval request and poll for decision', async () => {
      const mockRequest = {
        id: 'approval-1',
        status: ApprovalStatus.PENDING,
      };

      mockApprovalManager.createRequest.mockResolvedValue(mockRequest);
      mockApprovalManager.getRequest
        .mockResolvedValueOnce(mockRequest) // First poll: still pending
        .mockResolvedValueOnce({
          ...mockRequest,
          status: ApprovalStatus.APPROVED,
          decidedBy: 'user-1',
          decidedAt: new Date(),
        }); // Second poll: approved

      const context: JobContext = {
        jobId: 'job-1',
        workflowId: 'workflow-1',
        type: 'approval',
        config: {
          title: 'Test Approval',
          description: 'Test description',
          notifyUsers: ['user-1'],
          timeoutMs: 60000,
        },
      };

      const result = await approvalHandler.execute(context);

      expect(result.success).toBe(true);
      expect(result.output?.status).toBe(ApprovalStatus.APPROVED);
      expect(result.output?.decision).toBe('approved');
      expect(mockApprovalManager.createRequest).toHaveBeenCalled();
      expect(mockApprovalManager.getRequest).toHaveBeenCalledWith('approval-1');
    });

    it('should handle rejection', async () => {
      const mockRequest = {
        id: 'approval-1',
        status: ApprovalStatus.PENDING,
      };

      mockApprovalManager.createRequest.mockResolvedValue(mockRequest);
      mockApprovalManager.getRequest.mockResolvedValue({
        ...mockRequest,
        status: ApprovalStatus.REJECTED,
        decidedBy: 'user-1',
        reason: 'Not approved',
      });

      const context: JobContext = {
        jobId: 'job-1',
        workflowId: 'workflow-1',
        type: 'approval',
        config: {
          title: 'Test Approval',
          notifyUsers: ['user-1'],
          timeoutMs: 60000,
        },
      };

      const result = await approvalHandler.execute(context);

      expect(result.success).toBe(false);
      expect(result.output?.status).toBe(ApprovalStatus.REJECTED);
      expect(result.output?.reason).toBe('Not approved');
    });

    it('should handle auto-approval when conditions match', async () => {
      const context: JobContext = {
        jobId: 'job-1',
        workflowId: 'workflow-1',
        type: 'approval',
        config: {
          title: 'Test Approval',
          notifyUsers: ['user-1'],
          testField: 'production',
          autoApproveConditions: [
            { field: 'config.testField', operator: 'equals', value: 'production' },
          ],
        },
      };

      mockApprovalManager.createRequest.mockResolvedValue({ id: 'approval-1' });

      const result = await approvalHandler.execute(context);

      expect(result.success).toBe(true);
      expect(result.output?.autoApproved).toBe(true);
      expect(mockApprovalManager.approve).toHaveBeenCalled();
    });

    it('should not auto-approve when conditions do not match', async () => {
      const context: JobContext = {
        jobId: 'job-1',
        workflowId: 'workflow-1',
        type: 'approval',
        config: {
          title: 'Test Approval',
          notifyUsers: ['user-1'],
          testField: 'development',
          autoApproveConditions: [
            { field: 'config.testField', operator: 'equals', value: 'production' },
          ],
        },
      };

      const mockRequest = { id: 'approval-1', status: ApprovalStatus.PENDING };
      mockApprovalManager.createRequest.mockResolvedValue(mockRequest);
      mockApprovalManager.getRequest.mockResolvedValue({
        ...mockRequest,
        status: ApprovalStatus.APPROVED,
      });

      const result = await approvalHandler.execute(context);

      expect(result.success).toBe(true);
      expect(mockApprovalManager.createRequest).toHaveBeenCalled();
      expect(mockApprovalManager.approve).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should cancel an approval request', async () => {
      await approvalHandler.cancel('job-1', 'exec-1', 'User cancelled');

      expect(mockApprovalManager.cancel).toHaveBeenCalledWith(
        'job-1',
        'system',
        'User cancelled'
      );
    });
  });

  describe('validate', () => {
    it('should validate config with all required fields', () => {
      const config = {
        title: 'Test Approval',
        notifyUsers: ['user-1'],
        approvalType: 'manual',
        notifyChannels: ['in-app'],
        timeoutMs: 60000,
        timeoutAction: 'reject',
      };

      const result = approvalHandler.validate?.(config as never);

      expect(result?.valid).toBe(true);
      expect(result?.errors).toHaveLength(0);
    });

    it('should return errors for missing required fields', () => {
      const config = {};

      const result = approvalHandler.validate?.(config as never);

      expect(result?.valid).toBe(false);
      expect(result?.errors.length).toBeGreaterThan(0);
      expect(result?.errors).toContain('title is required');
    });
  });
});
