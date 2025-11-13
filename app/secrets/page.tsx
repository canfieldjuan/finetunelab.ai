'use client';

/**
 * Provider Secrets Management Page
 * Date: 2025-10-16
 *
 * Allows users to:
 * - View configured provider secrets
 * - Add new provider API keys
 * - Update existing provider keys
 * - Delete provider keys
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Plus, Key, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { ApiKeysManagement } from '@/components/settings/ApiKeysManagement';
import { WidgetAppsManagement } from '@/components/settings/WidgetAppsManagement';
import type { ProviderSecretDisplay } from '@/lib/secrets/secrets.types';
import type { ModelProvider } from '@/lib/models/llm-model.types';

export default function SecretsPage() {
  const { user, session, signOut, loading: authLoading } = useAuth();
  const router = useRouter();

  const [secrets, setSecrets] = useState<ProviderSecretDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);

  console.log('[SecretsPage] Auth state:', { user: user?.email, authLoading });

  // Auth check - redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      console.warn('[SecretsPage] No authenticated user, redirecting to login');
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Fetch secrets on mount when authenticated
  useEffect(() => {
    if (user && session?.access_token) {
      fetchSecrets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]);

  async function fetchSecrets() {
    console.log('[SecretsPage] Fetching provider secrets...');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/secrets', {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch secrets: ${response.status}`);
      }

      const data = await response.json();
      console.log('[SecretsPage] Fetched secrets:', data.count);
      setSecrets(data.secrets || []);
    } catch (err) {
      console.error('[SecretsPage] Error fetching secrets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load secrets');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSecret(provider: ModelProvider) {
    console.log('[SecretsPage] Delete secret for provider:', provider);

    if (!confirm(`Delete API key for ${provider}? Models using this provider will need their own API keys.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/secrets/${provider}`, {
        method: 'DELETE',
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete secret');
      }

      console.log('[SecretsPage] Secret deleted successfully');
      setSecrets(prev => prev.filter(s => s.provider !== provider));
    } catch (err) {
      console.error('[SecretsPage] Delete failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete secret');
    }
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Authentication Required</h2>
          <p className="text-yellow-700 mb-4">You must be logged in to manage provider secrets.</p>
          <p className="text-sm text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const providerInfo: Record<ModelProvider, { name: string; description: string }> = {
    openai: { name: 'OpenAI', description: 'GPT-4, GPT-3.5, and other OpenAI models' },
    anthropic: { name: 'Anthropic', description: 'Claude 3 and Claude 2 models' },
    huggingface: { name: 'HuggingFace', description: 'Open-source models via Inference API' },
    ollama: { name: 'Ollama', description: 'Local models via Ollama' },
    vllm: { name: 'vLLM', description: 'Self-hosted vLLM deployments' },
    azure: { name: 'Azure OpenAI', description: 'Azure-hosted OpenAI models' },
    github: { name: 'GitHub', description: 'Personal access token for GitHub Gist creation (Colab notebooks)' },
    kaggle: { name: 'Kaggle', description: 'Kaggle API credentials for notebook deployment and datasets' },
    runpod: { name: 'RunPod', description: 'RunPod API key for serverless GPU deployment' },
    'google-colab': { name: 'Google Colab', description: 'Google Cloud API credentials for Colab notebooks' },
    custom: { name: 'Custom', description: 'Custom OpenAI-compatible endpoints' },
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar currentPage="secrets" user={user} signOut={signOut} />
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Provider Secrets</h1>
          <p className="text-muted-foreground">
            Manage API keys for LLM providers. These keys will be used automatically when creating models without explicit API keys.
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
            <p className="font-medium">Error loading secrets</p>
            <p className="text-sm mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSecrets}
              className="mt-3"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-muted-foreground">Loading secrets...</p>
            </div>
          </div>
        )}

        {/* Secrets List */}
        {!loading && (
          <div className="space-y-4">
            {/* Configured Secrets */}
            {secrets.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Configured Providers</h2>
                {secrets.map((secret) => (
                  <div
                    key={secret.id}
                    className="border border-border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 bg-primary/10 rounded-md">
                          <Key className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            {providerInfo[secret.provider]?.name || secret.provider}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {providerInfo[secret.provider]?.description}
                          </p>
                          <div className="text-sm space-y-1">
                            <p className="font-mono text-xs bg-muted px-2 py-1 rounded inline-block">
                              {secret.api_key_preview}
                            </p>
                            {secret.description && (
                              <p className="text-muted-foreground italic">{secret.description}</p>
                            )}
                            {secret.last_used_at && (
                              <p className="text-xs text-muted-foreground">
                                Last used: {new Date(secret.last_used_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingProvider(secret.provider)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSecret(secret.provider)}
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

            {/* Available Providers */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold mt-6">Add Provider Secret</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(Object.keys(providerInfo) as ModelProvider[])
                  .filter(provider => !secrets.find(s => s.provider === provider))
                  .map((provider) => (
                    <button
                      key={provider}
                      onClick={() => setEditingProvider(provider)}
                      className="border border-dashed border-border rounded-lg p-4 hover:bg-muted/50 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-md group-hover:bg-primary/10 transition-colors">
                          <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{providerInfo[provider].name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {providerInfo[provider].description}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Widget API Keys Section */}
        {user && session?.access_token && (
          <div className="mt-12">
            <ApiKeysManagement 
              userId={user.id} 
              sessionToken={session.access_token} 
            />
          </div>
        )}

        {/* Embeddable Widget Apps Section */}
        {user && session?.access_token && (
          <div className="mt-12">
            <WidgetAppsManagement 
              userId={user.id} 
              sessionToken={session.access_token} 
            />
          </div>
        )}

        {/* Add/Edit Secret Dialog */}
        {editingProvider && user && session?.access_token && (
          <SecretDialog
            provider={editingProvider}
            existingSecret={secrets.find(s => s.provider === editingProvider)}
            userId={user.id}
            sessionToken={session.access_token}
            onClose={() => setEditingProvider(null)}
            onSuccess={() => {
              setEditingProvider(null);
              fetchSecrets();
            }}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Secret Dialog Component (inline for now)
// ============================================================================

interface SecretDialogProps {
  provider: ModelProvider;
  existingSecret?: ProviderSecretDisplay;
  userId: string;
  sessionToken: string;
  onClose: () => void;
  onSuccess: () => void;
}

function SecretDialog({
  provider,
  existingSecret,
  userId: _userId, // eslint-disable-line @typescript-eslint/no-unused-vars
  sessionToken,
  onClose,
  onSuccess,
}: SecretDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [description, setDescription] = useState(existingSecret?.description || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!existingSecret;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isEdit && !apiKey.trim()) {
      setError('API key is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const url = isEdit ? `/api/secrets/${provider}` : '/api/secrets';
      const method = isEdit ? 'PUT' : 'POST';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = { description };

      if (!isEdit) {
        body.provider = provider;
        body.api_key = apiKey;
      } else if (apiKey.trim()) {
        body.api_key = apiKey;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${isEdit ? 'update' : 'create'} secret`);
      }

      console.log('[SecretDialog] Secret', isEdit ? 'updated' : 'created');
      onSuccess();
    } catch (err) {
      console.error('[SecretDialog] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">
          {isEdit ? 'Update' : 'Add'} {provider} API Key
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              API Key {!isEdit && <span className="text-destructive">*</span>}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isEdit ? 'Leave empty to keep current key' : 'sk-...'}
              className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Description <span className="text-muted-foreground text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Personal key, Production key"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
