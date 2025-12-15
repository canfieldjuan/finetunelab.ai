/**
 * OpenAI-Compatible Model Caller
 * Calls any OpenAI-compatible API endpoint (Together, Fireworks, OpenRouter, vLLM, etc.)
 *
 * Used by Demo V2 to call user-provided model endpoints.
 */

export interface DemoModelEndpoint {
  url: string;
  apiKey: string;
  modelId: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CallModelOptions {
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface CallModelResult {
  success: boolean;
  response?: string;
  latency_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  error?: string;
  error_type?: 'timeout' | 'auth' | 'model_not_found' | 'rate_limit' | 'network' | 'api_error' | 'unknown';
}

const DEFAULT_TIMEOUT = 60000; // 60 seconds
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Call an OpenAI-compatible model endpoint
 */
export async function callDemoModel(
  endpoint: DemoModelEndpoint,
  messages: ChatMessage[],
  options: CallModelOptions = {}
): Promise<CallModelResult> {
  const {
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
    timeout = DEFAULT_TIMEOUT,
  } = options;

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${endpoint.apiKey}`,
      },
      body: JSON.stringify({
        model: endpoint.modelId,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latency_ms = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `HTTP ${response.status}`;

      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        if (errorBody.length < 200) {
          errorMessage = errorBody || errorMessage;
        }
      }

      // Categorize error
      let error_type: CallModelResult['error_type'] = 'api_error';
      if (response.status === 401 || response.status === 403) {
        error_type = 'auth';
        errorMessage = 'Authentication failed. Check your API key.';
      } else if (response.status === 404) {
        error_type = 'model_not_found';
        errorMessage = `Model "${endpoint.modelId}" not found.`;
      } else if (response.status === 429) {
        error_type = 'rate_limit';
        errorMessage = 'Rate limited. Please slow down requests.';
      }

      return {
        success: false,
        latency_ms,
        error: errorMessage,
        error_type,
      };
    }

    const data = await response.json();

    // Extract response content
    const responseContent = data.choices?.[0]?.message?.content || '';

    // Extract token usage if available
    const input_tokens = data.usage?.prompt_tokens;
    const output_tokens = data.usage?.completion_tokens;

    return {
      success: true,
      response: responseContent,
      latency_ms,
      input_tokens,
      output_tokens,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const latency_ms = Date.now() - startTime;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          latency_ms,
          error: `Request timed out after ${timeout / 1000} seconds`,
          error_type: 'timeout',
        };
      }

      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        return {
          success: false,
          latency_ms,
          error: 'Could not connect to the endpoint',
          error_type: 'network',
        };
      }

      return {
        success: false,
        latency_ms,
        error: error.message,
        error_type: 'unknown',
      };
    }

    return {
      success: false,
      latency_ms,
      error: 'Unknown error occurred',
      error_type: 'unknown',
    };
  }
}

/**
 * Call model with a single prompt string
 * Convenience wrapper for simple use cases
 */
export async function callDemoModelSimple(
  endpoint: DemoModelEndpoint,
  prompt: string,
  options: CallModelOptions = {}
): Promise<CallModelResult> {
  return callDemoModel(
    endpoint,
    [{ role: 'user', content: prompt }],
    options
  );
}

/**
 * Batch call model with multiple prompts
 * Processes sequentially with optional delay between calls
 */
export async function callDemoModelBatch(
  endpoint: DemoModelEndpoint,
  prompts: string[],
  options: CallModelOptions & { delayMs?: number; onProgress?: (completed: number, total: number, result: CallModelResult) => void } = {}
): Promise<CallModelResult[]> {
  const { delayMs = 0, onProgress, ...callOptions } = options;
  const results: CallModelResult[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const result = await callDemoModelSimple(endpoint, prompts[i], callOptions);
    results.push(result);

    if (onProgress) {
      onProgress(i + 1, prompts.length, result);
    }

    // Add delay between calls if specified (rate limiting)
    if (delayMs > 0 && i < prompts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
