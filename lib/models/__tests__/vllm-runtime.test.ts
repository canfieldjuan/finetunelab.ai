import { describe, expect, it } from 'vitest';
import { getVllmRuntimeMetadata, withVllmRuntimeMetadata } from '../vllm-runtime';

describe('vLLM runtime metadata', () => {
  it('reads only the vllm_runtime sub-key and validates allowlisted values', () => {
    expect(getVllmRuntimeMetadata({
      enable_auto_tool_choice: true,
      tool_call_parser: 'not-a-parser',
      chat_template_content_format: 'string',
      parse_qwen_xml_tool_calls: true,
    })).toEqual({});

    expect(getVllmRuntimeMetadata({
      vllm_runtime: {
        enable_auto_tool_choice: true,
        tool_call_parser: 'qwen3_xml',
        chat_template: 'template text',
        chat_template_content_format: 'string',
        parse_qwen_xml_tool_calls: true,
      },
    })).toEqual({
      enable_auto_tool_choice: true,
      tool_call_parser: 'qwen3_xml',
      chat_template: 'template text',
      chat_template_content_format: 'string',
      parse_qwen_xml_tool_calls: true,
    });
  });

  it('drops invalid parser and chat content format values', () => {
    expect(getVllmRuntimeMetadata({
      vllm_runtime: {
        tool_call_parser: '$(bad)',
        chat_template_content_format: 'xml',
      },
    })).toEqual({
      enable_auto_tool_choice: undefined,
      tool_call_parser: undefined,
      chat_template: undefined,
      chat_template_content_format: undefined,
      parse_qwen_xml_tool_calls: undefined,
    });
  });

  it('writes runtime changes under vllm_runtime and removes top-level runtime-looking fields', () => {
    expect(withVllmRuntimeMetadata(
      {
        provider_note: 'keep me',
        tool_call_parser: 'top-level-footgun',
      },
      {
        enable_auto_tool_choice: true,
        tool_call_parser: 'hermes',
      }
    )).toEqual({
      provider_note: 'keep me',
      vllm_runtime: {
        enable_auto_tool_choice: true,
        tool_call_parser: 'hermes',
      },
    });
  });
});
