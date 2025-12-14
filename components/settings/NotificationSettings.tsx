'use client';

/**
 * Notification Settings Component
 * Manages alert preferences and webhooks
 * Date: 2025-12-12
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Bell, Mail, Webhook, Plus, Trash2, TestTube, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AlertPreferences {
  id: string;
  email_enabled: boolean;
  email_address: string | null;
  alert_job_started: boolean;
  alert_job_completed: boolean;
  alert_job_failed: boolean;
  alert_job_cancelled: boolean;
  alert_batch_test_completed: boolean;
  alert_batch_test_failed: boolean;
  alert_gpu_oom: boolean;
  alert_disk_warning: boolean;
  alert_timeout_warning: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  timezone: string;
}

interface UserWebhook {
  id: string;
  name: string;
  url: string;
  webhook_type: 'slack' | 'discord' | 'generic';
  enabled: boolean;
  alert_job_started: boolean;
  alert_job_completed: boolean;
  alert_job_failed: boolean;
  alert_job_cancelled: boolean;
  alert_batch_test_completed: boolean;
  alert_batch_test_failed: boolean;
  alert_gpu_oom: boolean;
  last_success_at: string | null;
  last_failure_at: string | null;
  failure_count: number;
}

interface NotificationSettingsProps {
  sessionToken: string;
}

const ALERT_TYPES = [
  { key: 'alert_job_completed', label: 'Job Completed', description: 'When training finishes successfully' },
  { key: 'alert_job_failed', label: 'Job Failed', description: 'When training fails with an error' },
  { key: 'alert_gpu_oom', label: 'GPU Out of Memory', description: 'When CUDA runs out of memory' },
  { key: 'alert_batch_test_failed', label: 'Test Run Failed', description: 'When a batch test run fails (or has failed prompts)' },
  { key: 'alert_batch_test_completed', label: 'Test Run Completed', description: 'When a batch test run completes successfully' },
  { key: 'alert_job_started', label: 'Job Started', description: 'When training begins' },
  { key: 'alert_job_cancelled', label: 'Job Cancelled', description: 'When training is manually cancelled' },
  { key: 'alert_disk_warning', label: 'Disk Warning', description: 'When disk space is low' },
  { key: 'alert_timeout_warning', label: 'Timeout Warning', description: 'When no progress for extended time' },
] as const;

const WEBHOOK_TYPES = [
  { value: 'slack', label: 'Slack' },
  { value: 'discord', label: 'Discord' },
  { value: 'generic', label: 'Generic (JSON)' },
] as const;

export function NotificationSettings({ sessionToken }: NotificationSettingsProps) {
  const [preferences, setPreferences] = useState<AlertPreferences | null>(null);
  const [webhooks, setWebhooks] = useState<UserWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newWebhook, setNewWebhook] = useState<{ name: string; url: string; webhook_type: 'slack' | 'discord' | 'generic' }>({ name: '', url: '', webhook_type: 'slack' });
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'email' | 'webhooks' | null>('email');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [prefsRes, webhooksRes] = await Promise.all([
        fetch('/api/alerts/preferences', {
          headers: { 'Authorization': `Bearer ${sessionToken}` },
        }),
        fetch('/api/alerts/webhooks', {
          headers: { 'Authorization': `Bearer ${sessionToken}` },
        }),
      ]);

      if (prefsRes.ok) {
        const prefsData = await prefsRes.json();
        setPreferences(prefsData.preferences);
      }

      if (webhooksRes.ok) {
        const webhooksData = await webhooksRes.json();
        setWebhooks(webhooksData.webhooks || []);
      }
    } catch (err) {
      console.error('[NotificationSettings] Fetch error:', err);
      setError('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updatePreferences = async (updates: Partial<AlertPreferences>) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/alerts/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update preferences');

      const data = await response.json();
      setPreferences(data.preferences);
      setSuccess('Preferences saved');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const createWebhook = async () => {
    if (!newWebhook.name || !newWebhook.url) {
      setError('Name and URL are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/alerts/webhooks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newWebhook),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create webhook');
      }

      const data = await response.json();
      setWebhooks(prev => [...prev, data.webhook]);
      setNewWebhook({ name: '', url: '', webhook_type: 'slack' as const });
      setShowAddWebhook(false);
      setSuccess('Webhook created');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setSaving(false);
    }
  };

  const deleteWebhook = async (id: string, name: string) => {
    if (!confirm(`Delete webhook "${name}"?`)) return;

    try {
      const response = await fetch(`/api/alerts/webhooks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (!response.ok) throw new Error('Failed to delete webhook');

      setWebhooks(prev => prev.filter(w => w.id !== id));
      setSuccess('Webhook deleted');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const toggleWebhook = async (webhook: UserWebhook) => {
    try {
      const response = await fetch(`/api/alerts/webhooks/${webhook.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: !webhook.enabled }),
      });

      if (!response.ok) throw new Error('Failed to update webhook');

      setWebhooks(prev => prev.map(w =>
        w.id === webhook.id ? { ...w, enabled: !w.enabled } : w
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const testWebhook = async (id: string) => {
    setTestingWebhook(id);
    setError(null);

    try {
      const response = await fetch(`/api/alerts/webhooks/${id}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Test alert sent successfully!');
      } else {
        setError(`Test failed: ${data.error || 'Unknown error'}`);
      }
    } catch {
      setError('Failed to send test alert');
    } finally {
      setTestingWebhook(null);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
          Loading notification settings...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-xl font-semibold text-foreground">Notifications</h2>
            <p className="text-sm text-muted-foreground">Configure how you want to be notified about training events</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mx-6 mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md text-green-600 dark:text-green-400 text-sm flex items-center gap-2">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Email Notifications Section */}
      <div className="border-b border-border">
        <button
          onClick={() => setExpandedSection(expandedSection === 'email' ? null : 'email')}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Email Notifications</span>
            {preferences?.email_enabled && (
              <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
                Enabled
              </span>
            )}
          </div>
          {expandedSection === 'email' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expandedSection === 'email' && preferences && (
          <div className="px-6 pb-6 space-y-4">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <div className="font-medium">Enable Email Alerts</div>
                <div className="text-sm text-muted-foreground">Receive notifications via email</div>
              </div>
              <button
                onClick={() => updatePreferences({ email_enabled: !preferences.email_enabled })}
                disabled={saving}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  preferences.email_enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.email_enabled ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>

            {preferences.email_enabled && (
              <>
                {/* Email Override */}
                <div>
                  <label className="text-sm font-medium text-foreground">Email Address (optional)</label>
                  <p className="text-xs text-muted-foreground mb-2">Override the email from your account</p>
                  <input
                    type="email"
                    placeholder="Use account email"
                    value={preferences.email_address || ''}
                    onChange={(e) => setPreferences({ ...preferences, email_address: e.target.value || null })}
                    onBlur={() => updatePreferences({ email_address: preferences.email_address })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
                  />
                </div>

                {/* Alert Type Toggles */}
                <div>
                  <div className="text-sm font-medium text-foreground mb-3">Alert Types</div>
                  <div className="space-y-2">
                    {ALERT_TYPES.map(({ key, label, description }) => (
                      <div key={key} className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground">{description}</div>
                        </div>
                        <button
                          onClick={() => updatePreferences({ [key]: !preferences[key as keyof AlertPreferences] })}
                          disabled={saving}
                          className={`relative w-9 h-5 rounded-full transition-colors ${
                            preferences[key as keyof AlertPreferences] ? 'bg-primary' : 'bg-muted-foreground/30'
                          }`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            preferences[key as keyof AlertPreferences] ? 'translate-x-4' : ''
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Webhooks Section */}
      <div>
        <button
          onClick={() => setExpandedSection(expandedSection === 'webhooks' ? null : 'webhooks')}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Webhook className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Webhooks</span>
            {webhooks.length > 0 && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {webhooks.filter(w => w.enabled).length} active
              </span>
            )}
          </div>
          {expandedSection === 'webhooks' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expandedSection === 'webhooks' && (
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Send alerts to Slack, Discord, or custom webhook endpoints
            </p>

            {/* Existing Webhooks */}
            {webhooks.length > 0 && (
              <div className="space-y-3">
                {webhooks.map(webhook => (
                  <div
                    key={webhook.id}
                    className={`p-4 border rounded-lg ${webhook.enabled ? 'border-border' : 'border-border/50 opacity-60'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{webhook.name}</span>
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded capitalize">
                            {webhook.webhook_type}
                          </span>
                          {webhook.failure_count > 0 && (
                            <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                              {webhook.failure_count} failures
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-1">{webhook.url}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => testWebhook(webhook.id)}
                          disabled={testingWebhook === webhook.id}
                        >
                          {testingWebhook === webhook.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                          ) : (
                            <TestTube className="h-4 w-4" />
                          )}
                        </Button>
                        <button
                          onClick={() => toggleWebhook(webhook)}
                          className={`relative w-9 h-5 rounded-full transition-colors ${
                            webhook.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                          }`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            webhook.enabled ? 'translate-x-4' : ''
                          }`} />
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteWebhook(webhook.id, webhook.name)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Webhook Form */}
            {showAddWebhook ? (
              <div className="p-4 border border-dashed border-border rounded-lg space-y-3">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Slack #ml-alerts"
                    value={newWebhook.name}
                    onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Webhook URL</label>
                  <input
                    type="url"
                    placeholder="https://hooks.slack.com/services/..."
                    value={newWebhook.url}
                    onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <select
                    value={newWebhook.webhook_type}
                    onChange={(e) => setNewWebhook({ ...newWebhook, webhook_type: e.target.value as 'slack' | 'discord' | 'generic' })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md text-sm"
                  >
                    {WEBHOOK_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={createWebhook} disabled={saving} size="sm">
                    {saving ? 'Creating...' : 'Create Webhook'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddWebhook(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddWebhook(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Webhook
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
