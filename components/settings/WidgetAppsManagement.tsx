/**
 * Widget Apps Management Component
 * Manage embeddable widget applications and their tokens
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Code, Plus, Trash2, Copy, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WidgetApp {
  id: string;
  name: string;
  description: string | null;
  token_prefix: string;
  allowed_origins: string[];
  is_active: boolean;
  total_events: number;
  last_event_at: string | null;
  created_at: string;
}

interface WidgetAppsManagementProps {
  userId: string;
  sessionToken: string;
}

export function WidgetAppsManagement({ userId, sessionToken }: WidgetAppsManagementProps) {
  const [apps, setApps] = useState<WidgetApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  console.log('[WidgetAppsManagement] Render:', { userId, appsCount: apps.length });

  useEffect(() => {
    fetchApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sessionToken]);

  async function fetchApps() {
    console.log('[WidgetAppsManagement] Fetching widget apps...');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/widget-apps', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch widget apps: ${response.status}`);
      }

      const data = await response.json();
      console.log('[WidgetAppsManagement] Fetched apps:', data.count);
      setApps(data.apps || []);
    } catch (err) {
      console.error('[WidgetAppsManagement] Error fetching apps:', err);
      setError(err instanceof Error ? err.message : 'Failed to load widget apps');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteApp(id: string, name: string) {
    console.log('[WidgetAppsManagement] Delete app:', id);

    if (!confirm(`Delete widget app "${name}"? This will also delete all associated events and sessions. This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/widget-apps/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete app');
      }

      console.log('[WidgetAppsManagement] App deleted successfully');
      setApps(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('[WidgetAppsManagement] Delete failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete app');
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Embeddable Widget Apps</h2>
          <p className="text-xs text-muted-foreground">
            LLMOps tracking widget applications
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddDialog(true)}
          disabled={loading}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New App
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div>
              <p className="font-medium">Error loading widget apps</p>
              <p className="text-sm mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchApps}
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
            <p className="text-muted-foreground">Loading widget apps...</p>
          </div>
        </div>
      )}

      {/* Apps List */}
      {!loading && apps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {apps.map((app) => (
            <WidgetAppCard
              key={app.id}
              app={app}
              onDelete={(id, name) => handleDeleteApp(id, name)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && apps.length === 0 && !error && (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Code className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No widget apps yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first app to start tracking LLM events with our embeddable widget
          </p>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First App
          </Button>
        </div>
      )}

      {/* Add Dialog */}
      {showAddDialog && (
        <AddWidgetAppDialog
          sessionToken={sessionToken}
          onClose={() => setShowAddDialog(false)}
          onSuccess={() => {
            setShowAddDialog(false);
            fetchApps();
          }}
        />
      )}
    </div>
  );
}

// Widget App Card Component
interface WidgetAppCardProps {
  app: WidgetApp;
  onDelete: (id: string, name: string) => void;
}

function WidgetAppCard({ app, onDelete }: WidgetAppCardProps) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(app.id);
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

  const embedCode = `<!-- LLMOps Widget -->
<script>
!function(w,d,s,u,i){w[i]=w[i]||function(){(w[i].q=w[i].q||[]).push(arguments)};
  var js=d.createElement(s);js.async=1;js.src=u;d.head.appendChild(js);
}(window,document,'script','https://cdn.yourdomain.com/llmops.min.js','LLMOps');

LLMOps('init', {
  appId: '${app.id}',
  endpoint: 'https://yourdomain.com/api/v1/ingest',
  token: '${app.token_prefix}•••••••',
  flushIntervalMs: 1500,
  maxBatch: 50
});
</script>`;

  return (
    <div className="border border-border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="p-1.5 bg-primary/10 rounded-md flex-shrink-0">
            <Code className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm truncate">{app.name}</h3>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                app.is_active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
              }`}>
                <span className={`h-1 w-1 rounded-full ${
                  app.is_active ? 'bg-green-600 dark:bg-green-400' : 'bg-gray-600 dark:bg-gray-400'
                }`}></span>
                {app.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            {/* App ID */}
            <div className="flex items-center gap-1 mt-1">
              <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded truncate max-w-[180px]">
                {app.id}
              </code>
              <button
                onClick={handleCopyId}
                className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                title="Copy app ID"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            </div>
            {/* Stats */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1.5">
              <span><span className="font-medium text-foreground">{app.total_events.toLocaleString()}</span> events</span>
              <span>Last: {formatDate(app.last_event_at)}</span>
            </div>
            {/* Embed Code Toggle */}
            <button
              onClick={() => setShowCode(!showCode)}
              className="text-[11px] text-primary hover:underline mt-1.5 flex items-center gap-1"
            >
              {showCode ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showCode ? 'Hide' : 'Show'} embed code
            </button>

            {showCode && (
              <div className="mt-2">
                <pre className="bg-muted p-2 rounded text-[10px] overflow-x-auto border border-border max-h-32">
                  <code>{embedCode}</code>
                </pre>
                <button
                  onClick={() => navigator.clipboard.writeText(embedCode)}
                  className="text-[11px] text-primary hover:underline mt-1 flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copy code
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {app.is_active && (
          <button
            onClick={() => onDelete(app.id, app.name)}
            className="p-1.5 hover:bg-destructive/10 rounded transition-colors text-destructive flex-shrink-0"
            title="Delete app"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// Add Widget App Dialog (similar structure to API keys)
interface AddWidgetAppDialogProps {
  sessionToken: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddWidgetAppDialog({ sessionToken, onClose, onSuccess }: AddWidgetAppDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [origins, setOrigins] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdApp, setCreatedApp] = useState<{ id: string; token: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/widget-apps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          allowed_origins: origins.split(',').map(o => o.trim()).filter(Boolean),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create app');
      }

      setCreatedApp(data.app);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create app');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (createdApp) {
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
        className="bg-background rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-semibold">
            {createdApp ? 'Widget App Created' : 'Create Widget App'}
          </h2>
        </div>

        <div className="p-6">
          {!createdApp ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">App Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Production Website, Mobile App"
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border rounded-md"
                  rows={2}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Allowed Origins</label>
                <input
                  type="text"
                  value={origins}
                  onChange={(e) => setOrigins(e.target.value)}
                  placeholder="https://example.com, https://app.example.com (comma-separated)"
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to allow all origins, or use * for wildcard
                </p>
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !name.trim()}>
                  {submitting ? 'Creating...' : 'Create App'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="font-medium text-sm mb-1">Save your token now!</p>
                <p className="text-xs">This is the only time you&apos;ll see the full token.</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">App ID</label>
                <code className="block text-sm font-mono bg-muted px-3 py-2 rounded border">
                  {createdApp.id}
                </code>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Token</label>
                <code className="block text-sm font-mono bg-muted px-3 py-2 rounded border">
                  {createdApp.token}
                </code>
              </div>

              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
