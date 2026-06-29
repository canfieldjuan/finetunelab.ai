'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageContent } from './MessageContent';
import { SearchResultCard } from '@/components/search/SearchResultCard';
import { GraphRAGIndicator } from '../graphrag/GraphRAGIndicator';
import { MessageMetadata } from './MessageMetadata';
import { MessageJudgments } from './MessageJudgments';
import { getRenderableToolCalls } from '../hooks/chatToolStream';
import {
  AlertCircle,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Star,
  CheckCircle,
  PlayCircle,
  Pause,
  StopCircle,
  Volume2,
  MoreVertical,
  Mail,
  Download,
  RefreshCw,
  Wrench
} from 'lucide-react';
import type { Message } from './types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export interface MessageListProps {
  messages: Message[];
  feedback: { [key: string]: number };
  copiedMessageId: string | null;
  speakingMessageId: string | null;
  isSpeaking: boolean;
  isPaused: boolean;
  ttsSupported: boolean;
  ttsEnabled: boolean;
  onCopyMessage: (content: string, messageId: string) => void;
  onFeedback: (messageId: string, value: number) => void;
  onToggleTTS: (messageId: string, content: string) => void;
  onStopTTS: () => void;
  onEvaluate: (messageId: string) => void;
  onEmailResearch: (content: string) => void;
  onDownloadResearch: (content: string) => void;
  isDeepResearchResult: (content: string) => boolean;
  onRegenerate?: (messageId: string) => void;
}

function formatToolName(name: string): string {
  if (name.startsWith('mcp__')) {
    const [, server, ...toolParts] = name.split('__');
    const label = [server, ...toolParts].filter(Boolean).join(' ');
    return label.replace(/_/g, ' ');
  }

  return name.replace(/_/g, ' ');
}

function ToolActivityPanel({ message }: { message: Message }) {
  const toolCalls = getRenderableToolCalls(message);
  if (toolCalls.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="space-y-2">
        {toolCalls.map((tool, index) => (
          <div
            key={`${tool.name}-${index}`}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Wrench className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              <span className="truncate font-medium capitalize text-gray-800 dark:text-gray-100">
                {formatToolName(tool.name)}
              </span>
            </div>
            <div className="flex min-w-0 flex-col items-end gap-1 text-right">
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${
                  tool.success
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'
                }`}
              >
                {tool.success ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
                {tool.success ? 'Complete' : 'Failed'}
              </span>
              {tool.error && (
                <span className="max-w-[22rem] truncate text-xs text-red-700 dark:text-red-300">
                  {tool.error}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * MessageList component - renders the list of chat messages
 * Extracted from Chat.tsx to improve code organization and maintainability
 */
export function MessageList({
  messages,
  feedback,
  copiedMessageId,
  speakingMessageId,
  isSpeaking,
  isPaused,
  ttsSupported,
  ttsEnabled,
  onCopyMessage,
  onFeedback,
  onToggleTTS,
  onStopTTS,
  onEvaluate,
  onEmailResearch,
  onDownloadResearch,
  isDeepResearchResult,
  onRegenerate
}: MessageListProps) {
  return (
    <>
      {messages.map((msg) => (
        <div
          key={msg.id + msg.role}
          className={`group relative mb-6 ${
            msg.role === "user"
              ? "flex justify-end"
              : "flex justify-start"
          }`}
        >
          <div className={`flex flex-col ${msg.role === "user" ? "items-end max-w-[70%]" : "items-start max-w-[90%]"}`}>
            <div
              className={
                msg.role === "user"
                  ? "rounded-2xl border border-gray-200 dark:border-gray-700 px-4 py-2 w-full bg-gray-100 dark:bg-gray-800 text-foreground"
                  : "w-full text-foreground"
              }
            >
              <MessageContent content={msg.content} role={msg.role} />
              {msg.role === "assistant" && Array.isArray(msg.webSearchResults) && msg.webSearchResults.length > 0 && (
                <div className="mt-4 grid grid-cols-1 gap-3">
                  {msg.webSearchResults.map((result, index) => (
                    <SearchResultCard
                      key={`${result.url}-${index}`}
                      result={result}
                      index={index}
                      thumbnailMode="plain-img"
                    />
                  ))}
                </div>
              )}
              {msg.role === "assistant" && <ToolActivityPanel message={msg} />}
              {msg.role === "assistant" && (
                <>
                  <GraphRAGIndicator
                    citations={msg.citations}
                    contextsUsed={msg.contextsUsed}
                  />
                  <MessageMetadata
                    modelName={msg.model_name}
                    provider={msg.provider}
                    inputTokens={msg.input_tokens}
                    outputTokens={msg.output_tokens}
                    latencyMs={msg.latency_ms}
                    // GraphRAG metadata
                    graphragUsed={msg.graphrag_used}
                    graphragNodes={msg.graphrag_nodes}
                    graphragChunks={msg.graphrag_chunks}
                    graphragRetrievalMs={msg.graphrag_retrieval_ms}
                    graphragRelevance={msg.graphrag_relevance}
                    graphragGrounded={msg.graphrag_grounded}
                    graphragMethod={msg.graphrag_method}
                  />
                  <MessageJudgments messageId={msg.id} />
                </>
              )}
            </div>
            {msg.role === "assistant" && (
              <div className="flex justify-start mt-1 w-full">
                <div className="flex items-center space-x-1">
                  {ttsSupported && ttsEnabled && msg.content && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleTTS(msg.id, msg.content)}
                        className={`h-7 w-7 p-0 ${
                          speakingMessageId === msg.id && (isSpeaking || isPaused)
                            ? "text-blue-500 hover:bg-muted"
                            : "hover:bg-muted"
                        }`}
                        aria-label={
                          speakingMessageId === msg.id && isSpeaking && !isPaused
                            ? "Pause speaking"
                            : speakingMessageId === msg.id && isPaused
                            ? "Resume speaking"
                            : "Read message aloud"
                        }
                      >
                        {speakingMessageId === msg.id && isSpeaking && !isPaused ? (
                          <Pause className="w-4 h-4" />
                        ) : speakingMessageId === msg.id && isPaused ? (
                          <PlayCircle className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </Button>
                      {speakingMessageId === msg.id && (isSpeaking || isPaused) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onStopTTS}
                          className="h-7 w-7 p-0 hover:bg-muted text-red-500"
                          aria-label="Stop speaking"
                        >
                          <StopCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCopyMessage(msg.content, msg.id)}
                    className="h-7 w-7 p-0 hover:bg-muted"
                    aria-label="Copy message"
                  >
                    {copiedMessageId === msg.id ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  {onRegenerate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRegenerate(msg.id)}
                      className="h-7 w-7 p-0 hover:bg-muted"
                      aria-label="Regenerate response"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFeedback(msg.id, 1)}
                    className={`h-7 w-7 p-0 ${
                      feedback[msg.id] === 1
                        ? "bg-green-100 text-green-600"
                        : "hover:bg-muted"
                    }`}
                    aria-label="Thumbs up"
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFeedback(msg.id, -1)}
                    className={`h-7 w-7 p-0 ${
                      feedback[msg.id] === -1
                        ? "bg-red-100 text-red-600"
                        : "hover:bg-muted"
                    }`}
                    aria-label="Thumbs down"
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEvaluate(msg.id)}
                    className="h-7 w-7 p-0 hover:bg-muted"
                    aria-label="Detailed evaluation"
                  >
                    <Star className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            {/* Deep Research Menu - Only show for deep research results */}
            {msg.role === "assistant" && isDeepResearchResult(msg.content) && (
              <div className="flex justify-start mt-2 w-full">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-auto p-1">
                    <DropdownMenuItem
                      onClick={() => onEmailResearch(msg.content)}
                      className="cursor-pointer p-2"
                      title="Email this research"
                    >
                      <Mail className="w-4 h-4" />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDownloadResearch(msg.content)}
                      className="cursor-pointer p-2"
                      title="Download as Markdown"
                    >
                      <Download className="w-4 h-4" />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onCopyMessage(msg.content, msg.id)}
                      className="cursor-pointer p-2"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-4 h-4" />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
