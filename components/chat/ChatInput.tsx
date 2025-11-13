
import React from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Send, Mic, MicOff, StopCircle } from 'lucide-react';

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
  onStopListening 
}: ChatInputProps) {
  return (
    <div className="p-6 bg-background">
      <div className="relative max-w-4xl mx-auto">
        <Input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!loading) {
                onSend();
              }
            }
          }}
          placeholder="Type your message..."
          className="pr-24 pl-4 py-3 text-base rounded-full border-2 border-border focus-visible:ring-primary/50"
          disabled={loading}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
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
              disabled={!input.trim()}
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
