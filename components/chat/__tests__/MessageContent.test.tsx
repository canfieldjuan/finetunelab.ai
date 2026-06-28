// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageContent } from '../MessageContent';

describe('MessageContent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders GFM tables as table elements', () => {
    render(
      <MessageContent
        role="assistant"
        content={`| Feature | Status |
| --- | --- |
| Tables | Rendered |`}
      />
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Feature' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Rendered' })).toBeInTheDocument();
  });

  it('renders fenced code blocks without trimming indentation', () => {
    const { container } = render(
      <MessageContent
        role="assistant"
        content={`\`\`\`ts
function answer() {
  return 42;
}
\`\`\``}
      />
    );

    expect(screen.getByText('ts')).toBeInTheDocument();
    expect(container.querySelector('pre')?.textContent).toContain('  return 42;');
  });

  it('copies code blocks through the fallback when navigator.clipboard is unavailable', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: () => true,
    });
    const execCommand = vi.spyOn(document, 'execCommand').mockReturnValue(true);

    render(
      <MessageContent
        role="assistant"
        content={`\`\`\`js
console.log("copy me");
\`\`\``}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('does not render javascript markdown links as live anchors', () => {
    render(
      <MessageContent
        role="assistant"
        content={`[unsafe](javascript:alert(1)) [safe](https://example.com)`}
      />
    );

    expect(screen.getByText('unsafe').closest('a')).toBeNull();
    expect(screen.getByRole('link', { name: 'safe' })).toHaveAttribute('href', 'https://example.com');
  });
});
