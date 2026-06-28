// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditModelDialog } from '../EditModelDialog';
import { ModelCard } from '../ModelCard';
import type { LLMModelDisplay } from '@/lib/models/llm-model.types';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const baseModel: LLMModelDisplay = {
  id: 'model-1',
  user_id: 'user-1',
  name: 'Local Qwen',
  description: 'Local vLLM model',
  provider: 'vllm',
  base_url: 'http://localhost:8000/v1',
  model_id: '/models/qwen',
  served_model_name: 'qwen-chat',
  auth_type: 'none',
  auth_headers: {},
  supports_streaming: true,
  supports_functions: true,
  supports_vision: false,
  context_length: 4096,
  max_output_tokens: 2000,
  price_per_input_token: null,
  price_per_output_token: null,
  default_temperature: 0.7,
  default_top_p: 1,
  enabled: true,
  is_global: false,
  is_default: false,
  training_method: null,
  base_model: null,
  training_dataset: null,
  training_date: null,
  lora_config: null,
  evaluation_metrics: null,
  metadata: null,
  created_at: '2026-06-28T00:00:00.000Z',
  updated_at: '2026-06-28T00:00:00.000Z',
  last_used_at: null,
  has_api_key: false,
};

describe('EditModelDialog serving fields', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('patches served_model_name and is_default for an existing vLLM model', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ model: { id: 'model-1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onClose = vi.fn();
    const onUpdated = vi.fn();

    render(
      <EditModelDialog
        isOpen
        model={baseModel}
        sessionToken="session-token"
        onClose={onClose}
        onUpdated={onUpdated}
      />
    );

    fireEvent.change(screen.getByDisplayValue('qwen-chat'), {
      target: { value: 'qwen-chat-v2' },
    });
    fireEvent.click(screen.getByLabelText('Set as default model'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/models/model-1', expect.any(Object));
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(body).toEqual({
      served_model_name: 'qwen-chat-v2',
      is_default: true,
    });
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ModelCard default marker', () => {
  it('shows a default badge for the selected default model', () => {
    render(
      <ModelCard
        model={{ ...baseModel, is_default: true }}
        currentUserId="user-1"
      />
    );

    expect(screen.getByText('Default')).toBeInTheDocument();
  });
});
