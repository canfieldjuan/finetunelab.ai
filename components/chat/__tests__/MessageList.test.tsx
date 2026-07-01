// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../MessageList';
import type { Message } from '../types';

const getSession = vi.hoisted(() => vi.fn());
const requestSnippetRewriteMock = vi.hoisted(() => vi.fn());
const requestSnippetRevisionMock = vi.hoisted(() => vi.fn());
const MODEL_ID = '11111111-1111-1111-1111-111111111111';

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession,
    },
  },
}));

vi.mock('@/lib/snippet-revision/client', () => ({
  requestSnippetRewrite: requestSnippetRewriteMock,
  requestSnippetRevision: requestSnippetRevisionMock,
  SnippetRevisionApiError: class SnippetRevisionApiError extends Error {
    code = 'test_error';
  },
}));

const noop = vi.fn();

function renderList(messages: Message[], overrides: Partial<React.ComponentProps<typeof MessageList>> = {}) {
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
      snippetRevisionModelId={MODEL_ID}
      snippetRevisionAuthToken="session-token"
      {...overrides}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
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
    const popup = {
      closed: false,
      close: vi.fn(),
      location: { href: 'about:blank' },
      opener: {} as unknown,
    };
    const open = vi.fn(() => popup);
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

    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(popup.opener).toBeNull();

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
    expect(open).toHaveBeenCalledTimes(1);
    expect(popup.location.href).toBe('https://signed.example.com/brief.md?token=abc');
  });
});

describe('MessageList snippet revision actions', () => {
  it('exposes a revise action for assistant text messages', () => {
    renderList([
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Line one.\nLine two.',
      },
    ], {
      onApplySnippetRevision: vi.fn(),
    });

    expect(screen.getByRole('button', { name: 'Revise selected text' })).toBeEnabled();
  });

  it('does not expose the revise action for user messages', () => {
    renderList([
      {
        id: 'user-1',
        role: 'user',
        content: 'Please write a blog post.',
      },
    ], {
      onApplySnippetRevision: vi.fn(),
    });

    expect(screen.queryByRole('button', { name: 'Revise selected text' })).not.toBeInTheDocument();
  });

  it('sends selected source offsets to rewrite, previews, and applies the guarded update', async () => {
    const message = 'Opening.\nSoft middle.\nClosing.';
    const start = message.indexOf('Soft middle.');
    const end = start + 'Soft middle.'.length;
    const onApply = vi.fn();

    requestSnippetRewriteMock.mockResolvedValue({
      replacement: 'Sharper middle.',
      modelId: MODEL_ID,
    });
    requestSnippetRevisionMock.mockImplementation(async (request) => ({
      ok: true,
      applied: request.action === 'apply',
      updatedText: 'Opening.\nSharper middle.\nClosing.',
      unchanged: false,
      change: {
        mode: 'replace_range',
        start,
        end,
        original: 'Soft middle.',
        replacement: 'Sharper middle.',
      },
    }));

    renderList([
      {
        id: 'assistant-1',
        role: 'assistant',
        content: message,
      },
    ], {
      onApplySnippetRevision: onApply,
      snippetRevisionModelId: MODEL_ID,
      snippetRevisionAuthToken: 'session-token',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Revise selected text' }));

    const source = await screen.findByLabelText('Assistant response source') as HTMLTextAreaElement;
    source.setSelectionRange(start, end);
    fireEvent.select(source);
    fireEvent.change(screen.getByLabelText('Revision instruction'), {
      target: {
        value: 'Make it sharper.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Generate Preview' }));

    await waitFor(() => {
      expect(requestSnippetRewriteMock).toHaveBeenCalledWith({
        sourceText: message,
        selection: {
          start,
          end,
          expectedText: 'Soft middle.',
        },
        instruction: 'Make it sharper.',
        modelId: MODEL_ID,
      }, {
        authToken: 'session-token',
      });
    });
    expect(requestSnippetRevisionMock).toHaveBeenCalledWith({
      action: 'preview',
      sourceText: message,
      revision: {
        mode: 'replace_range',
        start,
        end,
        expectedText: 'Soft middle.',
        replace: 'Sharper middle.',
      },
    });

    await screen.findByText('Preview Ready');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith(
        'assistant-1',
        'Opening.\nSharper middle.\nClosing.',
      );
    });
  });

  it('disables snippet revision for locally truncated assistant messages', () => {
    renderList([
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Partial response.\n\n... [Message truncated due to size. Original length: 60000 characters]',
        contentTruncated: true,
        originalContentLength: 60_000,
      },
    ], {
      onApplySnippetRevision: vi.fn(),
    });

    expect(screen.getByRole('button', { name: 'Revise selected text' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Revise selected text' })).toHaveAttribute(
      'title',
      'Load the full message before revising',
    );
  });

  it('disables snippet revision for unsaved temporary assistant messages', () => {
    renderList([
      {
        id: 'temp-assistant-1',
        role: 'assistant',
        content: 'Response is still saving.',
      },
    ], {
      onApplySnippetRevision: vi.fn(),
    });

    expect(screen.getByRole('button', { name: 'Revise selected text' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Revise selected text' })).toHaveAttribute(
      'title',
      'Revision is available after this response is saved',
    );
  });

  it('explains auth and model blockers independently', () => {
    const { rerender } = renderList([
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Saved response.',
      },
    ], {
      onApplySnippetRevision: vi.fn(),
      snippetRevisionAuthToken: null,
    });

    expect(screen.getByRole('button', { name: 'Revise selected text' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Revise selected text' })).toHaveAttribute(
      'title',
      'Sign in to revise assistant text',
    );

    rerender(
      <MessageList
        messages={[{
          id: 'assistant-1',
          role: 'assistant',
          content: 'Saved response.',
        }]}
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
        onApplySnippetRevision={vi.fn()}
        snippetRevisionAuthToken="session-token"
        snippetRevisionModelId="__default__"
      />,
    );

    expect(screen.getByRole('button', { name: 'Revise selected text' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Revise selected text' })).toHaveAttribute(
      'title',
      'Select a model to revise text',
    );
  });

  it('maps normalized textarea selections back to CRLF source offsets', async () => {
    const message = 'Opening.\r\nSoft middle.\r\nClosing.';
    const displayMessage = 'Opening.\nSoft middle.\nClosing.';
    const displayStart = displayMessage.indexOf('Soft middle.');
    const displayEnd = displayStart + 'Soft middle.'.length;
    const sourceStart = message.indexOf('Soft middle.');
    const sourceEnd = sourceStart + 'Soft middle.'.length;
    const onApply = vi.fn();

    requestSnippetRewriteMock.mockResolvedValue({
      replacement: 'Sharper middle.',
      modelId: MODEL_ID,
    });
    requestSnippetRevisionMock.mockResolvedValue({
      ok: true,
      applied: false,
      updatedText: 'Opening.\r\nSharper middle.\r\nClosing.',
      unchanged: false,
      change: {
        mode: 'replace_range',
        start: sourceStart,
        end: sourceEnd,
        original: 'Soft middle.',
        replacement: 'Sharper middle.',
      },
    });

    renderList([
      {
        id: 'assistant-1',
        role: 'assistant',
        content: message,
      },
    ], {
      onApplySnippetRevision: onApply,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Revise selected text' }));

    const source = await screen.findByLabelText('Assistant response source') as HTMLTextAreaElement;
    expect(source.value).toBe(displayMessage);
    source.setSelectionRange(displayStart, displayEnd);
    fireEvent.select(source);
    fireEvent.change(screen.getByLabelText('Revision instruction'), {
      target: {
        value: 'Make it sharper.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Generate Preview' }));

    await waitFor(() => {
      expect(requestSnippetRewriteMock).toHaveBeenCalledWith({
        sourceText: message,
        selection: {
          start: sourceStart,
          end: sourceEnd,
          expectedText: 'Soft middle.',
        },
        instruction: 'Make it sharper.',
        modelId: MODEL_ID,
      }, {
        authToken: 'session-token',
      });
    });
  });

  it('keeps the full-message regenerate action intact', () => {
    const onRegenerate = vi.fn();

    renderList([
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Full answer.',
      },
    ], {
      onRegenerate,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate response' }));

    expect(onRegenerate).toHaveBeenCalledWith('assistant-1');
  });
});
