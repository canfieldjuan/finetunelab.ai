import { afterEach, describe, expect, it, vi } from 'vitest';
import { HuggingFaceAdapter } from '../huggingface-adapter';
import type { AdapterRequest } from '../base-adapter';
import type { ModelConfig } from '@/lib/models/llm-model.types';

const config: ModelConfig = {
  id: 'model-hf-vision',
  name: 'HuggingFace Vision',
  provider: 'huggingface',
  base_url: 'https://router.huggingface.co/v1',
  model_id: 'Qwen/Qwen2.5-VL-7B-Instruct',
  served_model_name: null,
  auth_type: 'api_key',
  api_key: 'test-key',
  auth_headers: {},
  supports_streaming: false,
  supports_functions: false,
  supports_vision: true,
  context_length: 32768,
  max_output_tokens: 2000,
  default_temperature: 0.7,
  default_top_p: 1,
  is_chat_model: true,
};

describe('HuggingFaceAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts image data URLs in request body logs without changing the provider payload', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const adapter = new HuggingFaceAdapter();
    const imageUrl = 'data:image/png;base64,aW1hZ2U=';
    const request: AdapterRequest = {
      config,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image.' },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'auto' } },
          ],
        },
      ],
      options: { stream: false },
    };

    const { body } = adapter.formatRequest(request);

    expect(JSON.stringify(body)).toContain(imageUrl);
    const requestBodyLog = logSpy.mock.calls.find(
      ([label]) => label === '[HuggingFaceAdapter] Request body:',
    );
    expect(requestBodyLog).toBeDefined();
    expect(requestBodyLog?.[1]).toContain('data:image/png;base64,[REDACTED]');
    expect(requestBodyLog?.[1]).not.toContain('aW1hZ2U=');
  });
});
