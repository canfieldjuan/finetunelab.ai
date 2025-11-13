// Base Provider Adapter Interface
// Defines the contract all provider adapters must implement
// Date: 2025-10-14

import type { ChatMessage, ToolDefinition } from '../openai';
import type { ModelConfig } from '@/lib/models/llm-model.types';

// ============================================================================
// Request/Response Interfaces
// ============================================================================

export interface AdapterRequest {
  messages: ChatMessage[];
  config: ModelConfig;
  options: {
    temperature?: number;
    maxTokens?: number;
    tools?: ToolDefinition[];
    stream?: boolean;
  };
}

export interface AdapterResponse {
  content: string;
  reasoning?: string; // Extended thinking/intermediate steps (e.g., from Claude models)
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

// ============================================================================
// Base Provider Adapter Interface
// Each provider (OpenAI, Anthropic, Ollama, etc.) implements this interface
// ============================================================================

export interface ProviderAdapter {
  /**
   * Provider name for logging and debugging
   */
  readonly name: string;

  /**
   * Format chat messages and options into provider-specific request body
   */
  formatRequest(request: AdapterRequest): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  };

  /**
   * Parse provider-specific response into standardized LLMResponse
   */
  parseResponse(response: Response, responseBody: unknown): Promise<AdapterResponse>;

  /**
   * Parse streaming chunk into text content
   * Returns null if chunk doesn't contain text
   */
  parseStreamChunk(chunk: string): string | null;

  /**
   * Build authorization headers for this provider
   */
  buildAuthHeaders(config: ModelConfig): Record<string, string>;
}

// ============================================================================
// Base Adapter Implementation with Common Logic
// ============================================================================

export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract readonly name: string;

  /**
   * Common method to build full URL from base_url and endpoint
   */
  protected buildUrl(baseUrl: string, endpoint: string): string {
    // Remove trailing slash from base URL
    const cleanBase = baseUrl.replace(/\/$/, '');
    // Remove leading slash from endpoint
    const cleanEndpoint = endpoint.replace(/^\//, '');
    return `${cleanBase}/${cleanEndpoint}`;
  }

  /**
   * Common method to handle response errors
   */
  protected async handleResponseError(response: Response): Promise<never> {
    let errorBody: unknown = {};
    let errorMessage = '';
    try {
      errorBody = await response.json();
      const msg = (errorBody as { error?: { message?: string } | string }).error;
      errorMessage = typeof msg === 'string' ? msg : msg?.message || response.statusText;
    } catch {
      try {
        const text = await response.text();
        errorBody = { raw: text } as unknown;
        errorMessage = text || response.statusText;
      } catch {
        errorBody = {};
        errorMessage = response.statusText;
      }
    }

    console.error(`[${this.name}Adapter] API error:`, {
      status: response.status,
      statusText: response.statusText,
      error: errorMessage,
      fullErrorBody: errorBody,
    });

    throw new Error(`${this.name} API error (${response.status}): ${errorMessage}`);
  }

  /**
   * Subclasses must implement these methods
   */
  abstract formatRequest(request: AdapterRequest): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  };

  abstract parseResponse(response: Response, responseBody: unknown): Promise<AdapterResponse>;

  abstract parseStreamChunk(chunk: string): string | null;

  abstract buildAuthHeaders(config: ModelConfig): Record<string, string>;
}

console.log('[BaseAdapter] Base adapter interface loaded');
