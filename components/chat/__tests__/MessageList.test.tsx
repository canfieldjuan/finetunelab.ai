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

  it('renders non-search tool activity without raw JSON', () => {
    renderList([
      {
        id: 'temp-assistant',
        role: 'assistant',
        content: 'I checked your uploaded documents.',
        tools_called: [
          { name: 'query_knowledge_graph', success: true },
          { name: 'email_security', success: false, error: 'Mailbox not connected' },
        ],
      },
    ]);

    expect(screen.getByText('query knowledge graph')).toBeInTheDocument();
    expect(screen.getByText('email security')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Mailbox not connected')).toBeInTheDocument();
    expect(screen.queryByText(/"success"/)).not.toBeInTheDocument();
  });

  it('does not duplicate successful web search tool activity when cards render', () => {
    renderList([
      {
        id: 'temp-assistant',
        role: 'assistant',
        content: 'Here are the sources.',
        tools_called: [{ name: 'web_search', success: true }],
        webSearchResults: [
          {
            title: 'Search Result',
            url: 'https://example.com/search',
            snippet: 'Search summary.',
          },
        ],
      },
    ]);

    expect(screen.getByRole('link', { name: /Search Result/i })).toBeInTheDocument();
    expect(screen.queryByText('web search')).not.toBeInTheDocument();
  });
});
