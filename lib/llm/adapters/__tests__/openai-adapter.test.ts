import { afterEach, describe, expect, it, vi } from 'vitest';
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

const searchDocsTool = {
  type: 'function' as const,
  function: {
    name: 'search_docs',
    description: 'Search documents',
    parameters: { type: 'object', properties: { query: { type: 'string' } } },
  },
};

const lookupCaseTool = {
  type: 'function' as const,
  function: {
    name: 'lookup_case',
    description: 'Lookup a case',
    parameters: { type: 'object', properties: { id: { type: 'string' } } },
  },
};

describe('OpenAIAdapter', () => {
  it('recovers Qwen XML tool calls without leaking XML into content', async () => {
    const adapter = new OpenAIAdapter();
    const request: AdapterRequest = {
      config,
      messages: [{ role: 'user', content: 'search docs' }],
      options: {
        stream: false,
        tools: [searchDocsTool],
      },
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

  it('recovers terminal Qwen XML tool calls that omit the closing tag', async () => {
    const adapter = new OpenAIAdapter();
    const request: AdapterRequest = {
      config,
      messages: [{ role: 'user', content: 'summarize email' }],
      options: {
        stream: false,
        tools: [
          {
            type: 'function',
            function: {
              name: 'email_analysis',
              description: 'Analyze email',
              parameters: { type: 'object', properties: { action: { type: 'string' } } },
            },
          },
        ],
      },
    };

    const response = await adapter.parseResponse(
      new Response(null),
      {
        choices: [
          {
            message: {
              content: `<tool_call>
{"name":"email_analysis","arguments":{"action":"summarize_thread","emailThread":"{}"}}`,
            },
          },
        ],
      },
      request
    );

    expect(response.content).toBe('');
    expect(response.toolCalls).toEqual([
      {
        id: 'qwen-xml-tool-0',
        name: 'email_analysis',
        arguments: { action: 'summarize_thread', emailThread: '{}' },
      },
    ]);
  });

  it('leaves XML content untouched when the Qwen XML parser is disabled', async () => {
    const adapter = new OpenAIAdapter();
    const request: AdapterRequest = {
      config: {
        ...config,
        metadata: {
          vllm_runtime: {
            parse_qwen_xml_tool_calls: false,
          },
        },
      },
      messages: [{ role: 'user', content: 'search docs' }],
      options: { stream: false, tools: [searchDocsTool] },
    };
    const content = `<tool_call>
{"name":"search_docs","arguments":{"query":"deflection audit"}}
</tool_call>`;

    const response = await adapter.parseResponse(
      new Response(null),
      { choices: [{ message: { content } }] },
      request
    );

    expect(response.content).toBe(content);
    expect(response.toolCalls).toBeUndefined();
  });

  it('warns without throwing or stripping content when XML tool JSON is malformed', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new OpenAIAdapter();
    const request: AdapterRequest = {
      config,
      messages: [{ role: 'user', content: 'search docs' }],
      options: { stream: false, tools: [searchDocsTool] },
    };
    const content = `<tool_call>
{"name":"search_docs","arguments":
</tool_call>`;

    const response = await adapter.parseResponse(
      new Response(null),
      { choices: [{ message: { content } }] },
      request
    );

    expect(response.content).toBe(content);
    expect(response.toolCalls).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      '[OpenAIAdapter] Failed to parse Qwen XML tool call:',
      expect.any(SyntaxError)
    );
  });

  it('recovers multiple Qwen XML tool calls in order', async () => {
    const adapter = new OpenAIAdapter();
    const request: AdapterRequest = {
      config,
      messages: [{ role: 'user', content: 'search docs' }],
      options: { stream: false, tools: [searchDocsTool, lookupCaseTool] },
    };

    const response = await adapter.parseResponse(
      new Response(null),
      {
        choices: [
          {
            message: {
              content: `Planning.
<tool_call>
{"name":"search_docs","arguments":{"query":"alpha"}}
</tool_call>
<tool_call>
{"name":"lookup_case","arguments":{"id":"case-1"}}
</tool_call>
Done.`,
            },
          },
        ],
      },
      request
    );

    expect(response.content).toBe('Planning.\n\nDone.');
    expect(response.toolCalls).toEqual([
      {
        id: 'qwen-xml-tool-0',
        name: 'search_docs',
        arguments: { query: 'alpha' },
      },
      {
        id: 'qwen-xml-tool-1',
        name: 'lookup_case',
        arguments: { id: 'case-1' },
      },
    ]);
  });

  it('does not recover literal Qwen XML when no tools were offered', async () => {
    const adapter = new OpenAIAdapter();
    const request: AdapterRequest = {
      config,
      messages: [{ role: 'user', content: 'document a tool call' }],
      options: { stream: false, tools: [] },
    };

    const response = await adapter.parseResponse(
      new Response(null),
      {
        choices: [
          {
            message: {
              content: `<tool_call>
{"name":"search_docs","arguments":{"query":"example"}}
</tool_call>`,
            },
          },
        ],
      },
      request
    );

    expect(response.toolCalls).toBeUndefined();
    expect(response.content).toContain('<tool_call>');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
