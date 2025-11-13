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

interface AddModelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  sessionToken: string;
}

type TabType = 'templates' | 'manual';

export function AddModelDialog({ isOpen, onClose, onSuccess, userId, sessionToken }: AddModelDialogProps) {
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

    setError(null);
    setTestResult(null);
  };

  const handleFieldChange = (field: keyof CreateModelDTO, value: any) => {
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

    // Create AbortController for 30 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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

      onSuccess();
      onClose();
    } catch (err) {
      console.error('[AddModelDialog] Create model error:', err);
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

          {activeTab === 'templates' && selectedTemplate && (
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
        Select a pre-configured template to quickly add a model. You'll just need to provide your API key.
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
  onChange: (field: keyof CreateModelDTO, value: any) => void;
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
            Give this model a unique name to identify it in your account
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

        {/* API Key */}
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

// Manual Form Sub-Component
interface ManualFormProps {
  formData: Partial<CreateModelDTO>;
  onChange: (field: keyof CreateModelDTO, value: any) => void;
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
  const providers: ModelProvider[] = ['openai', 'anthropic', 'huggingface', 'ollama', 'vllm', 'azure'];
  const authTypes: AuthType[] = ['bearer', 'api_key', 'custom_header', 'none'];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Create a custom model configuration for any OpenAI-compatible API endpoint.
      </p>

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
            placeholder="https://api.example.com/v1"
            className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
            disabled={submitting}
          />
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
