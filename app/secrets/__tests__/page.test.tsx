// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SecretsPage from '../page';
import type { ModelProvider } from '@/lib/models/llm-model.types';
import type { ProviderSecretDisplay } from '@/lib/secrets/secrets.types';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  authState: {
    user: { id: 'user-1', email: 'user@example.com' },
    session: { access_token: 'session-token' },
    signOut: vi.fn(),
    loading: false,
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mocks.authState,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock('@/components/layout/PageWrapper', () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/settings/ApiKeysManagement', () => ({
  ApiKeysManagement: () => <div data-testid="api-keys-management" />,
}));

vi.mock('@/components/settings/WidgetAppsManagement', () => ({
  WidgetAppsManagement: () => <div data-testid="widget-apps-management" />,
}));

vi.mock('@/components/settings/IntegrationsManagement', () => ({
  IntegrationsManagement: () => <div data-testid="integrations-management" />,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function secret(provider: ModelProvider): ProviderSecretDisplay {
  return {
    id: `secret-${provider}`,
    provider,
    api_key_preview: 'sk-...test',
    description: null,
    metadata: null,
    last_used_at: null,
    created_at: '2026-06-28T00:00:00.000Z',
    updated_at: '2026-06-28T00:00:00.000Z',
  };
}

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response> | Response;

function stubFetch(handler: FetchHandler) {
  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function openProviderDialog(providerLabel: string) {
  await screen.findByRole('heading', { name: 'Add Provider' });
  fireEvent.click(screen.getByRole('button', { name: providerLabel }));
  fireEvent.change(screen.getByPlaceholderText('sk-...'), {
    target: { value: 'sk-test-key' },
  });
}

describe('SecretsPage provider model import', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('discovers and imports hosted provider models after saving a provider secret', async () => {
    let secretsFetchCount = 0;
    const fetchMock = stubFetch(async (url, init) => {
      if (url === '/api/secrets' && !init?.method) {
        secretsFetchCount += 1;
        return jsonResponse({
          secrets: secretsFetchCount === 1 ? [] : [secret('openai')],
          count: secretsFetchCount === 1 ? 0 : 1,
        });
      }

      if (url === '/api/secrets' && init?.method === 'POST') {
        return jsonResponse({ success: true, secret: secret('openai') });
      }

      if (url === '/api/models/discover') {
        return jsonResponse({
          success: true,
          models: [
            { id: 'gpt-4o-mini' },
            { id: 'gpt-4.1-mini' },
            { id: 'text-embedding-3-small' },
            { id: 'dall-e-3' },
            { id: 'omni-moderation-latest' },
          ],
        });
      }

      if (url === '/api/models/bulk') {
        return jsonResponse({
          success: true,
          counts: { created: 2, skipped: 0, failed: 0 },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<SecretsPage />);

    await openProviderDialog('OpenAI');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Imported 2 OpenAI models.')).toBeInTheDocument();

    const discoverCall = fetchMock.mock.calls.find(([url]) => url === '/api/models/discover');
    expect(discoverCall).toBeDefined();
    const discoverBody = JSON.parse((discoverCall?.[1] as RequestInit).body as string);
    expect(discoverBody).toEqual({
      provider: 'openai',
      base_url: 'https://api.openai.com/v1',
      auth_type: 'bearer',
    });
    expect(discoverBody).not.toHaveProperty('api_key');

    const bulkCall = fetchMock.mock.calls.find(([url]) => url === '/api/models/bulk');
    expect(bulkCall).toBeDefined();
    const bulkBody = JSON.parse((bulkCall?.[1] as RequestInit).body as string);
    expect(bulkBody).toEqual({
      provider: 'openai',
      base_url: 'https://api.openai.com/v1',
      auth_type: 'bearer',
      supports_streaming: true,
      supports_functions: true,
      supports_vision: false,
      models: [
        { model_id: 'gpt-4o-mini', name: 'gpt-4o-mini', context_length: 128000 },
        { model_id: 'gpt-4.1-mini', name: 'gpt-4.1-mini', context_length: 128000 },
      ],
    });
    const importedModelIds = bulkBody.models.map((model: { model_id: string }) => model.model_id);
    expect(importedModelIds).not.toContain('text-embedding-3-small');
    expect(importedModelIds).not.toContain('dall-e-3');
    expect(importedModelIds).not.toContain('omni-moderation-latest');
  });

  it('chunks provider-secret model imports into 100-model bulk requests', async () => {
    const discoveredModels = Array.from({ length: 101 }, (_, index) => ({ id: `openrouter/model-${index}` }));
    const fetchMock = stubFetch(async (url, init) => {
      if (url === '/api/secrets' && !init?.method) {
        return jsonResponse({ secrets: [], count: 0 });
      }

      if (url === '/api/secrets' && init?.method === 'POST') {
        return jsonResponse({ success: true, secret: secret('openrouter') });
      }

      if (url === '/api/models/discover') {
        return jsonResponse({ success: true, models: discoveredModels });
      }

      if (url === '/api/models/bulk') {
        const body = JSON.parse(init?.body as string);
        return jsonResponse({
          success: true,
          counts: { created: body.models.length, skipped: 0, failed: 0 },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<SecretsPage />);

    await openProviderDialog('OpenRouter');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Imported 101 OpenRouter models.')).toBeInTheDocument();

    const bulkBodies = fetchMock.mock.calls
      .filter(([url]) => url === '/api/models/bulk')
      .map(([, init]) => JSON.parse((init as RequestInit).body as string));

    expect(bulkBodies.map((body) => body.models.length)).toEqual([100, 1]);
    expect(bulkBodies[0].provider).toBe('openrouter');
    expect(bulkBodies[0].base_url).toBe('https://openrouter.ai/api/v1');
    expect(bulkBodies[1].models[0]).toEqual({
      model_id: 'openrouter/model-100',
      name: 'openrouter/model-100',
      context_length: 128000,
    });
  });

  it('imports curated Anthropic catalog models without provider discovery', async () => {
    let secretsFetchCount = 0;
    const fetchMock = stubFetch(async (url, init) => {
      if (url === '/api/secrets' && !init?.method) {
        secretsFetchCount += 1;
        return jsonResponse({
          secrets: secretsFetchCount === 1 ? [] : [secret('anthropic')],
          count: secretsFetchCount === 1 ? 0 : 1,
        });
      }

      if (url === '/api/secrets' && init?.method === 'POST') {
        return jsonResponse({ success: true, secret: secret('anthropic') });
      }

      if (url === '/api/models/bulk') {
        const body = JSON.parse(init?.body as string);
        return jsonResponse({
          success: true,
          counts: { created: body.models.length, skipped: 0, failed: 0 },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<SecretsPage />);

    await openProviderDialog('Anthropic');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Imported 5 Anthropic models.')).toBeInTheDocument();

    expect(fetchMock.mock.calls.some(([url]) => url === '/api/models/discover')).toBe(false);
    const bulkCall = fetchMock.mock.calls.find(([url]) => url === '/api/models/bulk');
    expect(bulkCall).toBeDefined();
    const bulkBody = JSON.parse((bulkCall?.[1] as RequestInit).body as string);
    expect(bulkBody).toMatchObject({
      provider: 'anthropic',
      base_url: 'https://api.anthropic.com/v1',
      auth_type: 'api_key',
    });
    expect(bulkBody.models).toContainEqual({
      model_id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      context_length: 200000,
      max_output_tokens: 8192,
      supports_streaming: true,
      supports_functions: true,
      supports_vision: true,
      default_temperature: 0.7,
      default_top_p: 1,
    });
  });

  it('imports curated HuggingFace chat catalog models without importing GPT-2', async () => {
    const fetchMock = stubFetch(async (url, init) => {
      if (url === '/api/secrets' && !init?.method) {
        return jsonResponse({ secrets: [], count: 0 });
      }

      if (url === '/api/secrets' && init?.method === 'POST') {
        return jsonResponse({ success: true, secret: secret('huggingface') });
      }

      if (url === '/api/models/bulk') {
        const body = JSON.parse(init?.body as string);
        return jsonResponse({
          success: true,
          counts: { created: body.models.length, skipped: 0, failed: 0 },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<SecretsPage />);

    await openProviderDialog('HuggingFace');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Imported 4 HuggingFace models.')).toBeInTheDocument();

    expect(fetchMock.mock.calls.some(([url]) => url === '/api/models/discover')).toBe(false);
    const bulkCall = fetchMock.mock.calls.find(([url]) => url === '/api/models/bulk');
    expect(bulkCall).toBeDefined();
    const bulkBody = JSON.parse((bulkCall?.[1] as RequestInit).body as string);
    const importedModelIds = bulkBody.models.map((model: { model_id: string }) => model.model_id);

    expect(bulkBody.provider).toBe('huggingface');
    expect(importedModelIds).toEqual([
      'Qwen/Qwen2.5-0.5B',
      'mistralai/Mistral-7B-Instruct-v0.3',
      'meta-llama/Meta-Llama-3.1-8B-Instruct',
      'HuggingFaceH4/zephyr-7b-beta',
    ]);
    expect(importedModelIds).not.toContain('gpt2');
  });

  it('does not attempt model import for providers without discovery or catalog support', async () => {
    let secretsFetchCount = 0;
    const fetchMock = stubFetch(async (url, init) => {
      if (url === '/api/secrets' && !init?.method) {
        secretsFetchCount += 1;
        return jsonResponse({
          secrets: secretsFetchCount === 1 ? [] : [secret('github')],
          count: secretsFetchCount === 1 ? 0 : 1,
        });
      }

      if (url === '/api/secrets' && init?.method === 'POST') {
        return jsonResponse({ success: true, secret: secret('github') });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<SecretsPage />);

    await openProviderDialog('GitHub');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => url === '/api/secrets')).toHaveLength(2);
    });
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/models/discover')).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/models/bulk')).toBe(false);
  });
});
