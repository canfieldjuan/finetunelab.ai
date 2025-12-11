"use client";

/**
 * AddModelDialog Component
 * Phase 5.2.3-4: Add Model Dialog (Templates + Manual)
 * Date: 2025-10-15
 *
 * Two-path model creation:
 * 1. Template Path: Select from 19 pre-configured templates
 * 2. Manual Path: Full custom configuration
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Sparkles, Zap, Eye } from 'lucide-react';
import { ALL_TEMPLATES } from '@/lib/models/model-templates';
import type { CreateModelDTO, ModelProvider, AuthType, ModelTemplate } from '@/lib/models/llm-model.types';
import { apiConfig } from '@/lib/config/api';

interface AddModelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  sessionToken: string;
}

type TabType = 'templates' | 'manual';

export function AddModelDialog({ isOpen, onClose, onSuccess, sessionToken }: AddModelDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<ModelTemplate | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<CreateModelDTO>>({
    name: '',
    description: '',
    provider: 'openai',
    base_url: '',
    model_id: '',
    auth_type: 'bearer',
    api_key: '',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: false,
    context_length: 4096,
    max_output_tokens: 2000,
    default_temperature: 0.7,
    default_top_p: 1.0,
  });

  // Local deployment state (for local provider)
  const [localDeploymentConfig, setLocalDeploymentConfig] = useState({
    server_type: 'vllm' as 'vllm' | 'ollama' | 'runpod-serverless',
    model_path: '', // HuggingFace model ID or local checkpoint path
    gpu_memory_utilization: 0.5,
    max_model_len: undefined as number | undefined,
    tensor_parallel_size: 1,
    context_length: 4096,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);
  const [testing, setTesting] = useState(false);

  console.log('[AddModelDialog] Render:', { isOpen, activeTab, selectedTemplate: selectedTemplate?.name });

  if (!isOpen) return null;

  // Group templates by provider
  const templatesByProvider = ALL_TEMPLATES.reduce((acc: Record<string, ModelTemplate[]>, template: ModelTemplate) => {
    if (!acc[template.provider]) acc[template.provider] = [];
    acc[template.provider].push(template);
    return acc;
  }, {} as Record<string, ModelTemplate[]>);

  const handleTemplateSelect = (template: ModelTemplate) => {
    console.log('[AddModelDialog] Template selected:', template.name);
    setSelectedTemplate(template);

    // Pre-fill form with template data
    setFormData({
      name: template.name,
      description: template.description,
      provider: template.provider,
      base_url: template.base_url,
      model_id: template.model_id,
      auth_type: template.auth_type,
      api_key: '', // User must provide
      supports_streaming: template.supports_streaming,
      supports_functions: template.supports_functions,
      supports_vision: template.supports_vision,
      context_length: template.context_length,
      max_output_tokens: template.max_output_tokens,
      price_per_input_token: template.price_per_input_token,
      price_per_output_token: template.price_per_output_token,
      default_temperature: template.default_temperature,
      default_top_p: template.default_top_p,
    });

    // Initialize local deployment config for local templates
    if (template.provider === 'local') {
      const isOllama = template.id.includes('ollama');
      setLocalDeploymentConfig({
        server_type: isOllama ? 'ollama' : 'vllm',
        model_path: template.model_id, // Use template model_id as default path
        gpu_memory_utilization: 0.5,
        max_model_len: undefined,
        tensor_parallel_size: 1,
        context_length: template.context_length || 4096,
      });
    }

    setError(null);
    setTestResult(null);
  };

  const handleFieldChange = (field: keyof CreateModelDTO, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = (): string | null => {
    if (!formData.name?.trim()) return 'Model name is required';
    if (!formData.provider) return 'Provider is required';
    if (!formData.base_url?.trim()) return 'Base URL is required';
    if (!formData.model_id?.trim()) return 'Model ID is required';
    if (!formData.auth_type) return 'Auth type is required';

    // API key is now optional - will use provider secret if not provided

    return null;
  };

  const handleTestConnection = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    console.log('[AddModelDialog] Testing connection...');
    setTesting(true);
    setTestResult(null);
    setError(null);

    // Create AbortController for model operation timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), apiConfig.timeouts.modelOperation);

    try {
      const response = await fetch('/api/models/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          provider: formData.provider,
          base_url: formData.base_url,
          model_id: formData.model_id,
          auth_type: formData.auth_type,
          api_key: formData.api_key,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        console.log('[AddModelDialog] Connection test passed:', data.latency);
        setTestResult({
          success: true,
          message: data.message || 'Connection successful',
          latency: data.latency,
        });
      } else {
        console.warn('[AddModelDialog] Connection test failed:', data.error);
        // Extract error message - handle both string and object formats
        const errorMessage = typeof data.error === 'string'
          ? data.error
          : (data.error?.message || JSON.stringify(data.error) || 'Connection failed');
        setTestResult({
          success: false,
          message: errorMessage,
        });
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[AddModelDialog] Test connection error:', err);

      if (err instanceof Error && err.name === 'AbortError') {
        setTestResult({
          success: false,
          message: 'Connection test timed out after 30 seconds',
        });
      } else {
        setTestResult({
          success: false,
          message: err instanceof Error ? err.message : 'Network error',
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    console.log('[AddModelDialog] Creating model:', formData.name);
    setSubmitting(true);
    setError(null);

    try {
      // Local deployment uses different API endpoint
      if (formData.provider === 'local') {
        console.log('[AddModelDialog] Deploying local model:', localDeploymentConfig);

        const response = await fetch('/api/training/deploy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            // job_id is not needed for local model deployments
            // Backend will use config.model_path instead
            server_type: localDeploymentConfig.server_type,
            checkpoint_path: null,
            name: formData.name,
            config: {
              model_path: localDeploymentConfig.model_path,
              gpu_memory_utilization: localDeploymentConfig.gpu_memory_utilization,
              max_model_len: localDeploymentConfig.max_model_len,
              tensor_parallel_size: localDeploymentConfig.tensor_parallel_size,
              context_length: localDeploymentConfig.context_length,
            },
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to deploy model');
        }

        const data = await response.json();
        console.log('[AddModelDialog] Model deployed:', data.model_id);
      } else {
        // Standard model creation via /api/models
        const response = await fetch('/api/models', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create model');
        }

        const data = await response.json();
        console.log('[AddModelDialog] Model created:', data.model.id);
      }

      // Reset form and close
      setFormData({
        name: '',
        description: '',
        provider: 'openai',
        base_url: '',
        model_id: '',
        auth_type: 'bearer',
        api_key: '',
        supports_streaming: true,
        supports_functions: true,
        supports_vision: false,
        context_length: 4096,
        max_output_tokens: 2000,
        default_temperature: 0.7,
        default_top_p: 1.0,
      });
      setSelectedTemplate(null);
      setTestResult(null);
      setLocalDeploymentConfig({
        server_type: 'vllm',
        model_path: '',
        gpu_memory_utilization: 0.5,
        max_model_len: undefined,
        tensor_parallel_size: 1,
        context_length: 4096,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('[AddModelDialog] Create/deploy model error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create model');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setSelectedTemplate(null);
      setFormData({
        name: '',
        provider: 'openai',
        base_url: '',
        model_id: '',
        auth_type: 'bearer',
        api_key: '',
      });
      setError(null);
      setTestResult(null);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div
        className="bg-background rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Add Model</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose from templates or create a custom model configuration
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-3 border-b-2 font-medium transition-colors ${
                activeTab === 'templates'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Templates ({ALL_TEMPLATES.length})
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-4 py-3 border-b-2 font-medium transition-colors ${
                activeTab === 'manual'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Manual Configuration
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'templates' && !selectedTemplate && (
            <TemplateSelector
              templatesByProvider={templatesByProvider}
              onSelect={handleTemplateSelect}
            />
          )}

          {activeTab === 'templates' && selectedTemplate && selectedTemplate.provider === 'local' && (
            <LocalModelForm
              template={selectedTemplate}
              formData={formData}
              deploymentConfig={localDeploymentConfig}
              onChange={handleFieldChange}
              onDeploymentChange={(field, value) => {
                setLocalDeploymentConfig(prev => ({ ...prev, [field]: value }));
              }}
              onBack={() => setSelectedTemplate(null)}
              error={error}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          )}

          {activeTab === 'templates' && selectedTemplate && selectedTemplate.provider !== 'local' && (
            <TemplateForm
              template={selectedTemplate}
              formData={formData}
              onChange={handleFieldChange}
              onBack={() => setSelectedTemplate(null)}
              error={error}
              testResult={testResult}
              testing={testing}
              submitting={submitting}
              onTest={handleTestConnection}
              onSubmit={handleSubmit}
            />
          )}

          {activeTab === 'manual' && (
            <ManualForm
              formData={formData}
              onChange={handleFieldChange}
              error={error}
              testResult={testResult}
              testing={testing}
              submitting={submitting}
              onTest={handleTestConnection}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Template Selector Sub-Component
interface TemplateSelectorProps {
  templatesByProvider: Record<string, ModelTemplate[]>;
  onSelect: (template: ModelTemplate) => void;
}

function TemplateSelector({ templatesByProvider, onSelect }: TemplateSelectorProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Select a pre-configured template to quickly add a model. You&apos;ll just need to provide your API key.
      </p>

      {Object.entries(templatesByProvider).map(([provider, templates]) => (
        <div key={provider}>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
            {provider}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className="text-left p-4 border border-input rounded-lg hover:border-blue-500 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium">{template.name}</h4>
                  <div className="flex gap-1">
                    {template.supports_streaming && <Zap className="h-3 w-3 text-green-600" />}
                    {template.supports_functions && <Sparkles className="h-3 w-3 text-blue-600" />}
                    {template.supports_vision && <Eye className="h-3 w-3 text-purple-600" />}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  {template.context_length.toLocaleString()} tokens • {template.model_id}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Template Form Sub-Component
interface TemplateFormProps {
  template: ModelTemplate;
  formData: Partial<CreateModelDTO>;
  onChange: (field: keyof CreateModelDTO, value: unknown) => void;
  onBack: () => void;
  error: string | null;
  testResult: { success: boolean; message: string; latency?: number } | null;
  testing: boolean;
  submitting: boolean;
  onTest: () => void;
  onSubmit: () => void;
}

function TemplateForm({
  template,
  formData,
  onChange,
  onBack,
  error,
  testResult,
  testing,
  submitting,
  onTest,
  onSubmit,
}: TemplateFormProps) {
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="outline" size="sm" onClick={onBack} disabled={submitting}>
        ← Back to Templates
      </Button>

      {/* Template info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold">{template.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
          </div>
          <div className="flex gap-1">
            {template.supports_streaming && <Zap className="h-4 w-4 text-green-600" />}
            {template.supports_functions && <Sparkles className="h-4 w-4 text-blue-600" />}
            {template.supports_vision && <Eye className="h-4 w-4 text-purple-600" />}
          </div>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground mt-3">
          <span>Provider: {template.provider}</span>
          <span>Model: {template.model_id}</span>
          <span>Context: {template.context_length.toLocaleString()} tokens</span>
        </div>
      </div>

      {/* HuggingFace Custom Import Helper */}
      {template.id === 'huggingface-custom-import' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h4 className="font-medium text-amber-900 mb-2">📚 Importing Your Trained Model</h4>
          <div className="text-sm text-amber-800 space-y-2">
            <p>
              <strong>Model ID Format:</strong> Use your HuggingFace model path (e.g., <code className="bg-amber-100 px-1 py-0.5 rounded">username/model-name</code>)
            </p>
            <p>
              <strong>API Token:</strong> Get it from <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900">huggingface.co/settings/tokens</a>
            </p>
            <p className="text-xs">
              💡 For FineTune Lab models, use the model path you pushed to HuggingFace Hub
            </p>
          </div>
        </div>
      )}

      {/* RunPod vLLM Helper */}
      {template.provider === 'runpod' && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 className="font-medium text-purple-900 mb-2">🚀 RunPod vLLM Endpoint</h4>
          <div className="text-sm text-purple-800 space-y-2">
            <p>
              <strong>Pod ID:</strong> Find your pod ID in the{' '}
              <a href="https://www.runpod.io/console/pods" target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-900">
                RunPod dashboard
              </a>{' '}
              (looks like: <code className="bg-purple-100 px-1 py-0.5 rounded">abc123xyz</code>)
            </p>
            <p>
              <strong>Model ID:</strong> The HuggingFace model name loaded in vLLM
            </p>
            <p className="text-xs">
              💡 No API key needed - vLLM endpoint is accessible via RunPod proxy URL
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        {/* Model Name */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Model Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="e.g., My GPT-4o Mini"
            className="w-full px-3 py-2 border border-input rounded-md bg-background"
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Give this model a unique name to identify it&apos;s in your account
          </p>
        </div>

        {/* Model ID - Editable for custom import */}
        {template.id === 'huggingface-custom-import' && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Model ID <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formData.model_id || ''}
              onChange={(e) => onChange('model_id', e.target.value)}
              placeholder="username/qwen3-0.6b-tool-use-v1"
              className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter your HuggingFace model path (format: username/model-name)
            </p>
          </div>
        )}

        {/* RunPod Pod ID and Model ID */}
        {template.provider === 'runpod' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">
                RunPod Pod ID <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.base_url?.match(/https:\/\/([^-]+)-8000/)?.[1] || ''}
                onChange={(e) => {
                  const podId = e.target.value.trim();
                  onChange('base_url', `https://${podId}-8000.proxy.runpod.net/v1`);
                }}
                placeholder="abc123xyz"
                className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your RunPod pod ID from the dashboard (e.g., abc123xyz)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Model ID <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.model_id || ''}
                onChange={(e) => onChange('model_id', e.target.value)}
                placeholder="Qwen/Qwen2.5-7B-Instruct"
                className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The HuggingFace model name loaded in your vLLM server
              </p>
            </div>
          </>
        )}

        {/* API Key - hide for RunPod since vLLM via proxy doesn't need auth */}
        {template.provider !== 'runpod' && (
          <div>
            <label className="block text-sm font-medium mb-2">
              API Key <span className="text-muted-foreground text-xs">(Optional - uses provider secret if empty)</span>
            </label>
            <input
              type="password"
              value={formData.api_key || ''}
              onChange={(e) => onChange('api_key', e.target.value)}
              placeholder={`Your ${template.provider} API key (or leave empty)`}
              className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to use the provider secret configured in <a href="/secrets" className="text-primary hover:underline">Provider Secrets</a>
            </p>
          </div>
        )}

        {/* Optional: Description */}
        <div>
          <label className="block text-sm font-medium mb-2">Description (Optional)</label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Add notes about this model..."
            rows={2}
            className="w-full px-3 py-2 border border-input rounded-md bg-background resize-none"
            disabled={submitting}
          />
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`p-3 rounded-md text-sm ${
            testResult.success
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <p className="font-medium">{testResult.message}</p>
          {testResult.latency && (
            <p className="text-xs mt-1">Latency: {testResult.latency}ms</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/20">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          variant="outline"
          onClick={onTest}
          disabled={testing || submitting}
          className="flex-1"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </Button>
        <Button onClick={onSubmit} disabled={submitting || testing} className="flex-1">
          {submitting ? 'Creating...' : 'Create Model'}
        </Button>
      </div>
    </div>
  );
}

// Local Model Form Sub-Component
interface LocalModelFormProps {
  template: ModelTemplate;
  formData: Partial<CreateModelDTO>;
  deploymentConfig: {
    server_type: 'vllm' | 'ollama' | 'runpod-serverless';
    model_path: string;
    gpu_memory_utilization: number;
    max_model_len?: number;
    tensor_parallel_size: number;
    context_length: number;
  };
  onChange: (field: keyof CreateModelDTO, value: unknown) => void;
  onDeploymentChange: (field: string, value: unknown) => void;
  onBack: () => void;
  error: string | null;
  submitting: boolean;
  onSubmit: () => void;
}

function LocalModelForm({
  template,
  formData,
  deploymentConfig,
  onChange,
  onDeploymentChange,
  onBack,
  error,
  submitting,
  onSubmit,
}: LocalModelFormProps) {
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="outline" size="sm" onClick={onBack} disabled={submitting}>
        ← Back to Templates
      </Button>

      {/* Template info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold">{template.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
          </div>
          <div className="flex gap-1">
            {template.supports_streaming && <Zap className="h-4 w-4 text-green-600" />}
            {template.supports_functions && <Sparkles className="h-4 w-4 text-blue-600" />}
          </div>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground mt-3">
          <span>Server: {deploymentConfig.server_type === 'vllm' ? 'vLLM' : 'Ollama'}</span>
          <span>Provider: Local Deployment</span>
        </div>
      </div>

      {/* Deployment info box */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h4 className="font-medium text-amber-900 mb-2">🚀 Local Model Deployment</h4>
        <div className="text-sm text-amber-800 space-y-2">
          <p>
            <strong>Model Path:</strong> Can be a HuggingFace model ID (e.g., <code className="bg-amber-100 px-1 py-0.5 rounded">Qwen/Qwen2.5-0.5B</code>)
            or a local checkpoint path
          </p>
          <p>
            <strong>Deployment:</strong> {deploymentConfig.server_type === 'vllm' ? 'Spawns a vLLM server with OpenAI-compatible API' : 'Converts to GGUF and registers with Ollama'}
          </p>
          <p className="text-xs">
            💡 This will start a local inference server and add the model to your models list
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Model Name */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Model Display Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="e.g., Qwen2.5-0.5B Base Model"
            className="w-full px-3 py-2 border border-input rounded-md bg-background"
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Friendly name for this model in your models list
          </p>
        </div>

        {/* Server Type */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Inference Server <span className="text-destructive">*</span>
          </label>
          <select
            value={deploymentConfig.server_type}
            onChange={(e) => onDeploymentChange('server_type', e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background"
            disabled={submitting}
          >
            <option value="vllm">vLLM (Fast, OpenAI-compatible)</option>
            <option value="ollama">Ollama (GGUF, lower memory)</option>
            <option value="runpod-serverless">RunPod Serverless (Cloud, auto-scaling)</option>
          </select>
        </div>

        {/* Model Path */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Model Path <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={deploymentConfig.model_path}
            onChange={(e) => onDeploymentChange('model_path', e.target.value)}
            placeholder="Qwen/Qwen2.5-0.5B or lib/training/logs/job_xxx/checkpoint-500"
            className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground mt-1">
            HuggingFace model ID or local checkpoint path
          </p>
        </div>

        {/* vLLM-specific options */}
        {deploymentConfig.server_type === 'vllm' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">
                GPU Memory Utilization (0.0 - 1.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="1.0"
                value={deploymentConfig.gpu_memory_utilization}
                onChange={(e) => onDeploymentChange('gpu_memory_utilization', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Fraction of GPU memory to use (default: 0.5 for testing multiple models)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Max Model Length (tokens, optional)
              </label>
              <input
                type="number"
                value={deploymentConfig.max_model_len || ''}
                onChange={(e) => onDeploymentChange('max_model_len', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Auto-detect from model"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={submitting}
              />
            </div>
          </>
        )}

        {/* Ollama-specific options */}
        {deploymentConfig.server_type === 'ollama' && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Context Length (tokens)
            </label>
            <input
              type="number"
              value={deploymentConfig.context_length}
              onChange={(e) => onDeploymentChange('context_length', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              disabled={submitting}
            />
          </div>
        )}

        {/* Optional: Description */}
        <div>
          <label className="block text-sm font-medium mb-2">Description (Optional)</label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Add notes about this deployment..."
            rows={2}
            className="w-full px-3 py-2 border border-input rounded-md bg-background resize-none"
            disabled={submitting}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/20">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <Button onClick={onSubmit} disabled={submitting} className="flex-1">
          {submitting ? 'Deploying...' : 'Deploy Model'}
        </Button>
      </div>
    </div>
  );
}

// Manual Form Sub-Component
interface ManualFormProps {
  formData: Partial<CreateModelDTO>;
  onChange: (field: keyof CreateModelDTO, value: unknown) => void;
  error: string | null;
  testResult: { success: boolean; message: string; latency?: number } | null;
  testing: boolean;
  submitting: boolean;
  onTest: () => void;
  onSubmit: () => void;
}

function ManualForm({
  formData,
  onChange,
  error,
  testResult,
  testing,
  submitting,
  onTest,
  onSubmit,
}: ManualFormProps) {
  const providers: ModelProvider[] = ['openai', 'anthropic', 'huggingface', 'ollama', 'vllm', 'azure', 'runpod', 'fireworks'];
  const authTypes: AuthType[] = ['bearer', 'api_key', 'custom_header', 'none'];

  // Provider-specific helper for base URL
  const getProviderHelp = (provider: ModelProvider) => {
    switch (provider) {
      case 'runpod':
        return {
          placeholder: 'https://{pod_id}-8000.proxy.runpod.net/v1',
          hint: 'Your RunPod vLLM pod URL. Find pod_id in RunPod dashboard.',
        };
      case 'vllm':
        return {
          placeholder: 'http://localhost:8000/v1',
          hint: 'Local vLLM server endpoint',
        };
      case 'ollama':
        return {
          placeholder: 'http://localhost:11434/v1',
          hint: 'Local Ollama server endpoint',
        };
      case 'fireworks':
        return {
          placeholder: 'https://api.fireworks.ai/inference/v1',
          hint: 'Fireworks.ai API - fast inference with <1s cold starts',
        };
      default:
        return {
          placeholder: 'https://api.example.com/v1',
          hint: null,
        };
    }
  };

  const providerHelp = getProviderHelp(formData.provider as ModelProvider);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Create a custom model configuration for any OpenAI-compatible API endpoint.
      </p>

      {/* RunPod helper info box */}
      {formData.provider === 'runpod' && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 className="font-medium text-purple-900 mb-2">RunPod vLLM Endpoint</h4>
          <div className="text-sm text-purple-800 space-y-2">
            <p>
              <strong>Base URL Format:</strong>{' '}
              <code className="bg-purple-100 px-1 py-0.5 rounded">
                https://&#123;pod_id&#125;-8000.proxy.runpod.net/v1
              </code>
            </p>
            <p>
              <strong>Model ID:</strong> Use the model name loaded in vLLM (e.g., the HuggingFace model ID)
            </p>
            <p className="text-xs">
              Find your pod_id in the RunPod dashboard under your running pod. The proxy URL gives you direct access to the vLLM OpenAI-compatible API.
            </p>
          </div>
        </div>
      )}

      {/* Fireworks helper info box */}
      {formData.provider === 'fireworks' && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <h4 className="font-medium text-orange-900 mb-2">Fireworks.ai - Fast Inference</h4>
          <div className="text-sm text-orange-800 space-y-2">
            <p>
              <strong>Base URL:</strong>{' '}
              <code className="bg-orange-100 px-1 py-0.5 rounded">
                https://api.fireworks.ai/inference/v1
              </code>
            </p>
            <p>
              <strong>Model ID Format:</strong>{' '}
              <code className="bg-orange-100 px-1 py-0.5 rounded">
                accounts/fireworks/models/llama-v3p3-70b-instruct
              </code>
            </p>
            <p className="text-xs">
              Benefits: &lt;1s cold starts, no hosting fees for fine-tuned models, pay per token only. Get your API key at fireworks.ai/account/api-keys
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Model Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">
            Model Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="e.g., My Custom vLLM Model"
            className="w-full px-3 py-2 border border-input rounded-md bg-background"
            disabled={submitting}
          />
        </div>

        {/* Provider */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Provider <span className="text-destructive">*</span>
          </label>
          <select
            value={formData.provider || 'openai'}
            onChange={(e) => onChange('provider', e.target.value as ModelProvider)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background"
            disabled={submitting}
          >
            {providers.map(provider => (
              <option key={provider} value={provider}>
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Auth Type */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Authentication Type <span className="text-destructive">*</span>
          </label>
          <select
            value={formData.auth_type || 'bearer'}
            onChange={(e) => onChange('auth_type', e.target.value as AuthType)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background"
            disabled={submitting}
          >
            {authTypes.map(type => (
              <option key={type} value={type}>
                {type === 'bearer' ? 'Bearer Token' : type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Base URL */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">
            Base URL <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={formData.base_url || ''}
            onChange={(e) => onChange('base_url', e.target.value)}
            placeholder={providerHelp.placeholder}
            className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
            disabled={submitting}
          />
          {providerHelp.hint && (
            <p className="text-xs text-muted-foreground mt-1">{providerHelp.hint}</p>
          )}
        </div>

        {/* Model ID */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Model ID <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={formData.model_id || ''}
            onChange={(e) => onChange('model_id', e.target.value)}
            placeholder="gpt-4o-mini"
            className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
            disabled={submitting}
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium mb-2">
            API Key <span className="text-muted-foreground text-xs">(Optional - uses provider secret if empty)</span>
          </label>
          <input
            type="password"
            value={formData.api_key || ''}
            onChange={(e) => onChange('api_key', e.target.value)}
            placeholder="sk-... (or leave empty)"
            className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
            disabled={submitting || formData.auth_type === 'none'}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty to use the provider secret configured in <a href="/secrets" className="text-primary hover:underline">Provider Secrets</a>
          </p>
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Add notes about this model..."
            rows={2}
            className="w-full px-3 py-2 border border-input rounded-md bg-background resize-none"
            disabled={submitting}
          />
        </div>

        {/* Capabilities */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">Capabilities</label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.supports_streaming || false}
                onChange={(e) => onChange('supports_streaming', e.target.checked)}
                disabled={submitting}
                className="rounded border-input"
              />
              <span className="text-sm">Supports Streaming</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.supports_functions || false}
                onChange={(e) => onChange('supports_functions', e.target.checked)}
                disabled={submitting}
                className="rounded border-input"
              />
              <span className="text-sm">Supports Tools/Functions</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.supports_vision || false}
                onChange={(e) => onChange('supports_vision', e.target.checked)}
                disabled={submitting}
                className="rounded border-input"
              />
              <span className="text-sm">Supports Vision</span>
            </label>
          </div>
        </div>

        {/* Context Length */}
        <div>
          <label className="block text-sm font-medium mb-2">Context Length (tokens)</label>
          <input
            type="number"
            value={formData.context_length || 4096}
            onChange={(e) => onChange('context_length', parseInt(e.target.value))}
            min="1"
            className="w-full px-3 py-2 border border-input rounded-md bg-background"
            disabled={submitting}
          />
        </div>

        {/* Max Output Tokens */}
        <div>
          <label className="block text-sm font-medium mb-2">Max Output Tokens</label>
          <input
            type="number"
            value={formData.max_output_tokens || 2000}
            onChange={(e) => onChange('max_output_tokens', parseInt(e.target.value))}
            min="1"
            className="w-full px-3 py-2 border border-input rounded-md bg-background"
            disabled={submitting}
          />
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`p-3 rounded-md text-sm ${
            testResult.success
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <p className="font-medium">{testResult.message}</p>
          {testResult.latency && (
            <p className="text-xs mt-1">Latency: {testResult.latency}ms</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/20">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          variant="outline"
          onClick={onTest}
          disabled={testing || submitting}
          className="flex-1"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </Button>
        <Button onClick={onSubmit} disabled={submitting || testing} className="flex-1">
          {submitting ? 'Creating...' : 'Create Model'}
        </Button>
      </div>
    </div>
  );
}
