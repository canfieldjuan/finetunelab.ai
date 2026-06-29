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

  const raw = isRecord(metadata.vllm_runtime)
    ? metadata.vllm_runtime
    : metadata;

  const format = asString(raw.chat_template_content_format);

  return {
    enable_auto_tool_choice: asBoolean(raw.enable_auto_tool_choice),
    tool_call_parser: asString(raw.tool_call_parser),
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
  const current = getVllmRuntimeMetadata(base);
  const next: VLLMRuntimeMetadata = { ...current, ...patch };

  for (const key of Object.keys(next) as Array<keyof VLLMRuntimeMetadata>) {
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
