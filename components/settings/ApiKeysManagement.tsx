'use client';

/**
 * API Keys Management Component
 * Manages API keys for batch testing and model training
 * Date: 2025-10-17
 * Updated: 2025-12-12 - Added scopes selection
 *
 * Features:
 * - List user's API keys with usage stats
 * - Generate new API keys with scope selection
 * - Revoke/delete API keys
 * - Copy to clipboard
 * - Show key preview (masked)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Key, Plus, Trash2, Copy, Check, AlertCircle, Shield, Beaker, Activity, Zap, BarChart3, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ApiKeyScope = 'all' | 'training' | 'production' | 'testing';

const SCOPE_CONFIG: Record<ApiKeyScope, { label: string; description: string; icon: React.ElementType; color: string }> = {
  all: {
    label: 'All Access',
    description: 'Full access to all endpoints',
    icon: Shield,
    color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
  },
  training: {
    label: 'Training',
    description: 'Training metrics & predictions',
    icon: Zap,
    color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
  },
  production: {
    label: 'Production',
    description: 'Monitoring, traces & inference',
    icon: Activity,
    color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
  },
  testing: {
    label: 'Testing',
    description: 'Batch testing & evaluation',
    icon: Beaker,
    color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
  },
};

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  request_count: number;
  last_used_at: string | null;
  created_at: string;
  scopes: ApiKeyScope[];
}

interface ApiKeysManagementProps {
  userId: string;
  sessionToken: string;
}

export function ApiKeysManagement({ userId, sessionToken }: ApiKeysManagementProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedKeyForUsage, setSelectedKeyForUsage] = useState<ApiKey | null>(null);

  console.log('[ApiKeysManagement] Render:', { userId, keysCount: apiKeys.length });

  useEffect(() => {
    fetchApiKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sessionToken]);

  async function fetchApiKeys() {
    console.log('[ApiKeysManagement] Fetching API keys...');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/api-keys', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch API keys: ${response.status}`);
      }

      const data = await response.json();
      console.log('[ApiKeysManagement] Fetched keys:', data.count);
      setApiKeys(data.apiKeys || []);
    } catch (err) {
      console.error('[ApiKeysManagement] Error fetching keys:', err);
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteKey(id: string, name: string) {
    console.log('[ApiKeysManagement] Delete key:', id);

    if (!confirm(`Revoke API key "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/user/api-keys/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to revoke key');
      }

      console.log('[ApiKeysManagement] Key revoked successfully');
      setApiKeys(prev => prev.filter(k => k.id !== id));
    } catch (err) {
      console.error('[ApiKeysManagement] Delete failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Testing & Training API Keys</h2>
          <p className="text-xs text-muted-foreground">
            API keys for batch testing and training
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddDialog(true)}
          disabled={loading}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Key
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div>
              <p className="font-medium">Error loading API keys</p>
              <p className="text-sm mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchApiKeys}
                className="mt-3"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-muted-foreground">Loading API keys...</p>
          </div>
        </div>
      )}

      {/* API Keys List */}
      {!loading && apiKeys.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {apiKeys.map((key) => (
            <ApiKeyCard
              key={key.id}
              apiKey={key}
              onDelete={(id, name) => handleDeleteKey(id, name)}
              onViewUsage={() => setSelectedKeyForUsage(key)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && apiKeys.length === 0 && !error && (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No API keys yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate your first API key to start batch testing and training models
          </p>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Your First Key
          </Button>
        </div>
      )}

      {/* Add Dialog */}
      {showAddDialog && (
        <AddApiKeyDialog
          sessionToken={sessionToken}
          onClose={() => setShowAddDialog(false)}
          onSuccess={() => {
            setShowAddDialog(false);
            fetchApiKeys();
          }}
        />
      )}

      {/* Usage Modal */}
      {selectedKeyForUsage && (
        <ApiKeyUsageModal
          apiKey={selectedKeyForUsage}
          sessionToken={sessionToken}
          onClose={() => setSelectedKeyForUsage(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// API Key Card Component
// ============================================================================

interface ApiKeyCardProps {
  apiKey: ApiKey;
  onDelete: (id: string, name: string) => void;
  onViewUsage: () => void;
}

function ApiKeyCard({ apiKey, onDelete, onViewUsage }: ApiKeyCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey.key_prefix);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="border border-border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="p-1.5 bg-primary/10 rounded-md flex-shrink-0">
            <Key className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm truncate">{apiKey.name}</h3>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                apiKey.is_active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
              }`}>
                <span className={`h-1 w-1 rounded-full ${
                  apiKey.is_active ? 'bg-green-600 dark:bg-green-400' : 'bg-gray-600 dark:bg-gray-400'
                }`}></span>
                {apiKey.is_active ? 'Active' : 'Revoked'}
              </span>
            </div>
            {/* Key Preview */}
            <div className="flex items-center gap-1 mt-1">
              <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded truncate">
                {apiKey.key_prefix}•••••
              </code>
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                title="Copy key prefix"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            </div>
            {/* Scopes */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(apiKey.scopes || ['all']).map((scope) => {
                const config = SCOPE_CONFIG[scope];
                const Icon = config?.icon || Shield;
                return (
                  <span
                    key={scope}
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${config?.color || 'bg-gray-100 text-gray-600'}`}
                    title={config?.description}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {config?.label || scope}
                  </span>
                );
              })}
            </div>
            {/* Stats */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
              <span><span className="font-medium text-foreground">{apiKey.request_count.toLocaleString()}</span> requests</span>
              <span>Last: {formatDate(apiKey.last_used_at)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={onViewUsage}
            className="p-1.5 hover:bg-primary/10 rounded transition-colors text-primary"
            title="View usage"
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
          {apiKey.is_active && (
            <button
              onClick={() => onDelete(apiKey.id, apiKey.name)}
              className="p-1.5 hover:bg-destructive/10 rounded transition-colors text-destructive"
              title="Revoke key"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Add API Key Dialog Component
// ============================================================================

interface AddApiKeyDialogProps {
  sessionToken: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddApiKeyDialog({ sessionToken, onClose, onSuccess }: AddApiKeyDialogProps) {
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>(['all']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleScope = (scope: ApiKeyScope) => {
    if (scope === 'all') {
      // If selecting 'all', clear other selections
      setSelectedScopes(['all']);
    } else {
      // If selecting a specific scope, remove 'all'
      const newScopes = selectedScopes.filter(s => s !== 'all');
      if (newScopes.includes(scope)) {
        // Remove the scope
        const filtered = newScopes.filter(s => s !== scope);
        // If no scopes left, default to 'all'
        setSelectedScopes(filtered.length > 0 ? filtered : ['all']);
      } else {
        // Add the scope
        setSelectedScopes([...newScopes, scope]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    console.log('[AddApiKeyDialog] Creating API key:', name, 'scopes:', selectedScopes);
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name: name.trim(), scopes: selectedScopes }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create API key');
      }

      console.log('[AddApiKeyDialog] API key created successfully');
      setCreatedKey(data.apiKey.key);
    } catch (err) {
      console.error('[AddApiKeyDialog] Create failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    if (createdKey) {
      onSuccess();
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div
        className="bg-background rounded-lg shadow-lg max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {createdKey ? 'API Key Created' : 'Generate New API Key'}
          </h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <Key className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!createdKey ? (
            // Step 1: Create key form
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Key Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Production Widget, Staging Environment"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={submitting}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Choose a descriptive name to identify where this key will be used
                </p>
              </div>

              {/* Scope Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Access Scopes
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  Select which services this API key can access
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(SCOPE_CONFIG) as ApiKeyScope[]).map((scope) => {
                    const config = SCOPE_CONFIG[scope];
                    const Icon = config.icon;
                    const isSelected = selectedScopes.includes(scope);

                    return (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => toggleScope(scope)}
                        disabled={submitting}
                        className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className={`p-1.5 rounded ${config.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{config.label}</span>
                            {isSelected && (
                              <Check className="h-3.5 w-3.5 text-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {config.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md border border-destructive/20 text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !name.trim()}
                >
                  {submitting ? 'Generating...' : 'Generate Key'}
                </Button>
              </div>
            </form>
          ) : (
            // Step 2: Display created key
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-900 dark:text-yellow-200 mb-1">
                      Save this key now!
                    </p>
                    <p className="text-yellow-800 dark:text-yellow-300">
                      This is the only time you&apos;ll see the full key. Make sure to copy and store it securely.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Your API Key
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded border border-border overflow-x-auto">
                    {createdKey}
                  </code>
                  <Button
                    onClick={handleCopy}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-muted/50 rounded-md p-4 text-sm space-y-2">
                <p className="font-medium">Next steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Copy the API key above</li>
                  <li>Store it securely (e.g., environment variables)</li>
                  <li>Use it for batch testing and training workflows</li>
                  <li>Configure CORS settings if needed</li>
                </ol>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// API Key Usage Modal Component
// ============================================================================

interface UsageLog {
  id: string;
  endpoint: string;
  method: string;
  scope_used: string | null;
  request_ts: string;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  model_id: string | null;
  model_provider: string | null;
  status: string;
  status_code: number | null;
  error_type: string | null;
  error_message: string | null;
}

interface UsageSummary {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

interface ApiKeyUsageModalProps {
  apiKey: ApiKey;
  sessionToken: string;
  onClose: () => void;
}

function ApiKeyUsageModal({ apiKey, sessionToken, onClose }: ApiKeyUsageModalProps) {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  const fetchUsage = useCallback(async (offset: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/user/api-keys/${apiKey.id}/usage?limit=${limit}&offset=${offset}`,
        {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch usage data');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setSummary(data.summary || null);
      setTotalCount(data.count || 0);
    } catch (err) {
      console.error('[ApiKeyUsageModal] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }, [apiKey.id, sessionToken]);

  useEffect(() => {
    fetchUsage(page * limit);
  }, [fetchUsage, page]);

  const totalPages = Math.ceil(totalCount / limit);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold">API Key Usage</h2>
            <p className="text-sm text-muted-foreground">{apiKey.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={() => fetchUsage(page * limit)} className="mt-2">
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Summary Stats */}
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-2xl font-bold">{summary.total_requests.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Requests</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-green-600">
                      {summary.total_requests > 0
                        ? Math.round((summary.successful_requests / summary.total_requests) * 100)
                        : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">Success Rate</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-2xl font-bold">{summary.avg_latency_ms.toLocaleString()}ms</p>
                    <p className="text-xs text-muted-foreground">Avg Latency</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-2xl font-bold">
                      {(summary.total_input_tokens + summary.total_output_tokens).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Tokens</p>
                  </div>
                </div>
              )}

              {/* Usage Logs Table */}
              {logs.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Endpoint</th>
                        <th className="text-left px-4 py-2 font-medium">Time</th>
                        <th className="text-left px-4 py-2 font-medium">Status</th>
                        <th className="text-right px-4 py-2 font-medium">Latency</th>
                        <th className="text-right px-4 py-2 font-medium">Tokens</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {log.method} {log.endpoint}
                            </code>
                            {log.model_id && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({log.model_id})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {formatDate(log.request_ts)}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              log.status === 'success'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {log.status}
                              {log.status_code && ` (${log.status_code})`}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            {log.latency_ms != null ? `${log.latency_ms}ms` : '-'}
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            {(log.input_tokens || log.output_tokens)
                              ? `${(log.input_tokens || 0) + (log.output_tokens || 0)}`
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No usage data yet</p>
                  <p className="text-xs mt-1">Usage will appear here as the API key is used</p>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * limit + 1}-{Math.min((page + 1) * limit, totalCount)} of {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p - 1)}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}