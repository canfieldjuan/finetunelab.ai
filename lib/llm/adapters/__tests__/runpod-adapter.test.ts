import { describe, expect, it } from 'vitest';
import { RunPodAdapter } from '../runpod-adapter';
import type { AdapterRequest } from '../base-adapter';
import type { ModelConfig } from '@/lib/models/llm-model.types';

const config: ModelConfig = {
  id: 'model-runpod-vision',
  name: 'RunPod Vision',
  provider: 'runpod',
  base_url: 'https://api.runpod.ai/v2/endpoint/runsync',
  model_id: 'qwen-vl',
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

describe('RunPodAdapter', () => {
  it('preserves multimodal content parts in serverless chat messages', () => {
    const adapter = new RunPodAdapter();
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

    const { url, body } = adapter.formatRequest(request);

    expect(url).toBe('https://api.runpod.ai/v2/endpoint/run');
    expect(body).toEqual({
      input: {
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image.' },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'auto' } },
            ],
          },
        ],
        sampling_params: {
          temperature: 0.7,
          max_tokens: 2000,
          top_p: 1,
        },
      },
    });
  });
});
