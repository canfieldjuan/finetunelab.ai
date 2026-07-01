// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToolBindingControls } from '../ToolBindingControls';
import type { PortalChatTool } from '../types';

function portalTool(name: string, description: string): PortalChatTool {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  };
}

describe('ToolBindingControls', () => {
  it('renders enabled tool state and emits binding changes', () => {
    const onToggleTool = vi.fn();
    const onEnableAll = vi.fn();
    const onDisableAll = vi.fn();

    render(
      <ToolBindingControls
        tools={[
          portalTool('calculator', 'Run deterministic math.'),
          portalTool('web_search', 'Search the web.'),
        ]}
        enabledToolNames={new Set(['calculator'])}
        onToggleTool={onToggleTool}
        onEnableAll={onEnableAll}
        onDisableAll={onDisableAll}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chat tools (1/2 enabled)' }));

    expect(screen.getByText('1 of 2 enabled for this chat')).toBeInTheDocument();
    expect(screen.getByLabelText(/Calculator/)).toBeChecked();
    expect(screen.getByLabelText(/Web Search/)).not.toBeChecked();

    fireEvent.click(screen.getByLabelText(/Web Search/));
    expect(onToggleTool).toHaveBeenCalledWith('web_search', true);

    fireEvent.click(screen.getByRole('button', { name: 'Enable All' }));
    expect(onEnableAll).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Disable All' }));
    expect(onDisableAll).toHaveBeenCalledTimes(1);
  });
});
