'use client';

/**
 * Integrations Management Component
 * Configure third-party integrations (Notion, Teams, etc.)
 * Date: 2025-12-12
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  TestTube,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  IntegrationType,
  UserIntegrationDisplay,
  IntegrationConfig,
  IntegrationMetadata,
} from '@/lib/integrations/integration.types';

interface IntegrationsManagementProps {
  userId: string;
  sessionToken: string;
}

interface AvailableIntegration extends IntegrationMetadata {
  configured: boolean;
}

const ALERT_CONFIG_OPTIONS = [
  { key: 'log_job_completed', label: 'Job Completed', description: 'Training finished successfully' },
  { key: 'log_job_failed', label: 'Job Failed', description: 'Training failed with error' },
  { key: 'log_gpu_oom', label: 'GPU OOM', description: 'CUDA out of memory' },
  { key: 'log_job_started', label: 'Job Started', description: 'Training began' },
  { key: 'log_job_cancelled', label: 'Job Cancelled', description: 'Training cancelled' },
] as const;

// Simple icon components
function NotionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.933.653.933 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.448-1.632z" />
    </svg>
  );
}

function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.5 7.5h-3V6a3 3 0 00-3-3h-3a3 3 0 00-3 3v1.5h-3A1.5 1.5 0 003 9v10.5A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5V9a1.5 1.5 0 00-1.5-1.5zm-10.5-1.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 6v1.5H9V6zm3 7.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
    </svg>
  );
}

function IntegrationIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'notion':
      return <NotionIcon className={className} />;
    case 'teams':
      return <TeamsIcon className={className} />;
    default:
      return <Settings2 className={className} />;
  }
}

export function IntegrationsManagement({ sessionToken }: IntegrationsManagementProps) {
  const [integrations, setIntegrations] = useState<UserIntegrationDisplay[]>([]);
  const [available, setAvailable] = useState<AvailableIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [configuringType, setConfiguringType] = useState<IntegrationType | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/integrations', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setIntegrations(data.integrations || []);
        setAvailable(data.available || []);
      }
    } catch (err) {
      console.error('[IntegrationsManagement] Fetch error:', err);
      setError('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleSave = async () => {
    if (!configuringType) return;

    const metadata = available.find((a) => a.type === configuringType);
    if (!metadata) return;

    // Validate required fields
    for (const field of metadata.fields) {
      if (field.required && !credentials[field.key]) {
        setError(`${field.label} is required`);
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integration_type: configuringType,
          credentials,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSuccess('Integration saved!');
      setConfiguringType(null);
      setCredentials({});
      fetchIntegrations();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (type: IntegrationType, creds?: Record<string, string>) => {
    setTesting(type);
    setError(null);

    try {
      const response = await fetch(`/api/integrations/${type}/test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credentials: creds || credentials }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Connection successful!');
      } else {
        setError(`Test failed: ${data.error || 'Unknown error'}`);
      }
    } catch {
      setError('Test request failed');
    } finally {
      setTesting(null);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleDelete = async (type: IntegrationType, name: string) => {
    if (!confirm(`Remove ${name} integration?`)) return;

    try {
      const response = await fetch(`/api/integrations/${type}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!response.ok) throw new Error('Failed to delete');

      setSuccess('Integration removed');
      fetchIntegrations();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleToggle = async (integration: UserIntegrationDisplay) => {
    try {
      const response = await fetch(`/api/integrations/${integration.integration_type}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: !integration.enabled }),
      });

      if (!response.ok) throw new Error('Failed to toggle');

      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === integration.id ? { ...i, enabled: !i.enabled } : i
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle');
    }
  };

  const handleConfigUpdate = async (type: IntegrationType, config: IntegrationConfig) => {
    try {
      const response = await fetch(`/api/integrations/${type}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) throw new Error('Failed to update config');

      fetchIntegrations();
      setSuccess('Settings saved');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
          Loading integrations...
        </div>
      </div>
    );
  }

  const configuredTypes = integrations.map((i) => i.integration_type);
  const unconfigured = available.filter((a) => !configuredTypes.includes(a.type));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-xs text-muted-foreground">
          Connect third-party services to receive training events
        </p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md text-green-600 dark:text-green-400 text-sm flex items-center gap-2">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Add Integration - Show First */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Add Integration</h3>
        {configuringType ? (
        <div className="border border-dashed border-border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IntegrationIcon type={configuringType} className="h-5 w-5" />
              <span className="font-medium">
                {available.find((a) => a.type === configuringType)?.name}
              </span>
            </div>
            {available.find((a) => a.type === configuringType)?.docsUrl && (
              <a
                href={available.find((a) => a.type === configuringType)?.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Setup guide <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {available
            .find((a) => a.type === configuringType)
            ?.fields.map((field) => (
              <div key={field.key}>
                <label className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={credentials[field.key] || ''}
                  onChange={(e) =>
                    setCredentials({ ...credentials, [field.key]: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md text-sm font-mono"
                />
                {field.helpText && (
                  <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
                )}
              </div>
            ))}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? 'Saving...' : 'Save Integration'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTest(configuringType)}
              disabled={testing === configuringType}
            >
              {testing === configuringType ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-1" />
                  Test
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setConfiguringType(null);
                setCredentials({});
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {unconfigured.map((integration) => (
            <button
              key={integration.type}
              onClick={() => setConfiguringType(integration.type)}
              className="border border-dashed border-border rounded-lg p-2.5 hover:bg-muted/50 transition-colors text-left group"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-muted rounded group-hover:bg-primary/10 transition-colors shrink-0">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <IntegrationIcon type={integration.type} className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium text-sm truncate">{integration.name}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      </div>

      {/* Configured Integrations - Show Second */}
      {integrations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Configured Integrations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {integrations.map((integration) => {
              const metadata = available.find((a) => a.type === integration.integration_type);
              const isExpanded = expandedConfig === integration.id;

              return (
                <div
                  key={integration.id}
                  className={`border rounded-lg bg-card ${
                    integration.enabled ? 'border-border' : 'border-border/50 opacity-70'
                  }`}
                >
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className="p-1.5 bg-primary/10 rounded shrink-0">
                          <IntegrationIcon
                            type={integration.integration_type}
                            className="h-4 w-4"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm truncate">{metadata?.name || integration.integration_type}</span>
                            {integration.error_count > 0 && (
                              <span className="text-xs bg-destructive/10 text-destructive px-1 py-0.5 rounded shrink-0">
                                {integration.error_count}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {integration.credentials_preview}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setExpandedConfig(isExpanded ? null : integration.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <button
                          onClick={() => handleToggle(integration)}
                          className={`relative w-8 h-4 rounded-full transition-colors ${
                            integration.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                              integration.enabled ? 'translate-x-4' : ''
                            }`}
                          />
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleTest(integration.integration_type)}
                          disabled={testing === integration.integration_type}
                          title="Test integration"
                        >
                          {testing === integration.integration_type ? (
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary border-t-transparent" />
                          ) : (
                            <TestTube className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(integration.integration_type, metadata?.name || '')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Config */}
                  {isExpanded && (
                    <div className="border-t border-border p-3 bg-muted/30">
                      <p className="text-xs font-medium mb-2">Events to log:</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {ALERT_CONFIG_OPTIONS.map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-xs">{label}</span>
                            <button
                              onClick={() =>
                                handleConfigUpdate(integration.integration_type, {
                                  ...integration.config,
                                  [key]: !integration.config[key],
                                })
                              }
                              className={`relative w-7 h-3.5 rounded-full transition-colors ${
                                integration.config[key] ? 'bg-primary' : 'bg-muted-foreground/30'
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${
                                  integration.config[key] ? 'translate-x-3.5' : ''
                                }`}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
