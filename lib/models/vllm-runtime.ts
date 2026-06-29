export type VLLMChatTemplateContentFormat = 'auto' | 'openai' | 'string';

export interface VLLMRuntimeMetadata {
  enable_auto_tool_choice?: boolean;
  tool_call_parser?: string;
  chat_template?: string;
  chat_template_content_format?: VLLMChatTemplateContentFormat;
  parse_qwen_xml_tool_calls?: boolean;
}

export const VLLM_TOOL_CALL_PARSERS = [
  'hermes',
  'qwen3_xml',
  'qwen3_coder',
  'llama3_json',
  'llama4_json',
  'llama4_pythonic',
  'mistral',
  'deepseek_v3',
  'deepseek_v31',
  'deepseek_v32',
  'openai',
  'pythonic',
  'granite',
  'phi4_mini_json',
  'functiongemma',
  'xlam',
  'glm45',
  'glm47',
];

export const VLLM_CHAT_TEMPLATE_CONTENT_FORMATS: VLLMChatTemplateContentFormat[] = [
  'auto',
  'openai',
  'string',
];

const VLLM_RUNTIME_METADATA_KEYS: Array<keyof VLLMRuntimeMetadata> = [
  'enable_auto_tool_choice',
  'tool_call_parser',
  'chat_template',
  'chat_template_content_format',
  'parse_qwen_xml_tool_calls',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function getVllmRuntimeMetadata(metadata: unknown): VLLMRuntimeMetadata {
  if (!isRecord(metadata)) return {};

  if (!isRecord(metadata.vllm_runtime)) return {};

  const raw = metadata.vllm_runtime;

  const format = asString(raw.chat_template_content_format);
  const parser = asString(raw.tool_call_parser);

  return {
    enable_auto_tool_choice: asBoolean(raw.enable_auto_tool_choice),
    tool_call_parser:
      parser && VLLM_TOOL_CALL_PARSERS.includes(parser)
        ? parser
        : undefined,
    chat_template: asString(raw.chat_template),
    chat_template_content_format:
      format && VLLM_CHAT_TEMPLATE_CONTENT_FORMATS.includes(format as VLLMChatTemplateContentFormat)
        ? format as VLLMChatTemplateContentFormat
        : undefined,
    parse_qwen_xml_tool_calls: asBoolean(raw.parse_qwen_xml_tool_calls),
  };
}

export function withVllmRuntimeMetadata(
  metadata: unknown,
  patch: VLLMRuntimeMetadata
): Record<string, unknown> {
  const base = isRecord(metadata) ? { ...metadata } : {};
  for (const key of VLLM_RUNTIME_METADATA_KEYS) {
    delete base[key];
  }

  const current = getVllmRuntimeMetadata(base);
  const next: VLLMRuntimeMetadata = { ...current, ...patch };

  for (const key of VLLM_RUNTIME_METADATA_KEYS) {
    const value = next[key];
    if (value === undefined || value === '') {
      delete next[key];
    }
  }

  return {
    ...base,
    vllm_runtime: next,
  };
}
