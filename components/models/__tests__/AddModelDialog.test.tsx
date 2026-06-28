// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddModelDialog } from '../AddModelDialog';

function renderDialog() {
  return render(
    <AddModelDialog
      isOpen
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      userId="user-1"
      sessionToken="session-token"
    />
  );
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
});
