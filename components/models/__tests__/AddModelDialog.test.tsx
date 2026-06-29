// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddModelDialog } from '../AddModelDialog';

function renderDialog(overrides: Partial<React.ComponentProps<typeof AddModelDialog>> = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    userId: 'user-1',
    sessionToken: 'session-token',
    ...overrides,
  };

  return {
    ...render(<AddModelDialog {...props} />),
    props,
  };
}

function selectProvider(container: HTMLElement, provider: string) {
  const providerSelect = container.querySelector('select');
  if (!providerSelect) {
    throw new Error('Provider select not found');
  }
  fireEvent.change(providerSelect, { target: { value: provider } });
}

function fillVllmFields(container: HTMLElement) {
  selectProvider(container, 'vllm');
  fireEvent.change(screen.getByPlaceholderText('e.g., My Custom vLLM Model'), {
    target: { value: 'Local Qwen' },
  });
  fireEvent.change(screen.getByPlaceholderText('gpt-4o-mini'), {
    target: { value: '/models/qwen' },
  });
  fireEvent.change(screen.getByPlaceholderText('qwen-chat'), {
    target: { value: 'qwen-chat' },
  });
}

function fillOllamaFields(container: HTMLElement) {
  selectProvider(container, 'ollama');
  fireEvent.change(screen.getByPlaceholderText('e.g., My Custom vLLM Model'), {
    target: { value: 'Local Llama' },
  });
  fireEvent.change(screen.getByPlaceholderText('gpt-4o-mini'), {
    target: { value: '/models/llama3.2' },
  });
  fireEvent.change(screen.getByPlaceholderText('qwen-chat'), {
    target: { value: 'llama3.2' },
  });
}

describe('AddModelDialog model serving fields', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('includes served_model_name and is_default when creating a model', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ model: { id: 'model-1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderDialog();
    fillVllmFields(container);
    fireEvent.click(screen.getByLabelText('Set as default model'));

    fireEvent.click(screen.getByRole('button', { name: 'Create Model' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/models', expect.any(Object));
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(body).toEqual(expect.objectContaining({
      name: 'Local Qwen',
      provider: 'vllm',
      base_url: 'http://localhost:8000/v1',
      model_id: '/models/qwen',
      served_model_name: 'qwen-chat',
      auth_type: 'none',
      is_default: true,
    }));
  });

  it('passes served_model_name through test connection requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        message: 'Connection successful',
        latency: 12,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderDialog();
    fillVllmFields(container);

    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/models/test-connection', expect.any(Object));
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(body).toEqual(expect.objectContaining({
      provider: 'vllm',
      model_id: '/models/qwen',
      served_model_name: 'qwen-chat',
      auth_type: 'none',
    }));
  });

  it('includes served_model_name for Ollama model creation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ model: { id: 'model-ollama' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderDialog();
    fillOllamaFields(container);

    fireEvent.click(screen.getByRole('button', { name: 'Create Model' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/models', expect.any(Object));
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(body).toEqual(expect.objectContaining({
      name: 'Local Llama',
      provider: 'ollama',
      base_url: 'http://localhost:11434/v1',
      model_id: '/models/llama3.2',
      served_model_name: 'llama3.2',
      auth_type: 'none',
    }));
  });

  it('bulk imports all discovered models by default', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/models/discover') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            models: [
              { id: 'gpt-4o-mini' },
              { id: 'gpt-4.1-mini' },
              { id: 'gpt-5-mini' },
            ],
          }),
        };
      }

      if (url === '/api/models/bulk') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            created: [{ id: 'model-1' }, { id: 'model-2' }, { id: 'model-3' }],
            skipped: [],
            failed: [],
            counts: { created: 3, skipped: 0, failed: 0 },
          }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    renderDialog({ onClose, onSuccess });

    fireEvent.click(screen.getByRole('button', { name: 'Fetch available models' }));

    await screen.findByText('Found 3 models');
    fireEvent.click(screen.getByRole('button', { name: 'Add selected (3)' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/models/bulk', expect.any(Object));
    });
    const bulkCall = fetchMock.mock.calls.find(([url]) => url === '/api/models/bulk');
    expect(bulkCall).toBeDefined();
    const [, init] = bulkCall as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(body).toEqual(expect.objectContaining({
      provider: 'openai',
      base_url: 'https://api.openai.com/v1',
      auth_type: 'bearer',
      models: [
        { model_id: 'gpt-4o-mini', name: 'gpt-4o-mini', context_length: 4096 },
        { model_id: 'gpt-4.1-mini', name: 'gpt-4.1-mini', context_length: 4096 },
        { model_id: 'gpt-5-mini', name: 'gpt-5-mini', context_length: 4096 },
      ],
    }));
    expect(body).not.toHaveProperty('metadata');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('chunks large bulk imports into 100-model requests', async () => {
    const discoveredModels = Array.from({ length: 101 }, (_, index) => ({ id: `provider/model-${index}` }));
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/models/discover') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            models: discoveredModels,
          }),
        };
      }

      if (url === '/api/models/bulk') {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          json: async () => ({
            success: true,
            created: body.models.map((model: { model_id: string }) => ({ id: model.model_id })),
            skipped: [],
            failed: [],
            counts: { created: body.models.length, skipped: 0, failed: 0 },
          }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Fetch available models' }));

    await screen.findByText('Found 101 models');
    fireEvent.click(screen.getByRole('button', { name: 'Add selected (101)' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => url === '/api/models/bulk')).toHaveLength(2);
    });
    const bulkBodies = fetchMock.mock.calls
      .filter(([url]) => url === '/api/models/bulk')
      .map(([, init]) => JSON.parse((init as RequestInit).body as string));

    expect(bulkBodies.map((body) => body.models.length)).toEqual([100, 1]);
    expect(bulkBodies[0].models[0]).toEqual({
      model_id: 'provider/model-0',
      name: 'provider/model-0',
      context_length: 4096,
    });
    expect(bulkBodies[1].models[0]).toEqual({
      model_id: 'provider/model-100',
      name: 'provider/model-100',
      context_length: 4096,
    });
  });
});
