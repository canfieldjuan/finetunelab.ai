'use client';

/**
 * API Keys Management Component
 * Manages API keys for batch testing and model training
 * Date: 2025-10-17
 *
 * Features:
 * - List user's API keys with usage stats
 * - Generate new API keys
 * - Revoke/delete API keys
 * - Copy to clipboard
 * - Show key preview (masked)
 */

import React, { useEffect, useState } from 'react';
import { Key, Plus, Trash2, Copy, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  request_count: number;
  last_used_at: string | null;
  created_at: string;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Testing & Training API Keys</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage API keys for batch testing and model training workflows
          </p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          disabled={loading}
        >
          <Plus className="h-4 w-4 mr-2" />
          Generate New Key
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
        <div className="space-y-3">
          {apiKeys.map((key) => (
            <ApiKeyCard
              key={key.id}
              apiKey={key}
              onDelete={(id, name) => handleDeleteKey(id, name)}
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
    </div>
  );
}

// ============================================================================
// API Key Card Component
// ============================================================================

interface ApiKeyCardProps {
  apiKey: ApiKey;
  onDelete: (id: string, name: string) => void;
}

function ApiKeyCard({ apiKey, onDelete }: ApiKeyCardProps) {
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 bg-primary/10 rounded-md">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{apiKey.name}</h3>
            <div className="mt-2 space-y-2">
              {/* Key Preview */}
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-muted px-3 py-1.5 rounded border border-border">
                  {apiKey.key_prefix}•••••••••••••••••
                </code>
                <button
                  onClick={handleCopy}
                  className="p-1.5 hover:bg-muted rounded transition-colors"
                  title="Copy key prefix"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{apiKey.request_count.toLocaleString()}</span>
                  <span>requests</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Last used:</span>
                  <span className="font-medium text-foreground">{formatDate(apiKey.last_used_at)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium text-foreground">{formatDate(apiKey.created_at)}</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                  apiKey.is_active
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    apiKey.is_active ? 'bg-green-600 dark:bg-green-400' : 'bg-gray-600 dark:bg-gray-400'
                  }`}></span>
                  {apiKey.is_active ? 'Active' : 'Revoked'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {apiKey.is_active && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(apiKey.id, apiKey.name)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    console.log('[AddApiKeyDialog] Creating API key:', name);
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name: name.trim() }),
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
