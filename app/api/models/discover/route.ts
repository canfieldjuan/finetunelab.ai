// API route for discovering available models from a provider endpoint
// POST /api/models/discover - List models from an OpenAI-compatible GET {base_url}/models
// Mirrors the provider-secret resolution used by /api/models/test-connection.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { DiscoveredModel, ModelProvider } from '@/lib/models/llm-model.types';

export const runtime = 'nodejs';

// Providers that expose an OpenAI-compatible `GET {base_url}/models` list endpoint.
// Anthropic (no public list endpoint) and Azure (uses a deployments list) are excluded,
// as is HuggingFace's inference API (no OpenAI-style /models listing).
const DISCOVERY_SUPPORTED = new Set([
  'openai',
  'vllm',
  'ollama',
  'together',
  'groq',
  'openrouter',
  'fireworks',
  'runpod',
  'custom',
]);

function isLocalUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const provider: string | undefined = body.provider;
    const baseUrl: string | undefined = body.base_url;
    const authType: string | undefined = body.auth_type;
    let apiKey: string | undefined = body.api_key;

    if (!provider || !baseUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields', required: ['provider', 'base_url'] },
        { status: 400 }
      );
    }

    if (!DISCOVERY_SUPPORTED.has(provider)) {
      return NextResponse.json({
        success: false,
        unsupported: true,
        message: `Automatic model discovery isn't available for "${provider}". Enter the Model ID manually.`,
      });
    }

    // API key resolution: use provided key, else look up the user's provider secret.
    // Mirrors app/api/models/test-connection/route.ts.
    if ((!apiKey || apiKey.trim() === '') && authType !== 'none') {
      const authHeader = request.headers.get('authorization');
      if (authHeader) {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
          const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
          });

          const { data: { user } } = await supabase.auth.getUser();

          if (user) {
            const { secretsManager } = await import('@/lib/secrets/secrets-manager.service');
            const providerKey = await secretsManager.getDecryptedApiKey(user.id, provider as ModelProvider, supabase);
            if (providerKey) {
              apiKey = providerKey;
            }
          }
        } catch (error) {
          console.warn('[ModelsAPI] discover: provider secret lookup failed:', error);
          // Continue without a key - the endpoint may not require auth (e.g. local vLLM).
        }
      }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey && authType !== 'none') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/models`;
    const startTime = Date.now();

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      response = await fetch(url, { method: 'GET', headers, signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (error) {
      const hint = isLocalUrl(baseUrl)
        ? ' FineTune Lab runs in the cloud and cannot reach localhost — expose your server with a public URL (RunPod proxy, Cloudflare Tunnel, or ngrok).'
        : '';
      return NextResponse.json({
        success: false,
        error: 'discovery_failed',
        message: `Could not reach ${url}.${hint}`,
        details: error instanceof Error ? error.message : 'Network error',
      });
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({} as Record<string, unknown>));
      const detail =
        (errBody as { error?: { message?: string } | string })?.error;
      const detailMessage =
        typeof detail === 'string' ? detail : detail?.message || undefined;
      return NextResponse.json({
        success: false,
        error: 'discovery_failed',
        message: `Model list request failed: ${response.status} ${response.statusText}`,
        details: detailMessage,
      });
    }

    const data = await response.json().catch(() => ({} as Record<string, unknown>));

    // OpenAI-compatible format: { data: [{ id, ... }] }. Some servers use { models: [...] }.
    const rawList: unknown[] = Array.isArray((data as { data?: unknown[] }).data)
      ? (data as { data: unknown[] }).data
      : Array.isArray((data as { models?: unknown[] }).models)
        ? (data as { models: unknown[] }).models
        : [];

    const models: DiscoveredModel[] = rawList
      .map((m): DiscoveredModel | null => {
        const entry = m as Record<string, unknown>;
        const id =
          typeof entry.id === 'string'
            ? entry.id
            : typeof entry.name === 'string'
              ? entry.name
              : undefined;
        if (!id) return null;
        return {
          id,
          max_model_len:
            typeof entry.max_model_len === 'number' ? entry.max_model_len : undefined,
        };
      })
      .filter((m): m is DiscoveredModel => m !== null);

    return NextResponse.json({
      success: true,
      models,
      count: models.length,
      latency: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[ModelsAPI] discover error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to discover models',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
