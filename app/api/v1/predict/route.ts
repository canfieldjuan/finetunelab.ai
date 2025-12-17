/**
 * Public Predictions API
 * POST /api/v1/predict
 *
 * Purpose: Customer-facing inference endpoint (like OpenAI's /v1/chat/completions)
 * Auth: Requires API key with 'production' scope
 * Date: 2025-12-12
 *
 * Usage:
 *   curl -X POST https://yourapp.com/api/v1/predict \
 *     -H "X-API-Key: wak_xxx" \
 *     -H "Content-Type: application/json" \
 *     -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateRequestWithScope } from '@/lib/auth/api-key-validator';
import { unifiedLLMClient } from '@/lib/llm/unified-client';
import { modelManager } from '@/lib/models/model-manager.service';
import { logApiKeyUsage, extractClientInfo } from '@/lib/auth/api-key-usage-logger';
import { recordUsageEvent } from '@/lib/usage/checker';

export const runtime = 'nodejs';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PredictRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export async function POST(request: NextRequest) {
  console.log('[PredictAPI] POST /api/v1/predict');
  const requestStartTime = Date.now();
  const { clientIp, userAgent } = extractClientInfo(request.headers);

  try {
    // Validate API key with 'production' scope
    const validation = await validateRequestWithScope(request.headers, 'production');

    if (!validation.isValid) {
      console.warn('[PredictAPI] Auth failed:', validation.errorMessage);

      // Return appropriate error code
      const status = validation.scopeError ? 403 : 401;
      return NextResponse.json(
        {
          error: {
            message: validation.errorMessage,
            type: validation.scopeError ? 'insufficient_scope' : 'invalid_api_key',
            code: status,
          }
        },
        { status }
      );
    }

    console.log('[PredictAPI] Authenticated user:', validation.userId);

    // Parse request body
    const body: PredictRequest = await request.json();

    // Validate required fields
    if (!body.model) {
      return NextResponse.json(
        {
          error: {
            message: 'model is required',
            type: 'invalid_request_error',
            code: 400,
          }
        },
        { status: 400 }
      );
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        {
          error: {
            message: 'messages array is required and must not be empty',
            type: 'invalid_request_error',
            code: 400,
          }
        },
        { status: 400 }
      );
    }

    // Get model configuration
    const modelConfig = await modelManager.getModelConfig(body.model, validation.userId!);

    if (!modelConfig) {
      return NextResponse.json(
        {
          error: {
            message: `Model '${body.model}' not found or not accessible`,
            type: 'invalid_request_error',
            code: 404,
          }
        },
        { status: 404 }
      );
    }

    console.log('[PredictAPI] Using model:', modelConfig.id, 'provider:', modelConfig.provider);

    // Check if streaming is requested
    if (body.stream) {
      // For streaming, return SSE response
      const encoder = new TextEncoder();
      const completionId = `chatcmpl-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Use unified client for streaming - yields plain text chunks
            const streamGenerator = unifiedLLMClient.stream(
              body.model,
              body.messages.map(m => ({
                role: m.role,
                content: m.content,
              })),
              {
                temperature: body.temperature ?? 0.7,
                maxTokens: body.max_tokens ?? 1024,
                userId: validation.userId,
              }
            );

            for await (const textChunk of streamGenerator) {
              const data = JSON.stringify({
                id: completionId,
                object: 'chat.completion.chunk',
                created,
                model: body.model,
                choices: [{
                  index: 0,
                  delta: { content: textChunk },
                  finish_reason: null,
                }],
              });

              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            // Send final chunk with finish_reason
            const finalData = JSON.stringify({
              id: completionId,
              object: 'chat.completion.chunk',
              created,
              model: body.model,
              choices: [{
                index: 0,
                delta: {},
                finish_reason: 'stop',
              }],
            });
            controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();

            // Record inference call usage (fire-and-forget, streaming)
            if (validation.userId) {
              recordUsageEvent({
                userId: validation.userId,
                metricType: 'inference_call',
                value: 1,
                resourceType: 'inference',
                resourceId: completionId,
                metadata: {
                  model_id: body.model,
                  provider: modelConfig.provider,
                  is_streaming: true,
                  api_key_id: validation.keyId || null,
                }
              }).catch(err => {
                console.error('[PredictAPI] Failed to record usage (streaming):', err);
              });
            }
          } catch (err) {
            console.error('[PredictAPI] Stream error:', err);
            controller.error(err);
          }
        },
      });

      // Log streaming request (fire-and-forget) - tokens not available for streaming
      if (validation.keyId && validation.userId) {
        logApiKeyUsage({
          apiKeyId: validation.keyId,
          userId: validation.userId,
          endpoint: '/api/v1/predict',
          method: 'POST',
          scopeUsed: 'production',
          statusCode: 200,
          latencyMs: Date.now() - requestStartTime,
          modelId: body.model,
          modelProvider: modelConfig.provider,
          clientIp: clientIp || undefined,
          userAgent: userAgent || undefined,
          metadata: { streaming: true },
        }).catch(err => console.warn('[PredictAPI] Usage log failed:', err));
      }

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming response
    const startTime = Date.now();

    const response = await unifiedLLMClient.chat(
      body.model,
      body.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      {
        temperature: body.temperature ?? 0.7,
        maxTokens: body.max_tokens ?? 1024,
        userId: validation.userId,
      }
    );

    const latencyMs = Date.now() - startTime;

    console.log('[PredictAPI] Completion successful, latency:', latencyMs, 'ms');

    // Record inference call usage (fire-and-forget)
    if (validation.userId) {
      recordUsageEvent({
        userId: validation.userId,
        metricType: 'inference_call',
        value: 1,
        resourceType: 'inference',
        resourceId: `chatcmpl-${Date.now()}`,
        metadata: {
          model_id: body.model,
          provider: modelConfig.provider,
          is_streaming: false,
          api_key_id: validation.keyId || null,
          input_tokens: response.usage?.input_tokens || 0,
          output_tokens: response.usage?.output_tokens || 0,
          latency_ms: latencyMs,
        }
      }).catch(err => {
        console.error('[PredictAPI] Failed to record usage:', err);
      });
    }

    // Log successful request (fire-and-forget)
    if (validation.keyId && validation.userId) {
      logApiKeyUsage({
        apiKeyId: validation.keyId,
        userId: validation.userId,
        endpoint: '/api/v1/predict',
        method: 'POST',
        scopeUsed: 'production',
        statusCode: 200,
        latencyMs,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        modelId: body.model,
        modelProvider: modelConfig.provider,
        clientIp: clientIp || undefined,
        userAgent: userAgent || undefined,
      }).catch(err => console.warn('[PredictAPI] Usage log failed:', err));
    }

    // Return OpenAI-compatible response format
    return NextResponse.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response.content,
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: response.usage?.input_tokens || 0,
        completion_tokens: response.usage?.output_tokens || 0,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      },
      // Custom fields
      _meta: {
        latency_ms: latencyMs,
        provider: modelConfig.provider,
      },
    });

  } catch (error) {
    console.error('[PredictAPI] Error:', error);

    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          type: 'api_error',
          code: 500,
        }
      },
      { status: 500 }
    );
  }
}

// GET endpoint for health check / API info
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/v1/predict',
    version: '1.0.0',
    methods: ['POST'],
    auth: {
      required: true,
      type: 'API Key',
      header: 'X-API-Key or Authorization: Bearer',
      scope: 'production',
    },
    request_format: {
      model: 'string (required)',
      messages: 'array of {role, content} (required)',
      temperature: 'number (optional, default 0.7)',
      max_tokens: 'number (optional, default 1024)',
      stream: 'boolean (optional, default false)',
    },
  });
}
