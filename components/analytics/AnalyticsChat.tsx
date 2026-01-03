// Analytics Chat component - Chat for analyzing tagged sessions
"use client";
import React, { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { ArrowLeft, Square, Search, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '../layout/AppSidebar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

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
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-mini");
  const [uploadingValidationSet, setUploadingValidationSet] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Store messages per session (session_id-experiment_name -> Message[])
  const sessionMessagesRef = useRef<Map<string, Message[]>>(new Map());

  // Available models for analytics
  const analyticsModels = [
    { id: "gpt-4o-mini", name: "GPT-4o Mini", cost: "$" },
    { id: "gpt-4o", name: "GPT-4o", cost: "$$$$" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", cost: "$$$" },
    { id: "grok-beta", name: "Grok Beta", cost: "$$" },
  ];

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
      console.log('[AnalyticsChat] Full grouped sessions array:', groupedSessions);

      // Log each session's conversation IDs for debugging
      groupedSessions.forEach((session, index) => {
        console.log(`[AnalyticsChat] Session ${index + 1}:`, {
          session_id: session.session_id,
          experiment_name: session.experiment_name,
          conversation_count: session.conversation_count,
          conversation_ids: session.conversation_ids,
        });
        // Validate UUIDs
        const invalidIds = session.conversation_ids.filter(id =>
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        );
        if (invalidIds.length > 0) {
          console.error(`[AnalyticsChat] Session ${index + 1} has invalid UUIDs:`, invalidIds);
        }
      });

      console.log('[AnalyticsChat] About to call setSessions with', groupedSessions.length, 'sessions');
      setSessions(groupedSessions);
      console.log('[AnalyticsChat] setSessions called successfully');
    };

    fetchSessions();
  }, [user]);

  // Log when sessions state changes
  useEffect(() => {
    console.log('[AnalyticsChat] Sessions state updated. Count:', sessions.length);
    console.log('[AnalyticsChat] Sessions state value:', sessions);
  }, [sessions]);

  // Save messages to session storage whenever they change
  useEffect(() => {
    if (selectedSession && messages.length > 0) {
      const sessionKey = `${selectedSession.session_id}-${selectedSession.experiment_name}`;
      sessionMessagesRef.current.set(sessionKey, messages);
      console.log(`[AnalyticsChat] Auto-saved ${messages.length} messages for session:`, sessionKey);
    }
  }, [messages, selectedSession]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Filter sessions based on search query
  const filteredSessions = React.useMemo(() => {
    console.log('[AnalyticsChat] Computing filteredSessions. Sessions count:', sessions.length, 'Search query:', searchQuery);

    if (!searchQuery.trim()) {
      console.log('[AnalyticsChat] No search query, returning all sessions:', sessions.length);
      return sessions;
    }

    const query = searchQuery.toLowerCase();
    const filtered = sessions.filter(s =>
      s.experiment_name.toLowerCase().includes(query) ||
      s.session_id.toLowerCase().includes(query)
    );

    console.log('[AnalyticsChat] Filtered sessions count:', filtered.length);
    return filtered;
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

  const handleValidationSetUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('[AnalyticsChat] Uploading validation set:', file.name);
    setUploadingValidationSet(true);
    setError(null);

    try {
      // Read file content
      const fileContent = await file.text();
      const validationSet = JSON.parse(fileContent);

      // Validate structure
      if (!validationSet.name || !validationSet.test_cases || !Array.isArray(validationSet.test_cases)) {
        throw new Error('Invalid validation set format. Must include "name" and "test_cases" array.');
      }

      // Upload to API
      const response = await fetch('/api/validation-sets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validationSet),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload validation set');
      }

      const data = await response.json();
      console.log('[AnalyticsChat] Validation set uploaded:', data.id);

      // Add success message to chat
      setMessages(prev => [...prev, {
        id: `system-${Date.now()}`,
        role: 'assistant',
        content: `✅ Validation set "${validationSet.name}" uploaded successfully!\n\n${validationSet.test_cases.length} test cases loaded.\n\nYou can now ask me to compare session responses to this validation set.`
      }]);

    } catch (error) {
      console.error('[AnalyticsChat] Error uploading validation set:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to upload validation set: ${errorMessage}`);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ Error uploading validation set: ${errorMessage}\n\nPlease ensure your JSON file has the correct format:\n\`\`\`json\n{\n  "name": "My Validation Set",\n  "description": "Optional description",\n  "test_cases": [\n    {\n      "prompt": "Test prompt",\n      "expected_response": "Expected answer",\n      "keywords_required": ["keyword1", "keyword2"]\n    }\n  ]\n}\n\`\`\``
      }]);
    } finally {
      setUploadingValidationSet(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
      console.log('[AnalyticsChat] Selected session:', selectedSession);
      console.log('[AnalyticsChat] Request payload:', {
        sessionId: selectedSession?.session_id || 'no-session',
        experimentName: selectedSession?.experiment_name || 'General Analysis',
        conversationIds: selectedSession?.conversation_ids || [],
        messageCount: conversationMessages.length,
        model_id: selectedModel
      });

      // Detailed validation of conversation IDs (only if session is selected)
      if (selectedSession && selectedSession.conversation_ids.length > 0) {
        console.log('[AnalyticsChat] Conversation IDs details:');
        selectedSession.conversation_ids.forEach((id: string, index: number) => {
          const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
          console.log(`  [${index}]: "${id}" - ${isValidUUID ? '✅ valid UUID' : '❌ INVALID UUID'} (type: ${typeof id}, length: ${id?.length})`);
        });
      } else {
        console.log('[AnalyticsChat] No session selected - assistant will use list_available_sessions tool');
      }

      const response = await fetch('/api/analytics/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        signal: abortController.signal,
        body: JSON.stringify({
          messages: conversationMessages,
          sessionId: selectedSession?.session_id || 'no-session',
          experimentName: selectedSession?.experiment_name || 'General Analysis',
          conversationIds: selectedSession?.conversation_ids || [],
          model_id: selectedModel, // Pass selected model to API
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
        <div className="flex flex-col gap-3">
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
          <nav className="space-y-2">
            {(() => {
              console.log('[AnalyticsChat] Rendering sessions list. filteredSessions.length:', filteredSessions.length);
              console.log('[AnalyticsChat] First 3 sessions:', filteredSessions.slice(0, 3));
              return null;
            })()}

            {filteredSessions.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchQuery ? 'No sessions found' : 'No tagged sessions yet'}
              </div>
            )}

            {filteredSessions.map((s, index) => {
              console.log(`[AnalyticsChat] Rendering session ${index + 1}/${filteredSessions.length}:`, s.experiment_name);
              return (
              <div
                key={`${s.session_id}-${s.experiment_name}`}
                onClick={() => {
                  // Save current session's messages before switching
                  if (selectedSession) {
                    const currentKey = `${selectedSession.session_id}-${selectedSession.experiment_name}`;
                    sessionMessagesRef.current.set(currentKey, messages);
                    console.log(`[AnalyticsChat] Saved ${messages.length} messages for session:`, currentKey);
                  }

                  // Load messages for the new session
                  const newKey = `${s.session_id}-${s.experiment_name}`;
                  const savedMessages = sessionMessagesRef.current.get(newKey) || [];
                  console.log(`[AnalyticsChat] Loading ${savedMessages.length} messages for session:`, newKey);

                  setSelectedSession(s);
                  setMessages(savedMessages);
                }}
                className={`p-2.5 rounded-lg cursor-pointer transition-colors overflow-hidden ${
                  selectedSession?.session_id === s.session_id &&
                  selectedSession?.experiment_name === s.experiment_name
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-accent'
                }`}
              >
                <div className="font-medium text-sm truncate mb-1">
                  {s.experiment_name}
                </div>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-xs opacity-80 truncate flex-shrink">#{s.session_id}</span>
                  <span className="text-xs opacity-80 whitespace-nowrap flex-shrink-0">
                    {s.conversation_count}
                  </span>
                </div>
              </div>
            );
            })}
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

            {/* Model Selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Model:</span>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {analyticsModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center justify-between w-full gap-3">
                        <span>{model.name}</span>
                        <span className="text-muted-foreground text-xs">{model.cost}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleValidationSetUpload}
                className="hidden"
              />

              {/* Upload validation set button - far left */}
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="icon"
                disabled={loading || uploadingValidationSet}
                className="min-h-[44px] min-w-[44px] shrink-0"
                title="Upload validation set (JSON)"
              >
                {uploadingValidationSet ? (
                  <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </Button>

              <div className="flex-1">
                <Input
                  value={input}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                  placeholder={selectedSession ? "Ask about metrics, evaluations, or performance..." : "Ask about your sessions, metrics, or performance..."}
                  disabled={loading}
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
                  disabled={!input.trim()}
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
