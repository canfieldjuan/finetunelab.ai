// API route for testing LLM model connections
// POST /api/models/test-connection - Test if a model configuration works
// Date: 2025-10-14

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ModelConfig } from '@/lib/models/llm-model.types';
import { PROVIDERS } from '@/lib/constants';

export const runtime = 'nodejs';

// ============================================================================
// Connection test for different providers
// Each provider has different API formats and authentication methods
// ============================================================================

async function testOpenAIConnection(config: ModelConfig): Promise<{
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${config.base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key || ''}`,
      },
      body: JSON.stringify({
        model: config.model_id,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `Connection failed: ${response.status} ${response.statusText}`,
        error: errorData.error?.message || 'Unknown error',
        latency,
      };
    }

    return {
      success: true,
      message: 'Connection successful',
      latency,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Connection failed',
      error: error instanceof Error ? error.message : 'Network error',
      latency: Date.now() - startTime,
    };
  }
}

async function testAnthropicConnection(config: ModelConfig): Promise<{
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${config.base_url}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.api_key || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model_id,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `Connection failed: ${response.status} ${response.statusText}`,
        error: errorData.error?.message || 'Unknown error',
        latency,
      };
    }

    return {
      success: true,
      message: 'Connection successful',
      latency,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Connection failed',
      error: error instanceof Error ? error.message : 'Network error',
      latency: Date.now() - startTime,
    };
  }
}

async function testHuggingFaceConnection(config: ModelConfig): Promise<{
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // HuggingFace now uses OpenAI-compatible API format
    const response = await fetch(`${config.base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.api_key ? { 'Authorization': `Bearer ${config.api_key}` } : {}),
      },
      body: JSON.stringify({
        model: config.model_id,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      }),
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      return {
        success: true,
        message: 'Connection successful - model is ready',
        latency,
      };
    }

    // Try to parse JSON error, else fallback to text
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      try {
        const text = await response.text();
        errorData = { error: text };
      } catch {
        errorData = {};
      }
    }

    // 401: Authentication required/invalid
    if (response.status === 401) {
      return {
        success: false,
        message: 'Unauthorized - missing or invalid HuggingFace API token',
        error: errorData.error || 'Provide a valid HuggingFace token or save a provider secret',
        latency,
      };
    }

    // 400: Bad request (paused endpoints, invalid payload, etc.)
    if (response.status === 400) {
      const errorMsg = errorData.error || 'Invalid request';
      const informative = /paused|pause|resume|restart|loading/i.test(errorMsg);
      if (informative) {
        return {
          success: true,
          message: 'Endpoint reachable but paused/loading on HuggingFace (try again or wake the model).',
          latency,
        };
      }
      return {
        success: false,
        message: 'Bad request',
        error: errorMsg,
        latency,
      };
    }

    // 503: Model loading (cold start)
    if (response.status === 503) {
      return {
        success: true,
        message: 'Endpoint reachable - model is loading (cold start)',
        latency,
      };
    }

    // 404: Model not found
    if (response.status === 404) {
      return {
        success: false,
        message: 'Model not found',
        error: `Model "${config.model_id}" does not exist or is private`,
        latency,
      };
    }

    // Other errors
    return {
      success: false,
      message: `Connection failed: ${response.status} ${response.statusText}`,
      error: errorData.error || 'Unknown error',
      latency,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Connection failed',
      error: error instanceof Error ? error.message : 'Network error',
      latency: Date.now() - startTime,
    };
  }
}

async function testOllamaConnection(config: ModelConfig): Promise<{
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${config.base_url}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model_id,
        prompt: 'test',
        stream: false,
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `Connection failed: ${response.status} ${response.statusText}`,
        error: errorData.error || 'Unknown error',
        latency,
      };
    }

    return {
      success: true,
      message: 'Connection successful',
      latency,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Connection failed',
      error: error instanceof Error ? error.message : 'Network error',
      latency: Date.now() - startTime,
    };
  }
}

async function testVLLMConnection(config: ModelConfig): Promise<{
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
}> {
  // vLLM uses OpenAI-compatible API
  return testOpenAIConnection(config);
}

async function testAzureConnection(config: ModelConfig): Promise<{
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch(
      `${config.base_url}/openai/deployments/${config.model_id}/chat/completions?api-version=2024-02-15-preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.api_key || '',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5,
        }),
      }
    );

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `Connection failed: ${response.status} ${response.statusText}`,
        error: errorData.error?.message || 'Unknown error',
        latency,
      };
    }

    return {
      success: true,
      message: 'Connection successful',
      latency,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Connection failed',
      error: error instanceof Error ? error.message : 'Network error',
      latency: Date.now() - startTime,
    };
  }
}

// ============================================================================
// POST /api/models/test-connection - Test model configuration
// Supports provider secret fallback if no API key provided
// ============================================================================

export async function POST(request: NextRequest) {
  console.log('[ModelsAPI] POST /api/models/test-connection');

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.provider || !body.base_url || !body.model_id || !body.auth_type) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: ['provider', 'base_url', 'model_id', 'auth_type'],
        },
        { status: 400 }
      );
    }

    // API key resolution: use provided key OR look up provider secret
    let apiKey = body.api_key;

    // If no API key provided, try to look up provider secret
    if (!apiKey || apiKey.trim() === '') {
      console.log('[ModelsAPI] No API key in request, checking for provider secret');

      const authHeader = request.headers.get('authorization');
      if (authHeader) {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
          const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
              headers: {
                Authorization: authHeader,
              },
            },
          });

          const { data: { user } } = await supabase.auth.getUser();

          if (user) {
            // Import secrets manager and get provider secret
            const { secretsManager } = await import('@/lib/secrets/secrets-manager.service');
            // Pass authenticated client to bypass RLS
            const providerKey = await secretsManager.getDecryptedApiKey(user.id, body.provider, supabase);

            if (providerKey) {
              apiKey = providerKey;
              console.log('[ModelsAPI] Using provider secret for test connection');
            } else {
              console.log('[ModelsAPI] No provider secret found for:', body.provider);
            }
          }
        } catch (error) {
          console.log('[ModelsAPI] Could not lookup provider secret:', error);
          // Continue without API key - test will likely fail but that's informative
        }
      }
    }

    // Build config from request
    const config: ModelConfig = {
      id: 'test',
      name: body.name || 'Test Model',
      provider: body.provider,
      base_url: body.base_url,
      model_id: body.model_id,
      served_model_name: body.served_model_name || null,
      auth_type: body.auth_type,
      api_key: apiKey,
      auth_headers: body.auth_headers || {},
      supports_streaming: body.supports_streaming ?? true,
      supports_functions: body.supports_functions ?? false,
      supports_vision: body.supports_vision ?? false,
      context_length: body.context_length || parseInt(process.env.MODELS_DEFAULT_CONTEXT_LENGTH || '4096', 10),
      max_output_tokens: body.max_output_tokens || parseInt(process.env.MODELS_DEFAULT_MAX_OUTPUT_TOKENS || '2000', 10),
      default_temperature: body.default_temperature ?? parseFloat(process.env.MODELS_DEFAULT_TEMPERATURE || '0.7'),
      default_top_p: body.default_top_p ?? parseFloat(process.env.MODELS_DEFAULT_TOP_P || '1.0'),
    };

    console.log('[ModelsAPI] Testing connection for provider:', config.provider);

    // Test connection based on provider
    let result;
    switch (config.provider) {
      case PROVIDERS.OPENAI:
        result = await testOpenAIConnection(config);
        break;
      case PROVIDERS.ANTHROPIC:
        result = await testAnthropicConnection(config);
        break;
      case PROVIDERS.HUGGINGFACE:
        result = await testHuggingFaceConnection(config);
        break;
      case PROVIDERS.OLLAMA:
        result = await testOllamaConnection(config);
        break;
      case PROVIDERS.VLLM:
        result = await testVLLMConnection(config);
        break;
      case PROVIDERS.AZURE:
        result = await testAzureConnection(config);
        break;
      case PROVIDERS.CUSTOM:
        // For custom, try OpenAI-compatible first
        result = await testOpenAIConnection(config);
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unsupported provider: ${config.provider}`,
          },
          { status: 400 }
        );
    }

    console.log('[ModelsAPI] Connection test result:', result.success, 'latency:', result.latency, 'ms');

    return NextResponse.json({
      ...result,
      provider: config.provider,
      model_id: config.model_id,
    });

  } catch (error) {
    console.error('[ModelsAPI] Test connection error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
