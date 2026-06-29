import type { VLLMConfig } from './inference-server-manager';
import type { LocalServerRow, ServerConfigJson } from './server-swap';

export function buildVLLMServerConfigJson(
  config: VLLMConfig,
  extra: Partial<ServerConfigJson> = {}
): ServerConfigJson {
  return {
    gpu_memory_utilization: config.gpuMemoryUtilization ?? 0.8,
    ...(config.maxModelLen !== undefined ? { max_model_len: config.maxModelLen } : {}),
    tensor_parallel_size: config.tensorParallelSize ?? 1,
    dtype: config.dtype ?? 'auto',
    trust_remote_code: config.trustRemoteCode ?? false,
    enable_auto_tool_choice: config.enableAutoToolChoice ?? true,
    tool_call_parser: config.toolCallParser || 'hermes',
    ...(config.chatTemplate ? { chat_template: config.chatTemplate } : {}),
    ...(config.chatTemplateContentFormat
      ? { chat_template_content_format: config.chatTemplateContentFormat }
      : {}),
    ...extra,
  };
}

export function buildVLLMConfigFromServerRow(
  server: LocalServerRow,
  defaults: { maxModelLen?: number } = {}
): VLLMConfig {
  const config = server.config_json ?? {};
  const maxModelLen = config.max_model_len ?? defaults.maxModelLen;

  return {
    modelPath: server.model_path,
    modelName: server.model_name,
    gpuMemoryUtilization: config.gpu_memory_utilization ?? 0.8,
    ...(maxModelLen !== undefined ? { maxModelLen } : {}),
    tensorParallelSize: config.tensor_parallel_size ?? 1,
    dtype: config.dtype ?? 'auto',
    trustRemoteCode: config.trust_remote_code ?? false,
    enableAutoToolChoice: config.enable_auto_tool_choice ?? true,
    toolCallParser: config.tool_call_parser ?? 'hermes',
    ...(config.chat_template ? { chatTemplate: config.chat_template } : {}),
    ...(config.chat_template_content_format
      ? { chatTemplateContentFormat: config.chat_template_content_format }
      : {}),
  };
}
