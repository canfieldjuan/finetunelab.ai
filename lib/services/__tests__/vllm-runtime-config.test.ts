import { describe, expect, it } from 'vitest';
import { STATUS } from '@/lib/constants';
import {
  buildVLLMConfigFromServerRow,
  buildVLLMServerConfigJson,
} from '../vllm-runtime-config';

describe('vLLM runtime config mapping', () => {
  it('persists tool runtime flags into server config_json', () => {
    expect(buildVLLMServerConfigJson({
      modelPath: '/models/qwen',
      modelName: 'qwen-local',
      gpuMemoryUtilization: 0.72,
      maxModelLen: 4096,
      tensorParallelSize: 2,
      dtype: 'bfloat16',
      trustRemoteCode: true,
      enableAutoToolChoice: true,
      toolCallParser: 'qwen3_xml',
      chatTemplate: '/templates/qwen3.jinja',
      chatTemplateContentFormat: 'openai',
    })).toEqual(expect.objectContaining({
      gpu_memory_utilization: 0.72,
      max_model_len: 4096,
      tensor_parallel_size: 2,
      dtype: 'bfloat16',
      trust_remote_code: true,
      enable_auto_tool_choice: true,
      tool_call_parser: 'qwen3_xml',
      chat_template: '/templates/qwen3.jinja',
      chat_template_content_format: 'openai',
    }));
  });

  it('rehydrates tool runtime flags from saved server rows for restart', () => {
    expect(buildVLLMConfigFromServerRow({
      id: 'server-1',
      user_id: 'user-1',
      server_type: STATUS.VLLM,
      status: STATUS.STOPPED,
      model_path: '/models/qwen',
      model_name: 'qwen-local',
      port: null,
      process_id: null,
      config_json: {
        gpu_memory_utilization: 0.61,
        max_model_len: 8192,
        tensor_parallel_size: 1,
        dtype: 'auto',
        trust_remote_code: false,
        enable_auto_tool_choice: true,
        tool_call_parser: 'qwen3_xml',
        chat_template: '{{ bos_token }} {{ messages }}',
        chat_template_content_format: 'string',
      },
    })).toEqual(expect.objectContaining({
      modelPath: '/models/qwen',
      modelName: 'qwen-local',
      gpuMemoryUtilization: 0.61,
      maxModelLen: 8192,
      enableAutoToolChoice: true,
      toolCallParser: 'qwen3_xml',
      chatTemplate: '{{ bos_token }} {{ messages }}',
      chatTemplateContentFormat: 'string',
    }));
  });
});
