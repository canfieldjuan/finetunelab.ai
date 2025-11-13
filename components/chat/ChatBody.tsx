import React from 'react';
import { MessageList } from './MessageList';
import type { Message } from './types';

interface ChatBodyProps {
  messages: Message[];
  loading: boolean;
  error: string | null;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  handleFeedback: (messageId: string, value: number) => void;
  handleCopyMessage: (content: string, messageId: string) => void;
  handleToggleTTS: (messageId: string, content: string) => void;
  handleStopTTS: () => void;
  handleEmailResearch: (content: string) => void;
  handleDownloadResearch: (content: string) => void;
  isDeepResearchResult: (content: string) => boolean;
  speakingMessageId: string | null;
  isSpeaking: boolean;
  isPaused: boolean;
  copiedMessageId: string | null;
  feedback: { [key: string]: number };
  onEvaluateMessage: (messageId: string) => void;
  ttsSupported: boolean;
  ttsEnabled: boolean;
}

export function ChatBody({ 
  messages, 
  loading, 
  error, 
  messagesContainerRef, 
  messagesEndRef, 
  handleFeedback,
  handleCopyMessage,
  handleToggleTTS,
  handleStopTTS,
  handleEmailResearch,
  handleDownloadResearch,
  isDeepResearchResult,
  speakingMessageId,
  isSpeaking,
  isPaused,
  copiedMessageId,
  feedback,
  onEvaluateMessage,
  ttsSupported,
  ttsEnabled
}: ChatBodyProps) {
  return (
    <div
      ref={messagesContainerRef}
      className={`flex-1 ${
        messages.length > 0 || loading || error
          ? "overflow-y-auto"
          : "overflow-hidden"
      }`}
    >
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        {loading && messages.length === 0 && (
          <div className="flex justify-center items-center py-8">
            <div className="flex items-center space-x-3 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin"></div>
              <span>Loading...</span>
            </div>
          </div>
        )}
        <MessageList
          messages={messages}
          feedback={feedback}
          copiedMessageId={copiedMessageId}
          speakingMessageId={speakingMessageId}
          isSpeaking={isSpeaking}
          isPaused={isPaused}
          ttsSupported={ttsSupported}
          ttsEnabled={ttsEnabled}
          onCopyMessage={handleCopyMessage}
          onFeedback={handleFeedback}
          onToggleTTS={handleToggleTTS}
          onStopTTS={handleStopTTS}
          onEvaluate={onEvaluateMessage}
          onEmailResearch={handleEmailResearch}
          onDownloadResearch={handleDownloadResearch}
          isDeepResearchResult={isDeepResearchResult}
        />
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
