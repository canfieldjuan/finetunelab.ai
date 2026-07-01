import { describe, expect, it } from 'vitest';
import { OllamaAdapter } from '../ollama-adapter';
import type { ModelConfig } from '@/lib/models/llm-model.types';

const config: ModelConfig = {
  id: 'model-ollama',
  name: 'Local Llama',
  provider: 'ollama',
  base_url: 'http://localhost:11434/v1',
  model_id: '/models/llama3.2',
  served_model_name: 'llama3.2',
  auth_type: 'none',
  auth_headers: {},
  supports_streaming: true,
  supports_functions: false,
  supports_vision: false,
  context_length: 4096,
  max_output_tokens: 2000,
  default_temperature: 0.7,
  default_top_p: 1,
};

describe('OllamaAdapter', () => {
  it('maps multimodal data-url image parts to Ollama images', () => {
    const adapter = new OllamaAdapter();

    const request = adapter.formatRequest({
      config: { ...config, supports_vision: true },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image.' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,aW1hZ2U=', detail: 'auto' } },
        ],
      }],
      options: { stream: false },
    });

    expect(request.body).toEqual(expect.objectContaining({
      messages: [{
        role: 'user',
        content: 'Describe this image.',
        images: ['aW1hZ2U='],
      }],
    }));
  });

  it('uses served_model_name and native Ollama chat endpoint', () => {
    const adapter = new OllamaAdapter();

    const request = adapter.formatRequest({
      config,
      messages: [{ role: 'user', content: 'hello' }],
      options: { stream: false },
    });

    expect(request.url).toBe('http://localhost:11434/api/chat');
    expect(request.body).toEqual(expect.objectContaining({
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'hello' }],
      stream: false,
    }));
  });
});
