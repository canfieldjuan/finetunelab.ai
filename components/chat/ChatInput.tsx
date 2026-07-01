
import React, { useRef } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Paperclip, Send, Mic, MicOff, StopCircle } from 'lucide-react';
import { CHAT_ATTACHMENT_FILE_INPUT_ACCEPT } from '@/lib/chat/attachment-limits';
import { AttachmentChips } from './AttachmentChips';
import type { PendingChatAttachment } from './types';

interface ChatInputProps {
  input: string;
  loading: boolean;
  isListening: boolean;
  sttSupported: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  attachments?: PendingChatAttachment[];
  attachmentsDisabled?: boolean;
  sendDisabled?: boolean;
  onAddAttachments?: (files: File[]) => void;
  onRemoveAttachment?: (clientId: string) => void;
}

export function ChatInput({ 
  input, 
  loading, 
  isListening, 
  sttSupported, 
  onInputChange, 
  onSend, 
  onStop, 
  onStartListening, 
  onStopListening,
  attachments = [],
  attachmentsDisabled = false,
  sendDisabled,
  onAddAttachments,
  onRemoveAttachment,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const disabledSend = sendDisabled ?? !input.trim();

  return (
    <div className="p-6 bg-background">
      <div className="relative max-w-4xl mx-auto">
        {onAddAttachments && (
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={CHAT_ATTACHMENT_FILE_INPUT_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              onAddAttachments(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = '';
            }}
          />
        )}
        <AttachmentChips
          attachments={attachments}
          onRemove={onRemoveAttachment}
          className={attachments.length > 0 ? 'mb-2' : ''}
        />
        <Input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!loading && !disabledSend) {
                onSend();
              }
            }
          }}
          placeholder="Type your message..."
          className="pr-32 pl-4 py-3 text-base rounded-full border-2 border-border focus-visible:ring-primary/50"
          disabled={loading}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {onAddAttachments && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full text-muted-foreground hover:text-primary disabled:opacity-50"
              disabled={loading || attachmentsDisabled}
              title="Attach files"
              aria-label="Attach files"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
          )}
          {sttSupported && (
            <Button
              size="icon"
              variant="ghost"
              onClick={isListening ? onStopListening : onStartListening}
              className="rounded-full text-muted-foreground hover:text-primary disabled:opacity-50"
              disabled={loading}
              title={isListening ? "Stop listening" : "Start listening"}
            >
              {isListening ? (
                <Mic className="w-5 h-5 text-primary" />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
            </Button>
          )}
          {loading ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={onStop}
              className="rounded-full text-muted-foreground hover:text-destructive"
              title="Stop generation"
            >
              <StopCircle className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={onSend}
              className="rounded-full text-muted-foreground hover:text-primary disabled:opacity-50"
              disabled={disabledSend}
              title="Send message"
            >
              <Send className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
