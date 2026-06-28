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

  it('renders unlabeled single-line fenced code as a block', () => {
    render(
      <MessageContent
        role="assistant"
        content={'```\none-line fence\n```'}
      />
    );

    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('preserves soft line breaks in model output', () => {
    const { container } = render(
      <MessageContent
        role="assistant"
        content={'Line one\nLine two'}
      />
    );

    expect(container.querySelector('br')).toBeInTheDocument();
    expect(container.textContent).toContain('Line one');
    expect(container.textContent).toContain('Line two');
  });

  it('displays raw html as literal text', () => {
    const { container } = render(
      <MessageContent
        role="assistant"
        content={'Use <div>literal html</div> safely'}
      />
    );

    expect(container.textContent).toContain('Use <div>literal html</div> safely');
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

  it('does not render control-character javascript links as live anchors', () => {
    render(
      <MessageContent
        role="assistant"
        content={'[unsafe](java&#10;script:alert(1))'}
      />
    );

    expect(screen.getByText('unsafe').closest('a')).toBeNull();
  });
});
