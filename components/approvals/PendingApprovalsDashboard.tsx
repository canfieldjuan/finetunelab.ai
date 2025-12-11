'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { ApprovalModal } from './ApprovalModal';
import type { ApprovalRequest, ApprovalStatus } from '@/lib/training/types/approval-types';

interface ApprovalListItem {
  id: string;
  title: string;
  description: string | null;
  workflowId: string;
  jobId: string;
  requestedBy: string;
  requestedByName?: string;
  createdAt: Date;
  expiresAt: Date | null;
  status: ApprovalStatus;
  urgency: 'high' | 'medium' | 'low';
  requireMinApprovers?: number;
  currentApprovers?: number;
}

interface FilterOptions {
  status: ApprovalStatus | 'all';
  urgency: 'all' | 'high' | 'medium' | 'low';
  workflow: string;
  requester: string;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

type SortField = 'urgency' | 'created' | 'expires' | 'title';
type SortDirection = 'asc' | 'desc';

export function PendingApprovalsDashboard() {
  const [approvals, setApprovals] = useState<ApprovalListItem[]>([]);
  const [filteredApprovals, setFilteredApprovals] = useState<ApprovalListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filters and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'pending' as ApprovalStatus,
    urgency: 'all',
    workflow: '',
    requester: '',
    dateRange: { start: null, end: null },
  });
  const [sortField, setSortField] = useState<SortField>('urgency');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Load approvals
  const loadApprovals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/approvals/pending');
      
      if (!response.ok) {
        throw new Error(`Failed to load approvals: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Map to list items with urgency calculation
      const items: ApprovalListItem[] = data.approvals.map((approval: ApprovalRequest) => ({
        id: approval.id,
        title: approval.title,
        description: approval.description,
        workflowId: approval.workflowId,
        jobId: approval.jobId,
        requestedBy: approval.requestedBy,
        requestedByName: approval.metadata?.requesterName,
        createdAt: new Date(approval.createdAt),
        expiresAt: approval.expiresAt ? new Date(approval.expiresAt) : null,
        status: approval.status,
        urgency: calculateUrgency(approval.expiresAt),
        requireMinApprovers: approval.requireMinApprovers,
        currentApprovers: approval.metadata?.currentApprovers || 0,
      }));
      
      setApprovals(items);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading approvals:', err);
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Calculate urgency based on time remaining
  const calculateUrgency = (expiresAt: Date | string | null): 'high' | 'medium' | 'low' => {
    if (!expiresAt) return 'low';
    
    const expires = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    const now = new Date();
    const minutesRemaining = (expires.getTime() - now.getTime()) / 1000 / 60;
    
    if (minutesRemaining < 15) return 'high';
    if (minutesRemaining < 60) return 'medium';
    return 'low';
  };

  // Filter and sort approvals
  useEffect(() => {
    let filtered = [...approvals];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.description?.toLowerCase().includes(query) ||
          a.workflowId.toLowerCase().includes(query) ||
          a.requestedByName?.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter((a) => a.status === filters.status);
    }
    
    // Urgency filter
    if (filters.urgency !== 'all') {
      filtered = filtered.filter((a) => a.urgency === filters.urgency);
    }
    
    // Workflow filter
    if (filters.workflow) {
      filtered = filtered.filter((a) => a.workflowId.includes(filters.workflow));
    }
    
    // Requester filter
    if (filters.requester) {
      filtered = filtered.filter(
        (a) =>
          a.requestedBy.includes(filters.requester) ||
          a.requestedByName?.includes(filters.requester)
      );
    }
    
    // Date range filter
    if (filters.dateRange.start) {
      filtered = filtered.filter((a) => a.createdAt >= filters.dateRange.start!);
    }
    if (filters.dateRange.end) {
      filtered = filtered.filter((a) => a.createdAt <= filters.dateRange.end!);
    }
    
    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'urgency': {
          const urgencyOrder = { high: 3, medium: 2, low: 1 };
          comparison = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
          break;
        }
        case 'created':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'expires':
          if (!a.expiresAt && !b.expiresAt) comparison = 0;
          else if (!a.expiresAt) comparison = 1;
          else if (!b.expiresAt) comparison = -1;
          else comparison = a.expiresAt.getTime() - b.expiresAt.getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    setFilteredApprovals(filtered);
  }, [approvals, searchQuery, filters, sortField, sortDirection]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadApprovals();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh, loadApprovals]);

  // Initial load
  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  // Handle approval decision
  const handleApprovalDecision = useCallback(async () => {
    setSelectedApproval(null);
    await loadApprovals(); // Reload list
  }, [loadApprovals]);

  // Bulk selection
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredApprovals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApprovals.map((a) => a.id)));
    }
  };

  // Urgency badge component
  const UrgencyBadge = ({ urgency }: { urgency: 'high' | 'medium' | 'low' }) => {
    const colors = {
      high: 'bg-red-100 text-red-800 border-red-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-green-100 text-green-800 border-green-300',
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${colors[urgency]}`}>
        {urgency.toUpperCase()}
      </span>
    );
  };

  // Time remaining display
  const TimeRemaining = ({ expiresAt }: { expiresAt: Date | null }) => {
    if (!expiresAt) return <span className="text-sm text-gray-500">No deadline</span>;
    
    const now = new Date();
    const remaining = expiresAt.getTime() - now.getTime();
    
    if (remaining < 0) {
      return <span className="text-sm text-red-600 font-medium">Expired</span>;
    }
    
    const minutes = Math.floor(remaining / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    let display = '';
    if (days > 0) display = `${days}d ${hours % 24}h`;
    else if (hours > 0) display = `${hours}h ${minutes % 60}m`;
    else display = `${minutes}m`;
    
    return (
      <span className="text-sm text-gray-700 flex items-center gap-1">
        <Clock className="w-4 h-4" />
        {display}
      </span>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pending Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              autoRefresh
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-gray-50 border-gray-300 text-gray-700'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh
          </button>
          
          {/* Manual refresh */}
          <button
            onClick={loadApprovals}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
              placeholder="Search by title, workflow, or requester..."
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
          
          {/* Sort */}
          <select
            value={`${sortField}-${sortDirection}`}
            onChange={(e) => {
              const [field, direction] = e.target.value.split('-');
              setSortField(field as SortField);
              setSortDirection(direction as SortDirection);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="urgency-desc">Urgency (High to Low)</option>
            <option value="urgency-asc">Urgency (Low to High)</option>
            <option value="created-desc">Newest First</option>
            <option value="created-asc">Oldest First</option>
            <option value="expires-asc">Expires Soon</option>
            <option value="expires-desc">Expires Later</option>
            <option value="title-asc">Title (A-Z)</option>
            <option value="title-desc">Title (Z-A)</option>
          </select>
        </div>
        
        {/* Filter panel */}
        {showFilters && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
                <select
                  value={filters.urgency}
                  onChange={(e) => setFilters({ ...filters, urgency: e.target.value as 'all' | 'high' | 'medium' | 'low' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">All</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
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
            </div>
            
            <button
              onClick={() => {
                setFilters({
                  status: 'pending' as ApprovalStatus,
                  urgency: 'all',
                  workflow: '',
                  requester: '',
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

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size} approval{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => console.log('Bulk approve:', Array.from(selectedIds))}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              <CheckCircle className="w-4 h-4" />
              Approve Selected
            </button>
            <button
              onClick={() => console.log('Bulk reject:', Array.from(selectedIds))}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              <XCircle className="w-4 h-4" />
              Reject Selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Results summary */}
      <div className="text-sm text-gray-600">
        Showing {filteredApprovals.length} of {approvals.length} approval{approvals.length !== 1 ? 's' : ''}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-900">Error loading approvals</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && approvals.length === 0 && (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading approvals...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredApprovals.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No approvals found</h3>
          <p className="text-gray-500">
            {approvals.length === 0
              ? 'All caught up! No pending approvals at the moment.'
              : 'Try adjusting your search or filters.'}
          </p>
        </div>
      )}

      {/* Approvals list */}
      {filteredApprovals.length > 0 && (
        <div className="space-y-3">
          {/* Select all */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredApprovals.length}
              onChange={selectAll}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Select all</span>
          </div>
          
          {filteredApprovals.map((approval) => (
            <div
              key={approval.id}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(approval.id)}
                  onChange={() => toggleSelection(approval.id)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 mt-1"
                />
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{approval.title}</h3>
                      {approval.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{approval.description}</p>
                      )}
                    </div>
                    <UrgencyBadge urgency={approval.urgency} />
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <WorkflowIcon className="w-4 h-4" />
                      <span>{approval.workflowId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>{approval.requestedByName || approval.requestedBy}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{approval.createdAt.toLocaleDateString()}</span>
                    </div>
                    <TimeRemaining expiresAt={approval.expiresAt} />
                  </div>
                  
                  {approval.requireMinApprovers && approval.requireMinApprovers > 1 && (
                    <div className="mt-2 text-sm text-gray-600">
                      Requires {approval.currentApprovers || 0} of {approval.requireMinApprovers} approvals
                    </div>
                  )}
                </div>
                
                {/* Actions */}
                <button
                  onClick={() => setSelectedApproval(approval.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
                >
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approval Modal */}
      {selectedApproval && (
        <ApprovalModal
          requestId={selectedApproval}
          isOpen={true}
          onClose={() => setSelectedApproval(null)}
          onApprove={async () => handleApprovalDecision()}
          onReject={async () => handleApprovalDecision()}
        />
      )}
    </div>
  );
}
