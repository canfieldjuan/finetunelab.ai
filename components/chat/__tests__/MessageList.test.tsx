// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../MessageList';
import type { Message } from '../types';

const noop = vi.fn();

function renderList(messages: Message[]) {
  return render(
    <MessageList
      messages={messages}
      feedback={{}}
      copiedMessageId={null}
      speakingMessageId={null}
      isSpeaking={false}
      isPaused={false}
      ttsSupported={false}
      ttsEnabled={false}
      onCopyMessage={noop}
      onFeedback={noop}
      onToggleTTS={noop}
      onStopTTS={noop}
      onEvaluate={noop}
      onEmailResearch={noop}
      onDownloadResearch={noop}
      isDeepResearchResult={() => false}
    />
  );
}

describe('MessageList web search results', () => {
  it('renders structured web search results with SearchResultCard', () => {
    renderList([
      {
        id: 'temp-assistant',
        role: 'assistant',
        content: 'Here are the most relevant sources.',
        webSearchResults: [
          {
            title: 'FineTune Lab Search Result',
            url: 'https://example.com/result',
            snippet: 'A relevant result from the web.',
            source: 'example.com',
            confidenceScore: 0.86,
          },
        ],
      },
    ]);

    expect(screen.getByText('Here are the most relevant sources.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /FineTune Lab Search Result/i })).toHaveAttribute(
      'href',
      'https://example.com/result'
    );
    expect(screen.queryByText(/"results"/)).not.toBeInTheDocument();
  });

  it('uses a plain image thumbnail in chat search cards', () => {
    renderList([
      {
        id: 'temp-assistant',
        role: 'assistant',
        content: 'Thumbnail result.',
        webSearchResults: [
          {
            title: 'Remote Thumbnail Result',
            url: 'https://example.com/thumbnail-result',
            snippet: 'A result with a provider thumbnail.',
            imageUrl: 'https://cdn.example.com/thumb.jpg',
          },
        ],
      },
    ]);

    expect(screen.getByRole('img', { name: 'Remote Thumbnail Result' })).toHaveAttribute(
      'data-thumbnail-renderer',
      'plain-img'
    );
  });
});
