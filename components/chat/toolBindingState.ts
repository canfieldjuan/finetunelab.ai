export const DRAFT_TOOL_BINDING_CHAT_KEY = 'draft';

export type ToolBindingState = Record<string, string[]>;

export function getToolBindingChatKey(activeId: string | null | undefined): string {
  return activeId || DRAFT_TOOL_BINDING_CHAT_KEY;
}

export function migrateDraftToolBindingsToConversation(
  current: ToolBindingState,
  conversationId: string | null | undefined,
): ToolBindingState {
  const targetId = conversationId?.trim();
  if (!targetId || !Object.prototype.hasOwnProperty.call(current, DRAFT_TOOL_BINDING_CHAT_KEY)) {
    return current;
  }

  const {
    [DRAFT_TOOL_BINDING_CHAT_KEY]: draftDisabledToolNames,
    ...withoutDraft
  } = current;

  if (Object.prototype.hasOwnProperty.call(withoutDraft, targetId)) {
    return withoutDraft;
  }

  return {
    ...withoutDraft,
    [targetId]: draftDisabledToolNames,
  };
}
