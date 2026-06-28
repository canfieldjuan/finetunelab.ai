import type { ToolDefinition } from './types';

export interface RegistryToolSeedRow {
  name: string;
  description: string;
  parameters: ToolDefinition['parameters'];
  is_builtin: true;
  is_enabled: boolean;
}

export const PORTAL_CHAT_TOOL_NAMES = new Set([
  'calculator',
  'datetime',
  'web_search',
  'query_knowledge_graph',
  'intelligent_email',
  'email_analysis',
  'email_security',
]);

export function isPortalChatTool(tool: Pick<ToolDefinition, 'name'>): boolean {
  return PORTAL_CHAT_TOOL_NAMES.has(tool.name);
}

export function buildRegistryToolSeedRows(tools: ToolDefinition[]): RegistryToolSeedRow[] {
  return tools
    .filter(isPortalChatTool)
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      is_builtin: true as const,
      is_enabled: Boolean(tool.config.enabled),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
