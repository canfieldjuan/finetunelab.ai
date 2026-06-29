import { describe, expect, it } from 'vitest';
import type { ModelConfig } from '@/lib/models/llm-model.types';
import { AnthropicAdapter } from '../anthropic-adapter';
import { HuggingFaceAdapter } from '../huggingface-adapter';
import { OllamaAdapter } from '../ollama-adapter';
import { OpenAIAdapter } from '../openai-adapter';
import { RunPodAdapter } from '../runpod-adapter';

const baseConfig: ModelConfig = {
  id: 'model-1',
  name: 'Test Model',
  provider: 'openai',
  base_url: 'https://example.test',
  model_id: 'test-model',
  served_model_name: null,
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

const messages = [{ role: 'user' as const, content: 'hello' }];
const generationOptions = {
  stream: false,
  topP: 0.42,
  frequencyPenalty: 1.25,
  presencePenalty: -1.5,
};

function config(overrides: Partial<ModelConfig>): ModelConfig {
  return { ...baseConfig, ...overrides };
}

describe('provider generation option mapping', () => {
  it('maps top_p and penalties for OpenAI-compatible requests', () => {
    const request = new OpenAIAdapter().formatRequest({
      config: config({
        provider: 'vllm',
        base_url: 'http://localhost:8000/v1',
        model_id: '/models/qwen',
        served_model_name: 'qwen',
      }),
      messages,
      options: generationOptions,
    });

    expect(request.body).toEqual(expect.objectContaining({
      top_p: 0.42,
      frequency_penalty: 1.25,
      presence_penalty: -1.5,
    }));
  });

  it('maps top_p and penalties into RunPod sampling params', () => {
    const request = new RunPodAdapter().formatRequest({
      config: config({
        provider: 'runpod',
        base_url: 'https://api.runpod.ai/v2/endpoint/runsync',
        model_id: 'qwen-instruct',
        is_chat_model: true,
      }),
      messages,
      options: generationOptions,
    });

    expect(request.body).toEqual({
      input: {
        messages,
        sampling_params: {
          temperature: 0.7,
          max_tokens: 2000,
          top_p: 0.42,
          frequency_penalty: 1.25,
          presence_penalty: -1.5,
        },
      },
    });
  });

  it('passes top_p but omits unsupported penalties for Anthropic', () => {
    const request = new AnthropicAdapter().formatRequest({
      config: config({
        provider: 'anthropic',
        base_url: 'https://api.anthropic.com/v1',
        model_id: 'claude-3-5-sonnet',
      }),
      messages,
      options: generationOptions,
    });

    expect(request.body).toEqual(expect.objectContaining({
      top_p: 0.42,
    }));
    expect(request.body).not.toHaveProperty('frequency_penalty');
    expect(request.body).not.toHaveProperty('presence_penalty');
  });

  it('maps top_p for native Ollama requests', () => {
    const request = new OllamaAdapter().formatRequest({
      config: config({
        provider: 'ollama',
        base_url: 'http://localhost:11434/v1',
        model_id: '/models/llama',
        served_model_name: 'llama3.2',
      }),
      messages,
      options: generationOptions,
    });

    expect(request.body).toEqual(expect.objectContaining({
      options: expect.objectContaining({
        top_p: 0.42,
      }),
    }));
  });

  it('maps top_p for HuggingFace router requests', () => {
    const request = new HuggingFaceAdapter().formatRequest({
      config: config({
        provider: 'huggingface',
        base_url: 'https://router.huggingface.co/v1',
        model_id: 'Qwen/Qwen2.5-7B-Instruct',
        is_chat_model: true,
      }),
      messages,
      options: generationOptions,
    });

    expect(request.body).toEqual(expect.objectContaining({
      top_p: 0.42,
    }));
  });
});
