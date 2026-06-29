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
import type { AuthType, DiscoveredModel, ModelProvider, ModelTemplate } from '@/lib/models/llm-model.types';
import { ALL_TEMPLATES } from '@/lib/models/model-templates';
import { safeJsonParse } from '@/lib/utils/safe-json';

const AUTO_IMPORT_BATCH_SIZE = 100;

type AutoDiscoveryImportConfig = {
  base_url: string;
  auth_type: AuthType;
  default_context_length: number;
};

type ModelImportNotice = {
  type: 'success' | 'warning';
  message: string;
};

type DiscoverModelsResponse = {
  success?: boolean;
  models?: DiscoveredModel[];
  error?: string;
  message?: string;
};

type BulkImportResponse = {
  success?: boolean;
  counts?: {
    created?: number;
    skipped?: number;
    failed?: number;
  };
  error?: string;
  message?: string;
};

const AUTO_DISCOVERY_IMPORT_CONFIG: Partial<Record<ModelProvider, AutoDiscoveryImportConfig>> = {
  openai: { base_url: 'https://api.openai.com/v1', auth_type: 'bearer', default_context_length: 128000 },
  openrouter: { base_url: 'https://openrouter.ai/api/v1', auth_type: 'bearer', default_context_length: 128000 },
  together: { base_url: 'https://api.together.xyz/v1', auth_type: 'bearer', default_context_length: 32768 },
  groq: { base_url: 'https://api.groq.com/openai/v1', auth_type: 'bearer', default_context_length: 32768 },
  fireworks: { base_url: 'https://api.fireworks.ai/inference/v1', auth_type: 'bearer', default_context_length: 32768 },
};

const CURATED_TEMPLATE_IMPORT_PROVIDERS = new Set<ModelProvider>(['anthropic', 'huggingface']);
const CURATED_TEMPLATE_IMPORT_EXCLUDED_IDS = new Set(['huggingface-gpt2']);

const NON_CHAT_MODEL_ID_PATTERNS = [
  /(^|[/:_-])(?:text-)?embedd?ings?([/:_-]|$)/,
  /(^|[/:_-])rerank(?:er)?([/:_-]|$)/,
  /(^|[/:_-])moderation([/:_-]|$)/,
  /(^|[/:_-])omni-moderation([/:_-]|$)/,
  /(^|[/:_-])dall[-_]?e([/:_-]|$)/,
  /(^|[/:_-])image(s)?([/:_-]|$)/,
  /(^|[/:_-])stable[-_]?diffusion([/:_-]|$)/,
  /(^|[/:_-])flux([/:_-]|$)/,
  /(^|[/:_-])clip([/:_-]|$)/,
  /(^|[/:_-])whisper([/:_-]|$)/,
  /(^|[/:_-])tts([/:_-]|$)/,
  /(^|[/:_-])speech([/:_-]|$)/,
  /(^|[/:_-])audio([/:_-]|$)/,
  /transcri(?:be|ption)/,
];

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function modelLabel(count: number): string {
  return count === 1 ? 'model' : 'models';
}

function isLikelyChatModel(modelId: string): boolean {
  const normalized = modelId.toLowerCase();
  return !NON_CHAT_MODEL_ID_PATTERNS.some((pattern) => pattern.test(normalized));
}

function matchingTemplateContextLength(provider: ModelProvider, modelId: string): number | undefined {
  const normalizedModelId = modelId.toLowerCase();
  const template = ALL_TEMPLATES
    .filter((candidate) => candidate.provider === provider)
    .find((candidate) => {
      const templateModelId = candidate.model_id.toLowerCase();
      return (
        normalizedModelId === templateModelId ||
        normalizedModelId.startsWith(`${templateModelId}-`) ||
        templateModelId.startsWith(`${normalizedModelId}-`)
      );
    });

  return template?.context_length;
}

function toBulkImportModel(provider: ModelProvider, config: AutoDiscoveryImportConfig, model: DiscoveredModel) {
  return {
    model_id: model.id,
    name: model.id,
    context_length:
      model.max_model_len ||
      matchingTemplateContextLength(provider, model.id) ||
      config.default_context_length,
  };
}

function isAutoImportableTemplate(template: ModelTemplate): boolean {
  const placeholderPattern = /\b(?:YOUR|your)[-_]/;
  return (
    CURATED_TEMPLATE_IMPORT_PROVIDERS.has(template.provider) &&
    !template.id.includes('custom') &&
    !CURATED_TEMPLATE_IMPORT_EXCLUDED_IDS.has(template.id) &&
    !placeholderPattern.test(template.name) &&
    !placeholderPattern.test(template.base_url) &&
    !placeholderPattern.test(template.model_id)
  );
}

function getCuratedTemplatesForProvider(provider: ModelProvider): ModelTemplate[] {
  return ALL_TEMPLATES.filter((template) => template.provider === provider && isAutoImportableTemplate(template));
}

function toBulkImportTemplateModel(template: ModelTemplate) {
  return {
    model_id: template.model_id,
    name: template.name,
    context_length: template.context_length,
    max_output_tokens: template.max_output_tokens,
    supports_streaming: template.supports_streaming,
    supports_functions: template.supports_functions,
    supports_vision: template.supports_vision,
    price_per_input_token: template.price_per_input_token,
    price_per_output_token: template.price_per_output_token,
    default_temperature: template.default_temperature,
    default_top_p: template.default_top_p,
  };
}

function templateGroupKey(template: ModelTemplate): string {
  return `${template.base_url}\n${template.auth_type}`;
}

async function importDiscoveredModelsForProvider(
  provider: ModelProvider,
  providerLabel: string,
  sessionToken: string
): Promise<ModelImportNotice | null> {
  const config = AUTO_DISCOVERY_IMPORT_CONFIG[provider];
  if (!config) return null;

  try {
    const discoverResponse = await fetch('/api/models/discover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        provider,
        base_url: config.base_url,
        auth_type: config.auth_type,
      }),
    });

    const discoverData = await safeJsonParse<DiscoverModelsResponse>(discoverResponse, {});
    if (!discoverResponse.ok || !discoverData.success) {
      return {
        type: 'warning',
        message: `${providerLabel} key saved, but model discovery failed: ${discoverData.message || discoverData.error || 'Unknown error'}`,
      };
    }

    const discoveredModels = (discoverData.models || []).filter((model) => isLikelyChatModel(model.id));
    if (discoveredModels.length === 0) {
      return {
        type: 'warning',
        message: `${providerLabel} key saved, but the provider did not return any models to import.`,
      };
    }

    const totals = { created: 0, skipped: 0, failed: 0 };
    const requestErrors: string[] = [];
    let requestFailureCount = 0;
    for (const batch of chunkArray(discoveredModels, AUTO_IMPORT_BATCH_SIZE)) {
      const bulkResponse = await fetch('/api/models/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          provider,
          base_url: config.base_url,
          auth_type: config.auth_type,
          supports_streaming: true,
          supports_functions: true,
          supports_vision: false,
          models: batch.map((model) => toBulkImportModel(provider, config, model)),
        }),
      });

      const bulkData = await safeJsonParse<BulkImportResponse>(bulkResponse, {});
      if (!bulkResponse.ok) {
        requestErrors.push(bulkData.message || bulkData.error || `Bulk import failed with ${bulkResponse.status}`);
        requestFailureCount += batch.length;
        continue;
      }

      totals.created += bulkData.counts?.created || 0;
      totals.skipped += bulkData.counts?.skipped || 0;
      totals.failed += bulkData.counts?.failed || 0;
    }

    if (requestErrors.length > 0 || totals.failed > 0) {
      return {
        type: 'warning',
        message: `${providerLabel} key saved. Imported ${totals.created} ${modelLabel(totals.created)}, skipped ${totals.skipped}, and ${totals.failed + requestFailureCount} failed.`,
      };
    }

    if (totals.created > 0) {
      const skippedSuffix = totals.skipped > 0 ? ` ${totals.skipped} already existed.` : '';
      return {
        type: 'success',
        message: `Imported ${totals.created} ${providerLabel} ${modelLabel(totals.created)}.${skippedSuffix}`,
      };
    }

    return {
      type: 'success',
      message: `${providerLabel} key saved. All ${totals.skipped} discovered ${modelLabel(totals.skipped)} were already imported.`,
    };
  } catch (error) {
    return {
      type: 'warning',
      message: `${providerLabel} key saved, but model import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function importCuratedModelsForProvider(
  provider: ModelProvider,
  providerLabel: string,
  sessionToken: string
): Promise<ModelImportNotice | null> {
  const templates = getCuratedTemplatesForProvider(provider);
  if (templates.length === 0) return null;

  const groups = new Map<string, ModelTemplate[]>();
  for (const template of templates) {
    const key = templateGroupKey(template);
    groups.set(key, [...(groups.get(key) || []), template]);
  }

  try {
    const totals = { created: 0, skipped: 0, failed: 0 };
    const requestErrors: string[] = [];
    let requestFailureCount = 0;

    for (const groupTemplates of groups.values()) {
      const firstTemplate = groupTemplates[0];
      for (const batch of chunkArray(groupTemplates, AUTO_IMPORT_BATCH_SIZE)) {
        const bulkResponse = await fetch('/api/models/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            provider,
            base_url: firstTemplate.base_url,
            auth_type: firstTemplate.auth_type,
            models: batch.map(toBulkImportTemplateModel),
          }),
        });

        const bulkData = await safeJsonParse<BulkImportResponse>(bulkResponse, {});
        if (!bulkResponse.ok) {
          requestErrors.push(bulkData.message || bulkData.error || `Bulk import failed with ${bulkResponse.status}`);
          requestFailureCount += batch.length;
          continue;
        }

        totals.created += bulkData.counts?.created || 0;
        totals.skipped += bulkData.counts?.skipped || 0;
        totals.failed += bulkData.counts?.failed || 0;
      }
    }

    if (requestErrors.length > 0 || totals.failed > 0) {
      return {
        type: 'warning',
        message: `${providerLabel} key saved. Imported ${totals.created} curated ${modelLabel(totals.created)}, skipped ${totals.skipped}, and ${totals.failed + requestFailureCount} failed.`,
      };
    }

    if (totals.created > 0) {
      const skippedSuffix = totals.skipped > 0 ? ` ${totals.skipped} already existed.` : '';
      return {
        type: 'success',
        message: `Imported ${totals.created} curated ${providerLabel} ${modelLabel(totals.created)}.${skippedSuffix}`,
      };
    }

    return {
      type: 'success',
      message: `${providerLabel} key saved. All ${totals.skipped} curated ${modelLabel(totals.skipped)} were already imported.`,
    };
  } catch (error) {
    return {
      type: 'warning',
      message: `${providerLabel} key saved, but curated model import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function importModelsForProvider(
  provider: ModelProvider,
  providerLabel: string,
  sessionToken: string
): Promise<ModelImportNotice | null> {
  const discoveredImportNotice = await importDiscoveredModelsForProvider(provider, providerLabel, sessionToken);
  if (discoveredImportNotice) return discoveredImportNotice;
  return importCuratedModelsForProvider(provider, providerLabel, sessionToken);
}

export default function SecretsPage() {
  const { user, session, signOut, loading: authLoading } = useAuth();
  const router = useRouter();

  const [secrets, setSecrets] = useState<ProviderSecretDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [modelImportNotice, setModelImportNotice] = useState<ModelImportNotice | null>(null);

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
      setModelImportNotice(null);
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
    openrouter: { name: 'OpenRouter', description: 'Access 200+ models through unified API aggregator' },
    together: { name: 'Together.ai', description: 'Fast open-source model inference and fine-tuning' },
    groq: { name: 'Groq', description: 'Ultra-fast inference powered by LPU technology' },
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

        {modelImportNotice && (
          <div
            role="status"
            className={`mb-6 rounded-md border p-3 text-sm ${
              modelImportNotice.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {modelImportNotice.message}
          </div>
        )}

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
                      onClick={() => {
                        setModelImportNotice(null);
                        setEditingProvider(provider);
                      }}
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
                            onClick={() => {
                              setModelImportNotice(null);
                              setEditingProvider(secret.provider);
                            }}
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
            providerLabel={providerInfo[editingProvider]?.name || editingProvider}
            existingSecret={secrets.find(s => s.provider === editingProvider)}
            userId={user.id}
            sessionToken={session.access_token}
            onClose={() => setEditingProvider(null)}
            onModelImportNotice={setModelImportNotice}
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
  providerLabel: string;
  existingSecret?: ProviderSecretDisplay;
  userId: string;
  sessionToken: string;
  onClose: () => void;
  onModelImportNotice: (notice: ModelImportNotice | null) => void;
  onSuccess: () => void;
}

function SecretDialog({
  provider,
  providerLabel,
  existingSecret,
  userId: _userId, // eslint-disable-line @typescript-eslint/no-unused-vars
  sessionToken,
  onClose,
  onModelImportNotice,
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
      const modelImportNotice = await importModelsForProvider(provider, providerLabel, sessionToken);
      onModelImportNotice(modelImportNotice);
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
