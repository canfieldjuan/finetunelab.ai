/**
 * Ollama API Client
 * Supports both local and cloud Ollama endpoints
 */

export class OllamaClient {
  constructor(model, config = {}) {
    this.model = model;
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.apiKey = config.apiKey || null;
    this.timeout = config.timeout || 300000;
    this.provider = config.provider || 'local';
  }

  async generate(prompt, options = {}) {
    const headers = { 'Content-Type': 'application/json' };

    // Add API key for cloud requests
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature || 0.1, // Low temp for deterministic fixes
            num_predict: options.maxTokens || 2000,
          }
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${this.provider}): ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms (${this.provider})`);
      }
      throw error;
    }
  }

  async chat(messages, options = {}) {
    const headers = { 'Content-Type': 'application/json' };

    // Add API key for cloud requests
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature: options.temperature || 0.1,
            num_predict: options.maxTokens || 2000,
          }
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${this.provider}): ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.message.content;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms (${this.provider})`);
      }
      throw error;
    }
  }
}

/**
 * Create OllamaClient from config
 */
export function createClientFromConfig(modelConfig, ollamaConfig) {
  const provider = modelConfig.provider || 'local';
  const providerConfig = ollamaConfig[provider];

  return new OllamaClient(modelConfig.model, {
    baseUrl: providerConfig.base_url,
    apiKey: providerConfig.api_key,
    timeout: providerConfig.timeout_ms,
    provider: provider
  });
}
