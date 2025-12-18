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
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ApiKeysManagement } from '@/components/settings/ApiKeysManagement';
import { WidgetAppsManagement } from '@/components/settings/WidgetAppsManagement';
import { IntegrationsManagement } from '@/components/settings/IntegrationsManagement';
import type { ProviderSecretDisplay } from '@/lib/secrets/secrets.types';
import type { ModelProvider } from '@/lib/models/llm-model.types';
import { safeJsonParse } from '@/lib/utils/safe-json';

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

      const data = await safeJsonParse(response, { secrets: [], count: 0 });
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
        const data = await safeJsonParse(response, { error: 'Failed to delete secret' });
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
    return <LoadingState fullScreen message="Loading authentication..." />;
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center border rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">You must be logged in to manage provider secrets.</p>
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
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
    lambda: { name: 'Lambda Labs', description: 'Lambda Labs API key for cloud GPU training (42% cheaper than RunPod)' },
    aws: { name: 'AWS', description: 'AWS credentials for SageMaker training and S3 dataset storage' },
    fireworks: { name: 'Fireworks.ai', description: 'Fast inference API with <1s cold starts - no hosting fees for fine-tuned models' },
    'google-colab': { name: 'Google Colab', description: 'Google Cloud API credentials for Colab notebooks' },
    local: { name: 'Local', description: 'Local model deployment (vLLM/Ollama)' },
    custom: { name: 'Custom', description: 'Custom OpenAI-compatible endpoints' },
  };

  return (
    <PageWrapper currentPage="secrets" user={user} signOut={signOut}>
      <PageHeader
        title="Provider Secrets"
        description="Manage API keys for LLM providers. These keys will be used automatically when creating models without explicit API keys."
      />

        {/* Error State */}
        {error && (
          <ErrorState
            title="Error loading secrets"
            message={error}
            onRetry={fetchSecrets}
          />
        )}

        {/* Loading State */}
        {loading && <LoadingState message="Loading secrets..." />}

        {/* Third-Party Integrations Section - At Top */}
        {user && session?.access_token && (
          <div className="mb-8">
            <IntegrationsManagement
              userId={user.id}
              sessionToken={session.access_token}
            />
          </div>
        )}

        {/* Secrets List */}
        {!loading && (
          <div className="space-y-4">
            {/* Available Providers - Now First */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Add Provider</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {(Object.keys(providerInfo) as ModelProvider[])
                  .filter(provider => !secrets.find(s => s.provider === provider))
                  .map((provider) => (
                    <button
                      key={provider}
                      onClick={() => setEditingProvider(provider)}
                      className="border border-dashed border-border rounded-lg p-2.5 hover:bg-muted/50 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-muted rounded group-hover:bg-primary/10 transition-colors shrink-0">
                          <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-sm truncate">{providerInfo[provider].name}</h3>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            {/* Configured Secrets - Now Second */}
            {secrets.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold mt-4">Configured Providers</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {secrets.map((secret) => (
                    <div
                      key={secret.id}
                      className="border border-border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <div className="p-1.5 bg-primary/10 rounded shrink-0">
                            <Key className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">
                              {providerInfo[secret.provider]?.name || secret.provider}
                            </h3>
                            <p className="font-mono text-xs text-muted-foreground truncate">
                              {secret.api_key_preview}
                            </p>
                            {secret.provider === 'huggingface' && (secret.metadata as { username?: string } | null)?.username && (
                              <p className="text-xs text-muted-foreground truncate">
                                @{(secret.metadata as { username?: string })?.username}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditingProvider(secret.provider)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteSecret(secret.provider)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Widget API Keys Section */}
        {user && session?.access_token && (
          <div className="mt-8">
            <ApiKeysManagement
              userId={user.id}
              sessionToken={session.access_token}
            />
          </div>
        )}

        {/* Embeddable Widget Apps Section */}
        {user && session?.access_token && (
          <div className="mt-8">
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
    </PageWrapper>
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
  const [hfUsername, setHfUsername] = useState(
    (existingSecret?.metadata as { username?: string } | null)?.username || ''
  );
  const [lambdaSshKeyName, setLambdaSshKeyName] = useState(
    (existingSecret?.metadata as { lambda?: { ssh_key_name?: string } } | null)?.lambda?.ssh_key_name || ''
  );
  const [awsAccessKeyId, setAwsAccessKeyId] = useState(
    (existingSecret?.metadata as { aws?: { access_key_id?: string } } | null)?.aws?.access_key_id || ''
  );
  const [awsS3Bucket, setAwsS3Bucket] = useState(
    (existingSecret?.metadata as { aws?: { s3_bucket?: string } } | null)?.aws?.s3_bucket || ''
  );
  const [awsRegion, setAwsRegion] = useState(
    (existingSecret?.metadata as { aws?: { region?: string } } | null)?.aws?.region || 'us-east-1'
  );
  const [awsIamRoleArn, setAwsIamRoleArn] = useState(
    (existingSecret?.metadata as { aws?: { iam_role_arn?: string } } | null)?.aws?.iam_role_arn || ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!existingSecret;
  const isHuggingFace = provider === 'huggingface';
  const isLambda = provider === 'lambda';
  const isAWS = provider === 'aws';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isEdit && !apiKey.trim()) {
      setError('API key is required');
      return;
    }

    if (isLambda && !lambdaSshKeyName.trim()) {
      setError('SSH key name is required for Lambda Labs');
      return;
    }

    if (isAWS && (!awsAccessKeyId.trim() || !awsS3Bucket.trim() || !awsRegion.trim())) {
      setError('Access Key ID, S3 Bucket, and Region are required for AWS');
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

      // Include HuggingFace username in metadata
      if (isHuggingFace && hfUsername.trim()) {
        body.metadata = { username: hfUsername.trim() };
      }

      // Include Lambda SSH key name in metadata
      if (isLambda && lambdaSshKeyName.trim()) {
        body.metadata = {
          ...body.metadata,
          lambda: { ssh_key_name: lambdaSshKeyName.trim() }
        };
      }

      // Include AWS metadata
      if (isAWS && awsAccessKeyId.trim() && awsS3Bucket.trim() && awsRegion.trim()) {
        body.metadata = {
          ...body.metadata,
          aws: {
            access_key_id: awsAccessKeyId.trim(),
            s3_bucket: awsS3Bucket.trim(),
            region: awsRegion.trim(),
            ...(awsIamRoleArn.trim() && { iam_role_arn: awsIamRoleArn.trim() })
          }
        };
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
        const data = await safeJsonParse(response, { error: `Failed to ${isEdit ? 'update' : 'create'} secret` });
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
              {isAWS ? 'AWS Secret Access Key' : 'API Key'} {!isEdit && <span className="text-destructive">*</span>}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isEdit ? 'Leave empty to keep current secret' : (isAWS ? 'Your AWS Secret Access Key' : 'sk-...')}
              className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
              disabled={submitting}
            />
            {isAWS && (
              <p className="text-xs text-muted-foreground mt-1">
                Your AWS Secret Access Key (shown only once when created in AWS console).
              </p>
            )}
          </div>

          {/* AWS Access Key ID - shown right after Secret Access Key for AWS */}
          {isAWS && (
            <div>
              <label className="block text-sm font-medium mb-2">
                AWS Access Key ID <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={awsAccessKeyId}
                onChange={(e) => setAwsAccessKeyId(e.target.value)}
                placeholder="AKIAIOSFODNN7EXAMPLE"
                className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
                required
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your AWS Access Key ID (starts with AKIA).
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              Description <span className="text-muted-foreground text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isAWS ? 'e.g., Development, Production' : 'e.g., Personal key, Production key'}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              disabled={submitting}
            />
          </div>

          {/* HuggingFace Username - only shown for huggingface provider */}
          {isHuggingFace && (
            <div>
              <label className="block text-sm font-medium mb-2">
                HuggingFace Username <span className="text-muted-foreground text-xs">(For model uploads)</span>
              </label>
              <input
                type="text"
                value={hfUsername}
                onChange={(e) => setHfUsername(e.target.value)}
                placeholder="e.g., your-username"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your HuggingFace username for auto-generating model repository names when uploading fine-tuned models.
              </p>
            </div>
          )}

          {/* Lambda SSH Key Name - only shown for lambda provider */}
          {isLambda && (
            <div>
              <label className="block text-sm font-medium mb-2">
                SSH Key Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={lambdaSshKeyName}
                onChange={(e) => setLambdaSshKeyName(e.target.value)}
                placeholder="e.g., production-key"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                required
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The name of the SSH key you added in your Lambda Labs dashboard (Settings → SSH Keys).
              </p>
            </div>
          )}

          {/* AWS Additional Configuration - S3 Bucket and Region */}
          {isAWS && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  S3 Bucket Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={awsS3Bucket}
                  onChange={(e) => setAwsS3Bucket(e.target.value)}
                  placeholder="my-finetunelab-datasets"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  required
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  S3 bucket for storing training datasets (bucket must exist).
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  AWS Region <span className="text-destructive">*</span>
                </label>
                <select
                  value={awsRegion}
                  onChange={(e) => setAwsRegion(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  required
                  disabled={submitting}
                >
                  <option value="us-east-1">US East (N. Virginia)</option>
                  <option value="us-east-2">US East (Ohio)</option>
                  <option value="us-west-1">US West (N. California)</option>
                  <option value="us-west-2">US West (Oregon)</option>
                  <option value="eu-west-1">EU (Ireland)</option>
                  <option value="eu-central-1">EU (Frankfurt)</option>
                  <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                  <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  The AWS region where your SageMaker training jobs will run.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  IAM Role ARN <span className="text-muted-foreground text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={awsIamRoleArn}
                  onChange={(e) => setAwsIamRoleArn(e.target.value)}
                  placeholder="arn:aws:iam::710699192374:role/FineTune-Lab-DEV"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-xs"
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional: Specify a custom IAM role with SageMaker permissions. If not provided, a default role will be created.
                </p>
              </div>
            </>
          )}

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
              variant="ghost"
              disabled={submitting}
              className="flex-1 bg-gray-900 text-white hover:bg-gray-800"
            >
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
