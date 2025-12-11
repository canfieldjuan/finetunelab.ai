/**
 * Phase 2.4.4: Approval Modal Component
 * 
 * Full-featured modal for reviewing and deciding on approval requests.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { ApprovalRequest, ApprovalStatus } from '@/lib/training/types/approval-types';
import { 
  X, 
  Clock, 
  User, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  MessageSquare,
  Users
} from 'lucide-react';

export interface ApprovalModalProps {
  requestId: string;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (requestId: string, comment?: string) => Promise<void>;
  onReject: (requestId: string, reason: string, comment?: string) => Promise<void>;
  onCancel?: (requestId: string, reason: string) => Promise<void>;
}

export function ApprovalModal({
  requestId,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onCancel,
}: ApprovalModalProps) {
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Load approval request
  const loadRequest = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/approvals/${requestId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load approval request');
      }

      const data = await response.json();
      setRequest(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load request');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && requestId) {
      loadRequest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, requestId]);

  // Update time remaining
  useEffect(() => {
    if (!request) return;

    const updateTimer = () => {
      const remaining = new Date(request.expiresAt).getTime() - Date.now();
      setTimeRemaining(Math.max(0, remaining));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [request]);

  const handleApprove = async () => {
    if (!request) return;

    setSubmitting(true);
    setError(null);

    try {
      await onApprove(request.id, comment || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!request || !reason.trim()) {
      setError('Rejection reason is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onReject(request.id, reason, comment || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!request || !reason.trim()) {
      setError('Cancellation reason is required');
      return;
    }

    if (!onCancel) return;

    setSubmitting(true);
    setError(null);

    try {
      await onCancel(request.id, reason);
      setShowCancelDialog(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeRemaining = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getUrgencyClass = (): string => {
    if (timeRemaining < 15 * 60 * 1000) return 'urgent'; // < 15 min
    if (timeRemaining < 60 * 60 * 1000) return 'warning'; // < 1 hour
    return 'normal';
  };

  const getUrgencyColor = (): string => {
    const urgency = getUrgencyClass();
    if (urgency === 'urgent') return 'text-red-600 bg-red-50';
    if (urgency === 'warning') return 'text-yellow-600 bg-yellow-50';
    return 'text-blue-600 bg-blue-50';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-200">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">
                Approval Request
              </h2>
              {request && (
                <p className="mt-1 text-sm text-gray-500">
                  {request.workflowId} • {request.jobId}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-500"
              disabled={submitting}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-240px)]">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
              </div>
            )}

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            {request && (
              <div className="space-y-6">
                {/* Status Banner */}
                {request.status !== ApprovalStatus.PENDING && (
                  <div className={`p-4 rounded-lg ${
                    request.status === ApprovalStatus.APPROVED 
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center">
                      {request.status === ApprovalStatus.APPROVED ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 mr-2" />
                      )}
                      <span className={`font-medium ${
                        request.status === ApprovalStatus.APPROVED 
                          ? 'text-green-900' 
                          : 'text-red-900'
                      }`}>
                        This request has been {request.status}
                      </span>
                    </div>
                    {request.decidedBy && (
                      <p className="mt-1 text-sm text-gray-600">
                        by {request.decidedBy} on {new Date(request.decidedAt!).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Time Remaining */}
                {request.status === ApprovalStatus.PENDING && (
                  <div className={`p-4 rounded-lg border ${getUrgencyColor()}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Clock className="w-5 h-5 mr-2" />
                        <span className="font-medium">
                          {timeRemaining > 0 ? 'Time Remaining' : 'Expired'}
                        </span>
                      </div>
                      <span className="text-lg font-bold">
                        {timeRemaining > 0 ? formatTimeRemaining(timeRemaining) : '0s'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">
                      Expires at {new Date(request.expiresAt).toLocaleString()}
                    </p>
                    {getUrgencyClass() === 'urgent' && (
                      <p className="mt-1 text-sm font-medium">
                        ⚠️ This request is expiring soon and requires immediate attention
                      </p>
                    )}
                  </div>
                )}

                {/* Title & Description */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {request.title}
                  </h3>
                  {request.description && (
                    <p className="mt-2 text-gray-700 whitespace-pre-wrap">
                      {request.description}
                    </p>
                  )}
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center text-sm text-gray-500 mb-1">
                      <User className="w-4 h-4 mr-1" />
                      Requested By
                    </div>
                    <p className="font-medium text-gray-900">{request.requestedBy}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center text-sm text-gray-500 mb-1">
                      <Clock className="w-4 h-4 mr-1" />
                      Requested At
                    </div>
                    <p className="font-medium text-gray-900">
                      {new Date(request.requestedAt).toLocaleString()}
                    </p>
                  </div>

                  {request.requireMinApprovers > 1 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <Users className="w-4 h-4 mr-1" />
                        Approvers
                      </div>
                      <p className="font-medium text-gray-900">
                        {request.approvers.length} / {request.requireMinApprovers} required
                      </p>
                      {request.approvers.length > 0 && (
                        <p className="text-sm text-gray-600 mt-1">
                          {request.approvers.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {request.notifyUsers.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <Users className="w-4 h-4 mr-1" />
                        Notified Users
                      </div>
                      <p className="font-medium text-gray-900">
                        {request.notifyUsers.length} user(s)
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {request.notifyUsers.slice(0, 3).join(', ')}
                        {request.notifyUsers.length > 3 && ` +${request.notifyUsers.length - 3} more`}
                      </p>
                    </div>
                  )}
                </div>

                {/* Context */}
                {Object.keys(request.context).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Additional Context</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <pre className="text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(request.context, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Decision History */}
                {request.comment && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">Comment</p>
                        <p className="text-sm text-blue-800 mt-1 whitespace-pre-wrap">
                          {request.comment}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Decision Form - Only show if pending */}
                {request.status === ApprovalStatus.PENDING && timeRemaining > 0 && (
                  <div className="space-y-4 border-t border-gray-200 pt-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Comment (Optional)
                      </label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Add any comments about your decision..."
                        disabled={submitting}
                      />
                    </div>

                    {!showCancelDialog && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Reason for Rejection (Required if rejecting)
                        </label>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          placeholder="Provide a reason if rejecting this request..."
                          disabled={submitting}
                        />
                      </div>
                    )}

                    {showCancelDialog && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-yellow-900 mb-2">
                          Are you sure you want to cancel this approval request?
                        </p>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent mb-3"
                          placeholder="Provide a reason for cancellation..."
                          disabled={submitting}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleCancelRequest}
                            disabled={submitting || !reason.trim()}
                            className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                          >
                            {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
                          </button>
                          <button
                            onClick={() => {
                              setShowCancelDialog(false);
                              setReason('');
                            }}
                            disabled={submitting}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium"
                          >
                            Keep Request
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer - Only show if pending */}
          {request && request.status === ApprovalStatus.PENDING && timeRemaining > 0 && !showCancelDialog && (
            <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-2">
                {onCancel && (
                  <button
                    onClick={() => setShowCancelDialog(true)}
                    disabled={submitting}
                    className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50"
                  >
                    Cancel Request
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={submitting}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {submitting ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {submitting ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          )}

          {/* Footer - Closed status */}
          {request && request.status !== ApprovalStatus.PENDING && (
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
