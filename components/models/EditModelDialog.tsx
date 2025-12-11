"use client";

/**
 * EditModelDialog Component
 * Handles in-place editing for existing user models.
 * Provides validation + diffing so we only send changed fields to the API.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { AuthType, LLMModelDisplay, UpdateModelDTO } from '@/lib/models/llm-model.types';

interface EditModelDialogProps {
  isOpen: boolean;
  model: LLMModelDisplay | null;
  sessionToken: string;
  onClose: () => void;
  onUpdated: () => void;
}

interface EditFormState {
  name: string;
  description: string;
  base_url: string;
  model_id: string;
  auth_type: AuthType;
  supports_streaming: boolean;
  supports_functions: boolean;
  supports_vision: boolean;
  context_length: string;
  max_output_tokens: string;
  price_per_input_token: string;
  price_per_output_token: string;
  default_temperature: string;
  default_top_p: string;
  enabled: boolean;
}

const DEFAULT_FORM_STATE: EditFormState = {
  name: '',
  description: '',
  base_url: '',
  model_id: '',
  auth_type: 'bearer',
  supports_streaming: true,
  supports_functions: true,
  supports_vision: false,
  context_length: '4096',
  max_output_tokens: '2000',
  price_per_input_token: '',
  price_per_output_token: '',
  default_temperature: '0.7',
  default_top_p: '1',
  enabled: true,
};

const AUTH_TYPES: AuthType[] = ['bearer', 'api_key', 'custom_header', 'none'];

export function EditModelDialog({
  isOpen,
  model,
  sessionToken,
  onClose,
  onUpdated,
}: EditModelDialogProps) {
  const [formData, setFormData] = useState<EditFormState>(DEFAULT_FORM_STATE);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [authHeadersText, setAuthHeadersText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sync form state when dialog opens or model changes
  useEffect(() => {
    if (model && isOpen) {
      setFormData({
        name: model.name,
        description: model.description || '',
        base_url: model.base_url,
        model_id: model.model_id,
        auth_type: model.auth_type,
        supports_streaming: model.supports_streaming,
        supports_functions: model.supports_functions,
        supports_vision: model.supports_vision,
        context_length: String(model.context_length),
        max_output_tokens: String(model.max_output_tokens),
        price_per_input_token: model.price_per_input_token?.toString() ?? '',
        price_per_output_token: model.price_per_output_token?.toString() ?? '',
        default_temperature: model.default_temperature.toString(),
        default_top_p: model.default_top_p.toString(),
        enabled: model.enabled,
      });
      setApiKeyInput('');
      setAuthHeadersText(
        model.auth_headers && Object.keys(model.auth_headers).length > 0
          ? JSON.stringify(model.auth_headers, null, 2)
          : ''
      );
      setError(null);
    } else if (!isOpen) {
      setFormData(DEFAULT_FORM_STATE);
      setApiKeyInput('');
      setAuthHeadersText('');
      setError(null);
    }
  }, [model, isOpen]);

  const handleFieldChange = <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const parsedAuthHeaders = useMemo(() => {
    if (!authHeadersText.trim()) return model?.auth_headers ?? {};

    try {
      const parsed = JSON.parse(authHeadersText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
      return null;
    } catch {
      return null;
    }
  }, [authHeadersText, model?.auth_headers]);

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Model name is required.';
    if (!formData.base_url.trim()) return 'Base URL is required.';
    if (!formData.model_id.trim()) return 'Model ID is required.';
    if (Number.isNaN(Number(formData.context_length)) || Number(formData.context_length) <= 0) {
      return 'Context length must be a positive number.';
    }
    if (Number.isNaN(Number(formData.max_output_tokens)) || Number(formData.max_output_tokens) <= 0) {
      return 'Max output tokens must be a positive number.';
    }
    if (!parsedAuthHeaders && authHeadersText.trim()) {
      return 'Auth headers must be valid JSON object with string keys.';
    }
    return null;
  };

  const buildPayload = (): UpdateModelDTO => {
    if (!model) return {};
    const payload: UpdateModelDTO = {};

    const trimmedName = formData.name.trim();
    if (trimmedName !== model.name) payload.name = trimmedName;

    const descriptionNormalized = formData.description.trim();
    if ((model.description || '') !== descriptionNormalized) {
      payload.description = descriptionNormalized;
    }

    const trimmedBaseUrl = formData.base_url.trim();
    if (trimmedBaseUrl !== model.base_url) payload.base_url = trimmedBaseUrl;

    const trimmedModelId = formData.model_id.trim();
    if (trimmedModelId !== model.model_id) payload.model_id = trimmedModelId;

    if (formData.auth_type !== model.auth_type) payload.auth_type = formData.auth_type;

    if (formData.supports_streaming !== model.supports_streaming) {
      payload.supports_streaming = formData.supports_streaming;
    }
    if (formData.supports_functions !== model.supports_functions) {
      payload.supports_functions = formData.supports_functions;
    }
    if (formData.supports_vision !== model.supports_vision) {
      payload.supports_vision = formData.supports_vision;
    }

    const contextLength = Number(formData.context_length);
    if (contextLength !== model.context_length) payload.context_length = contextLength;

    const maxOutput = Number(formData.max_output_tokens);
    if (maxOutput !== model.max_output_tokens) payload.max_output_tokens = maxOutput;

    const priceInput = formData.price_per_input_token.trim();
    if (priceInput !== '') {
      const normalizedPriceInput = Number(priceInput);
      if (Number.isFinite(normalizedPriceInput) && normalizedPriceInput !== model.price_per_input_token) {
        payload.price_per_input_token = normalizedPriceInput;
      }
    }

    const priceOutput = formData.price_per_output_token.trim();
    if (priceOutput !== '') {
      const normalizedPriceOutput = Number(priceOutput);
      if (Number.isFinite(normalizedPriceOutput) && normalizedPriceOutput !== model.price_per_output_token) {
        payload.price_per_output_token = normalizedPriceOutput;
      }
    }

    const temperature = Number(formData.default_temperature);
    if (!Number.isNaN(temperature) && temperature !== model.default_temperature) {
      payload.default_temperature = temperature;
    }

    const topP = Number(formData.default_top_p);
    if (!Number.isNaN(topP) && topP !== model.default_top_p) {
      payload.default_top_p = topP;
    }

    if (formData.enabled !== model.enabled) {
      payload.enabled = formData.enabled;
    }

    if (parsedAuthHeaders && JSON.stringify(parsedAuthHeaders) !== JSON.stringify(model.auth_headers || {})) {
      payload.auth_headers = parsedAuthHeaders;
    }

    const trimmedApiKey = apiKeyInput.trim();
    if (trimmedApiKey) {
      payload.api_key = trimmedApiKey;
    }

    return payload;
  };

  const handleSubmit = async () => {
    if (!model) return;
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = buildPayload();
    if (Object.keys(payload).length === 0) {
      setError('No changes to save.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`/api/models/${model.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update model');
      }

      toast.success('Model updated successfully.');
      onUpdated();
      onClose();
    } catch (err) {
      console.error('[EditModelDialog] Update failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to update model');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverlayClick = () => {
    if (!submitting) {
      onClose();
    }
  };

  if (!isOpen || !model) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-background rounded-lg shadow-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Edit Model</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Update configuration for <strong>{model.name}</strong>
            </p>
          </div>
          <button
            onClick={handleOverlayClick}
            disabled={submitting}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Model Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={submitting}
              />
            </div>

            {/* Provider (read-only) */}
            <div>
              <label className="block text-sm font-medium mb-2">Provider</label>
              <input
                type="text"
                value={model.provider}
                disabled
                className="w-full px-3 py-2 border border-dashed rounded-md bg-muted/30 text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Base URL */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                Base URL <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.base_url}
                onChange={(e) => handleFieldChange('base_url', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
                disabled={submitting}
              />
            </div>

            {/* Model ID */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                Model ID <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.model_id}
                onChange={(e) => handleFieldChange('model_id', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
                disabled={submitting}
              />
            </div>

            {/* Auth Type */}
            <div>
              <label className="block text-sm font-medium mb-2">Auth Type</label>
              <select
                value={formData.auth_type}
                onChange={(e) => handleFieldChange('auth_type', e.target.value as AuthType)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={submitting}
              >
                {AUTH_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Enabled */}
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => handleFieldChange('enabled', e.target.checked)}
                  disabled={submitting}
                  className="rounded border-input"
                  id="model-enabled"
                />
                <label htmlFor="model-enabled" className="text-sm">
                  Enabled
                </label>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-input rounded-md bg-background resize-none"
              disabled={submitting}
            />
          </div>

          {/* Capabilities */}
          <div>
            <label className="block text-sm font-medium mb-2">Capabilities</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.supports_streaming}
                  onChange={(e) => handleFieldChange('supports_streaming', e.target.checked)}
                  disabled={submitting}
                  className="rounded border-input"
                />
                Streaming
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.supports_functions}
                  onChange={(e) => handleFieldChange('supports_functions', e.target.checked)}
                  disabled={submitting}
                  className="rounded border-input"
                />
                Tools / Functions
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.supports_vision}
                  onChange={(e) => handleFieldChange('supports_vision', e.target.checked)}
                  disabled={submitting}
                  className="rounded border-input"
                />
                Vision
              </label>
            </div>
          </div>

          {/* Numeric settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Context Length (tokens)</label>
              <input
                type="number"
                min={1}
                value={formData.context_length}
                onChange={(e) => handleFieldChange('context_length', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Max Output Tokens</label>
              <input
                type="number"
                min={1}
                value={formData.max_output_tokens}
                onChange={(e) => handleFieldChange('max_output_tokens', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Default Temperature</label>
              <input
                type="number"
                step="0.01"
                value={formData.default_temperature}
                onChange={(e) => handleFieldChange('default_temperature', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Default Top P</label>
              <input
                type="number"
                step="0.01"
                value={formData.default_top_p}
                onChange={(e) => handleFieldChange('default_top_p', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Price per Input Token (USD)</label>
              <input
                type="number"
                step="0.000001"
                value={formData.price_per_input_token}
                onChange={(e) => handleFieldChange('price_per_input_token', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={submitting}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Price per Output Token (USD)</label>
              <input
                type="number"
                step="0.000001"
                value={formData.price_per_output_token}
                onChange={(e) => handleFieldChange('price_per_output_token', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={submitting}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Auth headers */}
          <div>
            <label className="block text-sm font-medium mb-2">Custom Auth Headers (JSON)</label>
            <textarea
              value={authHeadersText}
              onChange={(e) => setAuthHeadersText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-xs"
              placeholder='e.g., { "X-API-Key": "abc123" }'
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank to keep existing headers. Must be valid JSON.
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium mb-2">
              API Key <span className="text-muted-foreground text-xs">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
              disabled={submitting}
              placeholder={model.has_api_key ? `${model.api_key_preview ?? '••••••'}` : 'sk-...'}
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/20">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleOverlayClick} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
