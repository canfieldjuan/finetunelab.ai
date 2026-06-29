import type { ChatToolCall } from '../chat/types';

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeToolCalls(value: unknown): ChatToolCall[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const calls = value.flatMap((item): ChatToolCall[] => {
    if (!isRecord(item)) return [];

    const name = getString(item.name);
    if (!name) return [];

    const call: ChatToolCall = {
      name,
      success: item.success === true,
    };

    const error = getString(item.error);
    if (error) {
      call.error = error;
    }

    return [call];
  });

  return calls.length > 0 ? calls : undefined;
}

export function getRenderableToolCalls(message: {
  tools_called?: unknown;
  webSearchResults?: unknown[];
}): ChatToolCall[] {
  const calls = normalizeToolCalls(message.tools_called) ?? [];
  const hasSearchCards = Array.isArray(message.webSearchResults) && message.webSearchResults.length > 0;

  return calls.filter((call) => {
    if (call.name !== 'web_search') return true;
    return !hasSearchCards || !call.success;
  });
}
