'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Workflow as WorkflowIcon,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import type { ApprovalRequest, ApprovalStatus } from '@/lib/training/types/approval-types';

interface ApprovalHistoryItem {
  id: string;
  title: string;
  description: string | null;
  workflowId: string;
  jobId: string;
  requestedBy: string;
  requestedByName?: string;
  createdAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
  decidedByName?: string | null;
  status: ApprovalStatus;
  decision: 'approved' | 'rejected' | 'expired' | 'cancelled' | null;
  comment: string | null;
  reason: string | null;
  decisionTimeMs: number | null;
}

interface FilterOptions {
  status: ApprovalStatus | 'all';
  decision: 'all' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  workflow: string;
  requester: string;
  approver: string;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

interface Statistics {
  total: number;
  approved: number;
  rejected: number;
  expired: number;
  cancelled: number;
  approvalRate: number;
  avgDecisionTimeMs: number;
  fastestDecisionMs: number;
  slowestDecisionMs: number;
}

export function ApprovalHistoryViewer() {
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<ApprovalHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    decision: 'all',
    workflow: '',
    requester: '',
    approver: '',
    dateRange: { start: null, end: null },
  });
  
  // Statistics
  const [stats, setStats] = useState<Statistics>({
    total: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    cancelled: 0,
    approvalRate: 0,
    avgDecisionTimeMs: 0,
    fastestDecisionMs: 0,
    slowestDecisionMs: 0,
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Load history
  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/approvals/history');
      
      if (!response.ok) {
        throw new Error(`Failed to load history: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Map to history items
      const items: ApprovalHistoryItem[] = data.approvals.map((approval: ApprovalRequest) => ({
        id: approval.id,
        title: approval.title,
        description: approval.description,
        workflowId: approval.workflowId,
        jobId: approval.jobId,
        requestedBy: approval.requestedBy,
        requestedByName: approval.metadata?.requesterName,
        createdAt: new Date(approval.createdAt),
        decidedAt: approval.decidedAt ? new Date(approval.decidedAt) : null,
        decidedBy: approval.decidedBy || null,
        decidedByName: approval.metadata?.approverName,
        status: approval.status,
        decision: getDecision(approval.status),
        comment: approval.comment || null,
        reason: approval.reason || null,
        decisionTimeMs: approval.decidedAt
          ? new Date(approval.decidedAt).getTime() - new Date(approval.createdAt).getTime()
          : null,
      }));
      
      setHistory(items);
      calculateStatistics(items);
    } catch (err) {
      console.error('Error loading history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get decision from status
  const getDecision = (status: ApprovalStatus): 'approved' | 'rejected' | 'expired' | 'cancelled' | null => {
    if (status === 'approved') return 'approved';
    if (status === 'rejected') return 'rejected';
    if (status === 'cancelled') return 'cancelled';
    // Check if status string contains 'expired' for timeout cases
    if (status.toString().toLowerCase().includes('expired')) return 'expired';
    return null;
  };

  // Calculate statistics
  const calculateStatistics = (items: ApprovalHistoryItem[]) => {
    const total = items.length;
    const approved = items.filter((i) => i.decision === 'approved').length;
    const rejected = items.filter((i) => i.decision === 'rejected').length;
    const expired = items.filter((i) => i.decision === 'expired').length;
    const cancelled = items.filter((i) => i.decision === 'cancelled').length;
    
    const approvalRate = total > 0 ? (approved / total) * 100 : 0;
    
    const decisionTimes = items
      .filter((i) => i.decisionTimeMs !== null)
      .map((i) => i.decisionTimeMs!);
    
    const avgDecisionTimeMs =
      decisionTimes.length > 0
        ? decisionTimes.reduce((sum, time) => sum + time, 0) / decisionTimes.length
        : 0;
    
    const fastestDecisionMs = decisionTimes.length > 0 ? Math.min(...decisionTimes) : 0;
    const slowestDecisionMs = decisionTimes.length > 0 ? Math.max(...decisionTimes) : 0;
    
    setStats({
      total,
      approved,
      rejected,
      expired,
      cancelled,
      approvalRate,
      avgDecisionTimeMs,
      fastestDecisionMs,
      slowestDecisionMs,
    });
  };

  // Filter history
  useEffect(() => {
    let filtered = [...history];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (h) =>
          h.title.toLowerCase().includes(query) ||
          h.description?.toLowerCase().includes(query) ||
          h.workflowId.toLowerCase().includes(query) ||
          h.requestedByName?.toLowerCase().includes(query) ||
          h.decidedByName?.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter((h) => h.status === filters.status);
    }
    
    // Decision filter
    if (filters.decision !== 'all') {
      filtered = filtered.filter((h) => h.decision === filters.decision);
    }
    
    // Workflow filter
    if (filters.workflow) {
      filtered = filtered.filter((h) => h.workflowId.includes(filters.workflow));
    }
    
    // Requester filter
    if (filters.requester) {
      filtered = filtered.filter(
        (h) =>
          h.requestedBy.includes(filters.requester) ||
          h.requestedByName?.includes(filters.requester)
      );
    }
    
    // Approver filter
    if (filters.approver) {
      filtered = filtered.filter(
        (h) =>
          h.decidedBy?.includes(filters.approver) ||
          h.decidedByName?.includes(filters.approver)
      );
    }
    
    // Date range filter
    if (filters.dateRange.start) {
      filtered = filtered.filter((h) => h.createdAt >= filters.dateRange.start!);
    }
    if (filters.dateRange.end) {
      filtered = filtered.filter((h) => h.createdAt <= filters.dateRange.end!);
    }
    
    // Sort by created date (newest first)
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    setFilteredHistory(filtered);
    setCurrentPage(1); // Reset to first page
  }, [history, searchQuery, filters]);

  // Initial load
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'ID',
      'Title',
      'Workflow',
      'Job',
      'Requested By',
      'Created At',
      'Decision',
      'Decided By',
      'Decided At',
      'Decision Time (s)',
      'Comment',
      'Reason',
    ];
    
    const rows = filteredHistory.map((h) => [
      h.id,
      h.title,
      h.workflowId,
      h.jobId,
      h.requestedByName || h.requestedBy,
      h.createdAt.toISOString(),
      h.decision || 'pending',
      h.decidedByName || h.decidedBy || '',
      h.decidedAt?.toISOString() || '',
      h.decisionTimeMs ? (h.decisionTimeMs / 1000).toFixed(2) : '',
      h.comment || '',
      h.reason || '',
    ]);
    
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `approval-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Decision badge
  const DecisionBadge = ({ decision }: { decision: 'approved' | 'rejected' | 'expired' | 'cancelled' | null }) => {
    if (!decision) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full border bg-gray-100 text-gray-800 border-gray-300">
          PENDING
        </span>
      );
    }
    
    const config = {
      approved: { icon: CheckCircle, color: 'bg-green-100 text-green-800 border-green-300' },
      rejected: { icon: XCircle, color: 'bg-red-100 text-red-800 border-red-300' },
      expired: { icon: Clock, color: 'bg-orange-100 text-orange-800 border-orange-300' },
      cancelled: { icon: AlertTriangle, color: 'bg-gray-100 text-gray-800 border-gray-300' },
    };
    
    const { icon: Icon, color } = config[decision];
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border flex items-center gap-1 ${color}`}>
        <Icon className="w-3 h-3" />
        {decision.toUpperCase()}
      </span>
    );
  };

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredHistory.slice(startIndex, endIndex);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Approval History</h1>
          <p className="text-sm text-gray-500 mt-1">Complete audit trail of all approval requests</p>
        </div>
        
        <button
          onClick={exportToCSV}
          disabled={filteredHistory.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Total Requests</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Approval Rate</div>
          <div className="text-2xl font-bold text-green-600">{stats.approvalRate.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.approved} approved / {stats.rejected} rejected
          </div>
        </div>
        
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Avg Decision Time</div>
          <div className="text-2xl font-bold text-blue-600">
            {formatDuration(stats.avgDecisionTimeMs)}
          </div>
        </div>
        
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Decision Range</div>
          <div className="text-sm text-gray-900">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              {formatDuration(stats.fastestDecisionMs)}
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-red-600 transform rotate-180" />
              {formatDuration(stats.slowestDecisionMs)}
            </div>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, workflow, requester, or approver..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            <Filter className="w-4 h-4" />
            Filters
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Filter panel */}
        {showFilters && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value as ApprovalStatus | 'all' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Decision</label>
                <select
                  value={filters.decision}
                  onChange={(e) => setFilters({ ...filters, decision: e.target.value as 'all' | 'approved' | 'rejected' | 'expired' | 'cancelled' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">All</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workflow</label>
                <input
                  type="text"
                  value={filters.workflow}
                  onChange={(e) => setFilters({ ...filters, workflow: e.target.value })}
                  placeholder="Filter by workflow..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requester</label>
                <input
                  type="text"
                  value={filters.requester}
                  onChange={(e) => setFilters({ ...filters, requester: e.target.value })}
                  placeholder="Filter by requester..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Approver</label>
                <input
                  type="text"
                  value={filters.approver}
                  onChange={(e) => setFilters({ ...filters, approver: e.target.value })}
                  placeholder="Filter by approver..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            
            <button
              onClick={() => {
                setFilters({
                  status: 'all',
                  decision: 'all',
                  workflow: '',
                  requester: '',
                  approver: '',
                  dateRange: { start: null, end: null },
                });
                setSearchQuery('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Results summary */}
      <div className="text-sm text-gray-600">
        Showing {startIndex + 1}-{Math.min(endIndex, filteredHistory.length)} of {filteredHistory.length} requests
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-900">Error loading history</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && history.length === 0 && (
        <div className="text-center py-12">
          <Clock className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading history...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredHistory.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No history found</h3>
          <p className="text-gray-500">
            {history.length === 0
              ? 'No approval requests have been made yet.'
              : 'Try adjusting your search or filters.'}
          </p>
        </div>
      )}

      {/* History timeline */}
      {currentItems.length > 0 && (
        <div className="space-y-3">
          {currentItems.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              {/* Main info */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                    <DecisionBadge decision={item.decision} />
                  </div>
                  
                  {item.description && (
                    <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <WorkflowIcon className="w-4 h-4" />
                      <span>{item.workflowId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>{item.requestedByName || item.requestedBy}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{item.createdAt.toLocaleString()}</span>
                    </div>
                    {item.decisionTimeMs && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{formatDuration(item.decisionTimeMs)}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Expand button */}
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  {expandedId === item.id ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
              
              {/* Expanded details */}
              {expandedId === item.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                  {item.decidedBy && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Decision Details</div>
                      <div className="text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>Decided by: {item.decidedByName || item.decidedBy}</span>
                        </div>
                        {item.decidedAt && (
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar className="w-4 h-4" />
                            <span>Decided at: {item.decidedAt.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {item.comment && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Comment
                      </div>
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {item.comment}
                      </div>
                    </div>
                  )}
                  
                  {item.reason && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Reason
                      </div>
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {item.reason}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Request ID: {item.id}</span>
                    <span>•</span>
                    <span>Job ID: {item.jobId}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            Previous
          </button>
          
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
          
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
