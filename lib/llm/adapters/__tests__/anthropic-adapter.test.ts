import { describe, expect, it } from 'vitest';
import { AnthropicAdapter } from '../anthropic-adapter';
import type { AdapterRequest } from '../base-adapter';
import type { ModelConfig } from '@/lib/models/llm-model.types';

const config: ModelConfig = {
  id: 'model-anthropic-vision',
  name: 'Claude Vision',
  provider: 'anthropic',
  base_url: 'https://api.anthropic.com/v1',
  model_id: 'claude-3-5-sonnet',
  served_model_name: null,
  auth_type: 'api_key',
  api_key: 'test-key',
  auth_headers: {},
  supports_streaming: true,
  supports_functions: true,
  supports_vision: true,
  context_length: 200000,
  max_output_tokens: 2000,
  default_temperature: 0.7,
  default_top_p: 1,
};

describe('AnthropicAdapter', () => {
  it('maps multimodal data-url image parts to Anthropic base64 source blocks', () => {
    const adapter = new AnthropicAdapter();
    const imageUrl = 'data:image/png;base64,aW1hZ2U=';
    const request: AdapterRequest = {
      config,
      messages: [
        { role: 'system', content: 'Be concise.' },
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

    expect(body.system).toEqual([
      {
        type: 'text',
        text: 'Be concise.',
        cache_control: { type: 'ephemeral' },
      },
    ]);
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image.' },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: 'aW1hZ2U=',
            },
          },
        ],
      },
    ]);
  });
});
