// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../MessageList';
import type { Message } from '../types';

const getSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession,
    },
  },
}));

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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

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

  it('renders MCP tool activity as a readable server/tool label', () => {
    renderList([
      {
        id: 'temp-assistant',
        role: 'assistant',
        content: 'I checked your MCP docs.',
        tools_called: [{ name: 'mcp__docs__lookup', success: true }],
      },
    ]);

    expect(screen.getByText('docs lookup')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.queryByText(/mcp__/)).not.toBeInTheDocument();
    expect(screen.queryByText(/"name"/)).not.toBeInTheDocument();
  });

  it('skips judgment fetch UI for delivered synthetic image messages', () => {
    renderList([
      {
        id: 'img-job-1',
        role: 'assistant',
        content: '![generated image](https://cdn.example.com/image.png)',
        skipJudgments: true,
      },
    ]);

    expect(screen.getByRole('img', { name: 'generated image' })).toBeInTheDocument();
    expect(screen.queryByText('Loading validations...')).not.toBeInTheDocument();
  });

  it('renders compact attachment chips on user messages', () => {
    renderList([
      {
        id: 'user-with-attachment',
        role: 'user',
        content: 'Use this file.',
        attachments: [
          {
            id: 'attachment-1',
            filename: 'brief.md',
            contentType: 'text/markdown',
            sizeBytes: 2048,
            kind: 'text',
            extractedChars: 120,
            status: 'attached',
          },
        ],
      },
    ]);

    expect(screen.getByText('Use this file.')).toBeInTheDocument();
    expect(screen.getByText('brief.md')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('opens attached files through an authenticated signed-download request', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } } });
    const open = vi.fn();
    vi.stubGlobal('open', open);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      success: true,
      url: 'https://signed.example.com/brief.md?token=abc',
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    renderList([
      {
        id: 'user-with-attachment',
        role: 'user',
        content: 'Use this file.',
        attachments: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            filename: 'brief.md',
            contentType: 'text/markdown',
            sizeBytes: 2048,
            kind: 'text',
            extractedChars: 120,
            status: 'attached',
          },
        ],
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Download brief.md' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/chat/attachments?attachmentId=11111111-1111-4111-8111-111111111111',
        {
          headers: {
            Authorization: 'Bearer session-token',
          },
        },
      );
    });
    expect(open).toHaveBeenCalledWith(
      'https://signed.example.com/brief.md?token=abc',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
