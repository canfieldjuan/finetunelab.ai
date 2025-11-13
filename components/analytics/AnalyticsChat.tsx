// Analytics Chat component - Chat for analyzing tagged sessions
"use client";
import React, { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { ArrowLeft, Square, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '../layout/AppSidebar';

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface GroupedSession {
  session_id: string;
  experiment_name: string;
  conversation_count: number;
  conversation_ids: string[];
}

export function AnalyticsChat() {
  const { user, session, signOut } = useAuth();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<GroupedSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<GroupedSession | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch tagged sessions on mount
  useEffect(() => {
    const fetchSessions = async () => {
      if (!user) return;

      console.log('[AnalyticsChat] Fetching tagged sessions');

      const { data, error } = await supabase
        .from('conversations')
        .select('id, session_id, experiment_name')
        .eq('user_id', user.id)
        .not('session_id', 'is', null)
        .not('experiment_name', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[AnalyticsChat] Error fetching sessions:', error);
        setError('Failed to load sessions');
        return;
      }

      // Group by session_id and experiment_name
      const grouped = new Map<string, GroupedSession>();

      data?.forEach((conv) => {
        const key = `${conv.session_id}-${conv.experiment_name}`;

        if (grouped.has(key)) {
          const existing = grouped.get(key)!;
          existing.conversation_count++;
          existing.conversation_ids.push(conv.id);
        } else {
          grouped.set(key, {
            session_id: conv.session_id!,
            experiment_name: conv.experiment_name!,
            conversation_count: 1,
            conversation_ids: [conv.id]
          });
        }
      });

      const groupedSessions = Array.from(grouped.values());
      console.log('[AnalyticsChat] Grouped sessions:', groupedSessions.length);
      setSessions(groupedSessions);
    };

    fetchSessions();
  }, [user]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Filter sessions based on search query
  const filteredSessions = React.useMemo(() => {
    if (!searchQuery.trim()) return sessions;

    const query = searchQuery.toLowerCase();
    return sessions.filter(s =>
      s.experiment_name.toLowerCase().includes(query) ||
      s.session_id.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);

  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error("Failed to copy message:", error);
    }
  };

  const handleStop = () => {
    console.log('[AnalyticsChat] Stop button clicked');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(new Error('Request interrupted by user'));
      abortControllerRef.current = null;
    }
    setLoading(false);
    setMessages((msgs) => msgs.filter(m => !m.id.startsWith('temp-')));
    setError('[Request interrupted by user]');
  };

  const handleSend = async () => {
    console.log('[AnalyticsChat] handleSend called');

    if (!input.trim()) {
      setError('Please enter a message');
      return;
    }

    if (!user) {
      setError('You must be logged in to send messages');
      return;
    }

    if (!selectedSession) {
      setError('Please select a session to analyze');
      return;
    }

    setError(null);
    setLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMessage = input;
    setInput("");

    // Add user message to state
    const userMsg: Message = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: userMessage
    };
    setMessages((msgs) => [...msgs, userMsg]);

    try {
      // Prepare messages for API
      const conversationMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      console.log('[AnalyticsChat] Calling analytics chat API');

      const response = await fetch('/api/analytics/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        signal: abortController.signal,
        body: JSON.stringify({
          messages: conversationMessages,
          sessionId: selectedSession.session_id,
          experimentName: selectedSession.experiment_name,
          conversationIds: selectedSession.conversation_ids,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AnalyticsChat] API error:', response.status, errorText);
        throw new Error(`API request failed: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      const tempMessageId = 'temp-' + Date.now();

      // Add temporary message for streaming
      setMessages((msgs) => [...msgs, {
        id: tempMessageId,
        role: 'assistant',
        content: ''
      }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  assistantMessage += parsed.content;
                  setMessages((msgs) =>
                    msgs.map(m =>
                      m.id === tempMessageId
                        ? { ...m, content: assistantMessage }
                        : m
                    )
                  );
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Replace temp message with final one
      setMessages((msgs) =>
        msgs.map(m =>
          m.id === tempMessageId
            ? { ...m, id: 'assistant-' + Date.now() }
            : m
        )
      );

    } catch (error) {
      console.error("[AnalyticsChat] Error getting AI response:", error);

      if (error instanceof Error && error.name === 'AbortError') {
        setMessages((msgs) => msgs.filter(m => !m.id.startsWith('temp-')));
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Failed to get AI response: ${errorMessage}`);
      setMessages((msgs) => msgs.filter(m => !m.id.startsWith('temp-')));
    }

    if (abortControllerRef.current) {
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Error Banner */}
      {error && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b border-red-200 p-4">
          <div className="px-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-red-800">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* AppSidebar with Sessions List */}
      <AppSidebar currentPage="analytics" user={user} signOut={signOut}>
        <div className="h-full flex flex-col gap-3">
          <div>
            <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Tagged Sessions
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by ID or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Sessions List */}
          <nav className="flex-1 overflow-y-auto space-y-2">
            {filteredSessions.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchQuery ? 'No sessions found' : 'No tagged sessions yet'}
              </div>
            )}

            {filteredSessions.map((s) => (
              <div
                key={`${s.session_id}-${s.experiment_name}`}
                onClick={() => {
                  setSelectedSession(s);
                  setMessages([]); // Clear messages when switching sessions
                }}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedSession?.session_id === s.session_id &&
                  selectedSession?.experiment_name === s.experiment_name
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-accent'
                }`}
              >
                <div className="font-medium text-sm truncate">
                  {s.experiment_name}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs opacity-80">#{s.session_id}</span>
                  <span className="text-xs opacity-80">
                    {s.conversation_count} conversation{s.conversation_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </nav>
        </div>
      </AppSidebar>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-card border-b px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => router.push('/analytics')}
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">Analytics Assistant</h2>
                {selectedSession && (
                  <p className="text-sm text-muted-foreground">
                    Analyzing: {selectedSession.experiment_name} - #{selectedSession.session_id}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 w-full">
          <div className="min-h-full flex flex-col justify-end">
            {/* Centered column for messages */}
            <div className="max-w-4xl mx-auto w-full space-y-4">
              {loading && messages.length === 0 && (
                <div className="flex justify-center items-center py-8">
                  <div className="flex items-center space-x-3 text-muted-foreground">
                    <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin"></div>
                    <span>Loading...</span>
                  </div>
                </div>
              )}

              {!loading && messages.length === 0 && !selectedSession && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl">📊</span>
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Select a Session</h3>
                  <p className="text-muted-foreground">Choose a tagged session from the sidebar to start analyzing.</p>
                </div>
              )}

              {!loading && messages.length === 0 && selectedSession && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl">💬</span>
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Ready to Analyze</h3>
                  <p className="text-muted-foreground">
                    Ask questions about {selectedSession.experiment_name} ({selectedSession.conversation_count} conversation{selectedSession.conversation_count !== 1 ? 's' : ''})
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`group relative mb-6 ${
                    msg.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }`}
                >
                  <div className="flex flex-col items-end max-w-[80%]">
                    <div className={
                      msg.role === "user"
                        ? "rounded-2xl shadow-lg px-6 py-4 w-full bg-primary text-primary-foreground"
                        : "px-6 py-4 w-full text-card-foreground"
                    }>
                      <div className="whitespace-pre-wrap break-words text-base">
                        {msg.content}
                      </div>
                    </div>
                    {/* Copy button for assistant messages */}
                    {msg.role === "assistant" && (
                      <div className="flex justify-end mt-1 w-full">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyMessage(msg.content, msg.id)}
                          className="h-7 w-7 p-0 hover:bg-gray-100"
                          aria-label="Copy message"
                        >
                          {copiedMessageId === msg.id ? (
                            <span className="text-xs text-green-600">✓</span>
                          ) : (
                            <span className="text-xs">📋</span>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Input area */}
        <div className="border-t bg-card p-4">
          <div className="max-w-4xl mx-auto w-full">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Input
                  value={input}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                  placeholder={selectedSession ? "Ask about metrics, evaluations, or performance..." : "Select a session first..."}
                  disabled={loading || !selectedSession}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="min-h-[44px]"
                />
              </div>
              {loading ? (
                <Button
                  onClick={handleStop}
                  variant="destructive"
                  className="min-h-[44px] px-6"
                >
                  <div className="flex items-center space-x-2">
                    <Square className="w-4 h-4" />
                    <span>Stop</span>
                  </div>
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || !selectedSession}
                  className="min-h-[44px] px-6"
                >
                  Send
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
