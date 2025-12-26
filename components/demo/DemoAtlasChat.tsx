'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  Loader2,
  Sparkles,
  BarChart3,
  Clock,
  Search,
  Zap,
  AlertCircle,
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface DemoAtlasChatProps {
  sessionId: string;
  modelName?: string;
  onExportRequest?: () => void;
}

const SUGGESTED_QUESTIONS = [
  { label: 'Summary', question: "What's my success rate and average latency?", icon: BarChart3 },
  { label: 'Slowest', question: 'Which prompts were slowest?', icon: Clock },
  { label: 'P95 Latency', question: "What's my p95 latency?", icon: Zap },
  { label: 'Errors', question: 'Show me any failed requests', icon: AlertCircle },
];

export function DemoAtlasChat({ sessionId, modelName, onExportRequest }: DemoAtlasChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Send initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `Hi! I can help you analyze your batch test results for ${modelName || 'your model'}.\n\nTry asking me about your success rate, latency percentiles, or which prompts performed best or worst. What would you like to know?`,
        },
      ]);
    }
  }, [modelName, messages.length]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    // Prepare conversation history (exclude the greeting)
    const conversationHistory = messages.length > 0
      ? messages.slice(1).concat(userMessage)
      : [userMessage];

    try {
      const response = await fetch('/api/demo/v2/atlas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          messages: conversationHistory.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get response');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let assistantMessage = '';

      // Add placeholder assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantMessage += parsed.content;
                // Update the last message (assistant message)
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: assistantMessage,
                  };
                  return updated;
                });
              }
            } catch {
              // Skip non-JSON lines
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      // Remove the empty assistant message if error occurred
      setMessages(prev => {
        if (prev[prev.length - 1]?.role === 'assistant' && prev[prev.length - 1]?.content === '') {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto flex flex-col h-[600px]">
      <CardHeader className="flex-none border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Results Analysis
          </CardTitle>
          {modelName && (
            <Badge variant="outline" className="text-xs">
              {modelName}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                  {message.content || (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking...
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Error message */}
          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 max-w-[85%]">
                <p className="font-medium">Error</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length <= 1 && !isLoading && (
          <div className="flex-none px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map(({ label, question, icon: Icon }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestedQuestion(question)}
                  className="text-xs h-8"
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex-none border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about your test results..."
                className="pl-9"
                disabled={isLoading}
              />
            </div>
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          {/* Export hint */}
          {messages.length > 2 && onExportRequest && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Ready to download your results?{' '}
              <button
                onClick={onExportRequest}
                className="text-primary hover:underline"
              >
                Export now
              </button>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default DemoAtlasChat;
