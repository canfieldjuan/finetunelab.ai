// API route for testing LLM model connections
// POST /api/models/test-connection - Test if a model configuration works
// Date: 2025-10-14

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ModelConfig } from '@/lib/models/llm-model.types';

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
    const response = await fetch(`${config.base_url}/${config.model_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.api_key ? { 'Authorization': `Bearer ${config.api_key}` } : {}),
      },
      body: JSON.stringify({
        inputs: 'test',
        parameters: { max_new_tokens: 5 },
      }),
    });

    const latency = Date.now() - startTime;

    // For HuggingFace, consider these status codes as "successful connection":
    // - 200: Model generated response
    // - 401: Endpoint exists, but needs valid API key (connection is valid)
    // - 503: Model is loading (endpoint exists, model is valid)
    if (response.ok) {
      return {
        success: true,
        message: 'Connection successful - model is ready',
        latency,
      };
    }

    const errorData = await response.json().catch(() => ({}));

    // 401: Authentication required - but endpoint and model are valid
    if (response.status === 401) {
      return {
        success: true,
        message: config.api_key
          ? 'Connection successful - invalid API key, but model endpoint is valid'
          : 'Connection successful - model endpoint exists (API key may be required for inference)',
        latency,
      };
    }

    // 400: Could be endpoint paused or other issue
    if (response.status === 400) {
      const errorMsg = errorData.error || '';

      // Endpoint paused - model exists but is suspended
      if (errorMsg.includes('paused') || errorMsg.includes('restart')) {
        return {
          success: true,
          message: 'Connection successful - model endpoint exists but is paused (will auto-resume on first use)',
          latency,
        };
      }

      // Other 400 errors
      return {
        success: false,
        message: 'Bad request',
        error: errorMsg || 'Invalid request format',
        latency,
      };
    }

    // 503: Model is loading (cold start) - this is normal for HuggingFace
    if (response.status === 503) {
      return {
        success: true,
        message: 'Connection successful - model is loading (this is normal, try again in 30 seconds)',
        latency,
      };
    }

    // 404: Model not found - this is a real error
    if (response.status === 404) {
      return {
        success: false,
        message: 'Model not found',
        error: `Model "${config.model_id}" does not exist on HuggingFace`,
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
// Does NOT require authentication (allows testing before saving)
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

    // Build config from request
    const config: ModelConfig = {
      id: 'test',
      name: body.name || 'Test Model',
      provider: body.provider,
      base_url: body.base_url,
      model_id: body.model_id,
      auth_type: body.auth_type,
      api_key: body.api_key,
      auth_headers: body.auth_headers || {},
      supports_streaming: body.supports_streaming ?? true,
      supports_functions: body.supports_functions ?? false,
      supports_vision: body.supports_vision ?? false,
      context_length: body.context_length || 4096,
      max_output_tokens: body.max_output_tokens || 2000,
      default_temperature: body.default_temperature ?? 0.7,
      default_top_p: body.default_top_p ?? 1.0,
    };

    console.log('[ModelsAPI] Testing connection for provider:', config.provider);

    // Test connection based on provider
    let result;
    switch (config.provider) {
      case 'openai':
        result = await testOpenAIConnection(config);
        break;
      case 'anthropic':
        result = await testAnthropicConnection(config);
        break;
      case 'huggingface':
        result = await testHuggingFaceConnection(config);
        break;
      case 'ollama':
        result = await testOllamaConnection(config);
        break;
      case 'vllm':
        result = await testVLLMConnection(config);
        break;
      case 'azure':
        result = await testAzureConnection(config);
        break;
      case 'custom':
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
