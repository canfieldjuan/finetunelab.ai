import { describe, expect, it } from 'vitest';
import {
  DRAFT_TOOL_BINDING_CHAT_KEY,
  getToolBindingChatKey,
  migrateDraftToolBindingsToConversation,
} from '../toolBindingState';

describe('tool binding state', () => {
  it('uses the draft key until a conversation id exists', () => {
    expect(getToolBindingChatKey('')).toBe(DRAFT_TOOL_BINDING_CHAT_KEY);
    expect(getToolBindingChatKey(null)).toBe(DRAFT_TOOL_BINDING_CHAT_KEY);
    expect(getToolBindingChatKey('conversation-1')).toBe('conversation-1');
  });

  it('migrates draft disabled tools to the created conversation and clears draft state', () => {
    const state = {
      [DRAFT_TOOL_BINDING_CHAT_KEY]: ['generate_image'],
      'conversation-1': ['calculator'],
    };

    expect(migrateDraftToolBindingsToConversation(state, 'conversation-2')).toEqual({
      'conversation-1': ['calculator'],
      'conversation-2': ['generate_image'],
    });
  });

  it('does not overwrite existing conversation bindings when clearing draft state', () => {
    const state = {
      [DRAFT_TOOL_BINDING_CHAT_KEY]: ['generate_image'],
      'conversation-1': ['calculator'],
    };

    expect(migrateDraftToolBindingsToConversation(state, 'conversation-1')).toEqual({
      'conversation-1': ['calculator'],
    });
  });

  it('leaves state unchanged when there is no draft binding to promote', () => {
    const state = {
      'conversation-1': ['calculator'],
    };

    expect(migrateDraftToolBindingsToConversation(state, 'conversation-2')).toBe(state);
  });
});
