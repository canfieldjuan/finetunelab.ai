'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageContent } from './MessageContent';
import { GraphRAGIndicator } from '../graphrag/GraphRAGIndicator';
import { MessageMetadata } from './MessageMetadata';
import { MessageJudgments } from './MessageJudgments';
import {
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
  RefreshCw
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
