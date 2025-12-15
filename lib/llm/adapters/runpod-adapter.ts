// RunPod Serverless Adapter
// Transforms between our standard format and RunPod worker-vllm format
// Date: 2025-12-03

import type { ChatMessage } from '../openai';
import { BaseProviderAdapter, type AdapterRequest, type AdapterResponse } from './base-adapter';
import type { ModelConfig } from '@/lib/models/llm-model.types';

/**
 * RunPod Serverless Adapter
 *
 * RunPod worker-vllm uses a different format than OpenAI:
 *
 * Request: {
 *   input: {
 *     messages: [...],  // Same as OpenAI
 *     sampling_params: {
 *       temperature: 0.7,
 *       max_tokens: 100,
 *       ...
 *     }
 *   }
 * }
 *
 * Response: {
 *   output: {
 *     choices: [{
 *       message: { role: "assistant", content: "..." },
 *       ...
 *     }],
 *     usage: { ... }
 *   }
 * }
 *
 * @see https://docs.runpod.io/serverless/vllm/vllm-requests
 * @see https://github.com/runpod-workers/worker-vllm
 */
export class RunPodAdapter extends BaseProviderAdapter {
  readonly name = 'RunPod';

  /**
   * Format request for RunPod worker-vllm
   * Uses /run endpoint (async) instead of /runsync to avoid 90-second timeout
   */
  formatRequest(request: AdapterRequest): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  } {
    const { messages, config, options } = request;

    // Convert runsync URL to run URL for async requests
    // runsync has a 90-second timeout which is too short for cold starts + generation
    let url = config.base_url.replace(/\/$/, '');
    if (url.endsWith('/runsync')) {
      url = url.replace('/runsync', '/run');
    }

    const headers = this.buildAuthHeaders(config);

    // Build sampling_params (RunPod's equivalent of OpenAI's top-level params)
    const sampling_params: Record<string, unknown> = {
      temperature: options.temperature ?? config.default_temperature ?? 0.7,
      max_tokens: options.maxTokens ?? config.max_output_tokens ?? 2000,
    };

    // Detect if model supports chat format or needs completion format
    const useChatFormat = this.isChatModel(config.model_id, config.is_chat_model);

    // Build request body in RunPod format
    // For chat models: use messages array
    // For base/completion models: use prompt string
    let body: Record<string, unknown>;
    if (useChatFormat) {
      body = {
        input: {
          messages: this.formatMessages(messages),
          sampling_params,
        },
      };
    } else {
      // Base model - convert messages to single prompt string
      const prompt = this.messagesToPrompt(messages);
      body = {
        input: {
          prompt,
          sampling_params,
        },
      };
    }

    console.log('[RunPodAdapter] Request:', {
      url,
      messageCount: messages.length,
      useChatFormat,
      temperature: sampling_params.temperature,
      max_tokens: sampling_params.max_tokens,
    });

    // Store config for polling (needed to get status endpoint URL and auth)
    this.lastConfig = {
      base_url: config.base_url,
      api_key: config.api_key,
    };

    return { url, headers, body };
  }

  /**
   * Poll RunPod status endpoint until job completes
   * Max wait: 5 minutes (300 seconds)
   */
  private async pollForCompletion(
    jobId: string,
    config: { base_url: string; api_key?: string }
  ): Promise<Record<string, unknown>> {
    // Build status URL from base URL
    // base_url: https://api.runpod.ai/v2/{endpoint_id}/runsync
    // status:   https://api.runpod.ai/v2/{endpoint_id}/status/{job_id}
    const baseUrl = config.base_url.replace(/\/(run|runsync)$/, '');
    const statusUrl = `${baseUrl}/status/${jobId}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.api_key) {
      headers['Authorization'] = `Bearer ${config.api_key}`;
    }

    const maxWaitMs = 300000; // 5 minutes
    const pollIntervalMs = 2000; // Poll every 2 seconds
    const startTime = Date.now();

    console.log('[RunPodAdapter] Polling status URL:', statusUrl);

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await fetch(statusUrl, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          console.error('[RunPodAdapter] Status check failed:', response.status);
          throw new Error(`Status check failed: ${response.status}`);
        }

        const data = await response.json() as Record<string, unknown>;
        const status = data.status as string;

        console.log('[RunPodAdapter] Poll status:', status, 'elapsed:', Math.round((Date.now() - startTime) / 1000), 's');

        if (status === 'COMPLETED') {
          return data;
        }

        if (status === 'FAILED' || status === 'CANCELLED') {
          return data; // Let the caller handle the error
        }

        // Still IN_QUEUE or IN_PROGRESS, wait and retry
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      } catch (error) {
        console.error('[RunPodAdapter] Polling error:', error);
        throw error;
      }
    }

    throw new Error('RunPod request timed out after 5 minutes');
  }

  /**
   * Format messages for RunPod (same as OpenAI format)
   */
  private formatMessages(messages: ChatMessage[]): Array<{
    role: string;
    content: string | null;
  }> {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  // Store config for polling
  private lastConfig: { base_url: string; api_key?: string } | null = null;

  /**
   * Parse RunPod response into standardized format
   *
   * For /run endpoint (async), this handles polling until job completes
   * RunPod wraps the vLLM response in { output: {...} }
   */
  async parseResponse(response: Response, responseBody: unknown): Promise<AdapterResponse> {
    if (!response.ok) {
      await this.handleResponseError(response);
    }

    let rb = (responseBody as Record<string, unknown>) || {};

    // Check for RunPod status responses (IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED, etc.)
    let status = rb.status as string | undefined;
    const jobId = rb.id as string | undefined;

    console.log('[RunPodAdapter] Initial response status:', status, 'jobId:', jobId);

    // If job is queued or in progress, poll until complete
    // This happens when using /run endpoint (async)
    if ((status === 'IN_QUEUE' || status === 'IN_PROGRESS') && jobId && this.lastConfig) {
      console.log('[RunPodAdapter] Job pending, starting polling...');
      rb = await this.pollForCompletion(jobId, this.lastConfig);
      status = rb.status as string | undefined;
      console.log('[RunPodAdapter] Polling complete, final status:', status);
    }

    // Handle failed status
    if (status === 'FAILED') {
      const error = rb.error as string | undefined;
      console.error('[RunPodAdapter] Request failed:', { status, jobId, error });
      throw new Error(`RunPod request failed: ${error || 'Unknown error'}`);
    }

    if (status === 'CANCELLED') {
      throw new Error('RunPod request was cancelled');
    }

    // COMPLETED status or no status (legacy format) - proceed with parsing

    // RunPod wraps response in "output" field
    // Format can be:
    // 1. Array: { output: [{ choices: [{ tokens: [...] }], usage: {...} }] }
    // 2. Object: { output: { choices: [{ message: {...} }], usage: {...} } }
    const rawOutput = rb.output;

    console.log('[RunPodAdapter] Raw output type:', Array.isArray(rawOutput) ? 'array' : typeof rawOutput);

    // Handle array format (worker-vllm returns array)
    let output: Record<string, unknown>;
    if (Array.isArray(rawOutput) && rawOutput.length > 0) {
      output = rawOutput[0] as Record<string, unknown>;
    } else if (rawOutput && typeof rawOutput === 'object') {
      output = rawOutput as Record<string, unknown>;
    } else {
      output = rb;
    }

    // Now extract data from output
    const choices = Array.isArray(output.choices) ? (output.choices as unknown[]) : [];
    const choice = choices[0] as Record<string, unknown> | undefined;

    if (!choice) {
      console.error('[RunPodAdapter] No choices in response:', {
        hasOutput: !!rb.output,
        outputIsArray: Array.isArray(rawOutput),
        outputKeys: output ? Object.keys(output) : [],
        status: rb.status,
        fullResponse: JSON.stringify(rb).slice(0, 500),
      });
      throw new Error('No choices in RunPod response');
    }

    // Extract content - handle both "tokens" (array) and "message" (object) formats
    let content = '';

    // Format 1: tokens array (worker-vllm format)
    if (Array.isArray(choice.tokens)) {
      content = (choice.tokens as string[]).join('');
    }
    // Format 2: message object (OpenAI-compatible format)
    else if (choice.message && typeof choice.message === 'object') {
      const message = choice.message as Record<string, unknown>;
      content = typeof message.content === 'string' ? message.content : '';
    }
    // Format 3: text field
    else if (typeof choice.text === 'string') {
      content = choice.text;
    }

    // Extract usage metrics safely - handle both formats
    let usage;
    const usageData = output.usage as Record<string, unknown> | undefined;
    if (usageData && typeof usageData === 'object') {
      // Format 1: { input: N, output: N }
      // Format 2: { prompt_tokens: N, completion_tokens: N }
      const inputTokens = typeof usageData.input === 'number'
        ? usageData.input
        : typeof usageData.prompt_tokens === 'number'
          ? usageData.prompt_tokens
          : 0;
      const outputTokens = typeof usageData.output === 'number'
        ? usageData.output
        : typeof usageData.completion_tokens === 'number'
          ? usageData.completion_tokens
          : 0;
      usage = { input_tokens: inputTokens, output_tokens: outputTokens };
    }

    console.log('[RunPodAdapter] Parsed response:', {
      contentLength: content.length,
      hasUsage: !!usage,
      contentPreview: content.slice(0, 100),
    });

    return {
      content,
      usage,
    };
  }

  /**
   * Parse streaming chunk from RunPod
   * RunPod uses same SSE format as OpenAI for streaming
   */
  parseStreamChunk(chunk: string): string | null {
    if (!chunk.trim() || chunk.trim() === '[DONE]') {
      return null;
    }

    try {
      const parsed = JSON.parse(chunk);

      // RunPod may wrap in output field even for streams
      const data = parsed.output || parsed;

      const choices = Array.isArray(data.choices) ? data.choices : [];
      const delta = (choices[0] as Record<string, unknown> | undefined)?.delta as
        | Record<string, unknown>
        | undefined;
      const content = delta?.content;

      return typeof content === 'string' ? content : null;
    } catch {
      return null;
    }
  }

  /**
   * Build authorization headers for RunPod
   * Uses Bearer token authentication
   */
  buildAuthHeaders(config: ModelConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.api_key) {
      headers['Authorization'] = `Bearer ${config.api_key}`;
    }

    return headers;
  }
}

console.log('[RunPodAdapter] RunPod adapter loaded');
