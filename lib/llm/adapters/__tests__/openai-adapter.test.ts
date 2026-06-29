import { describe, expect, it } from 'vitest';
import { OpenAIAdapter } from '../openai-adapter';
import type { AdapterRequest } from '../base-adapter';
import type { ModelConfig } from '@/lib/models/llm-model.types';

const config: ModelConfig = {
  id: 'model-vllm-qwen',
  name: 'Local Qwen',
  provider: 'vllm',
  base_url: 'http://localhost:8000/v1',
  model_id: 'qwen3',
  served_model_name: 'qwen3',
  auth_type: 'none',
  auth_headers: {},
  supports_streaming: true,
  supports_functions: true,
  supports_vision: false,
  context_length: 32768,
  max_output_tokens: 2000,
  default_temperature: 0.7,
  default_top_p: 1,
  metadata: {
    vllm_runtime: {
      parse_qwen_xml_tool_calls: true,
    },
  },
};

describe('OpenAIAdapter', () => {
  it('recovers Qwen XML tool calls without leaking XML into content', async () => {
    const adapter = new OpenAIAdapter();
    const request: AdapterRequest = {
      config,
      messages: [{ role: 'user', content: 'search docs' }],
      options: { stream: false },
    };

    const response = await adapter.parseResponse(
      new Response(null, {
        headers: { 'x-request-id': 'req_123' },
      }),
      {
        choices: [
          {
            message: {
              content: `I'll check that.
<tool_call>
{"name":"search_docs","arguments":{"query":"deflection audit"}}
</tool_call>`,
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 12,
        },
      },
      request
    );

    expect(response.content).toBe("I'll check that.");
    expect(response.toolCalls).toEqual([
      {
        id: 'qwen-xml-tool-0',
        name: 'search_docs',
        arguments: { query: 'deflection audit' },
      },
    ]);
    expect(response.content).not.toContain('<tool_call>');
  });
});
