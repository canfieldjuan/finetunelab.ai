// Chat UI component for MVP chat portal
"use client";
import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "../contexts/AuthContext";
import { logSessionEvent } from "../lib/sessionLogs";
import { supabase } from "../lib/supabaseClient";
import { useTools } from '../hooks/useTools';
import { Database, Paperclip, CheckCircle, MoreVertical, Trash2, Download, Archive, Settings, LogOut, Plus, Star, BarChart3, Square } from 'lucide-react';
import Link from 'next/link';
import { useDocuments } from '../hooks/useDocuments';
import { DocumentUpload } from './graphrag/DocumentUpload';
import { DocumentList } from './graphrag/DocumentList';
import { GraphRAGIndicator } from './graphrag/GraphRAGIndicator';
import { ExportDialog } from './export/ExportDialog';
import { ArchiveManager } from './export/ArchiveManager';
import { useArchive } from '../hooks/useArchive';
import { EvaluationModal } from './evaluation/EvaluationModal';
import { ModelSelector } from './models/ModelSelector';
import { SessionManager } from './chat/SessionManager';

interface Citation {
  source: string;
  content: string;
  confidence: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  contextsUsed?: number;
  tools_called?: Array<{name: string; success: boolean; error?: string}>;
  input_tokens?: number;
  output_tokens?: number;
  latency_ms?: number;
}

interface SidebarConversation {
  id: string;
  title: string;
  in_knowledge_graph?: boolean;
  neo4j_episode_id?: string;
  promoted_at?: string;
  graphrag_enabled?: boolean;
}

export default function Chat() {
  const { user, signOut } = useAuth();
  const { getToolsForOpenAI } = useTools();
  const { documents, refetch: refetchDocuments } = useDocuments({
    userId: user?.id || '',
    autoFetch: !!user
  });
  const [conversations, setConversations] = useState<SidebarConversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [feedback, setFeedback] = useState<{[key: string]: number}>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showArchiveManager, setShowArchiveManager] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showEvaluationModal, setShowEvaluationModal] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined);
  const [currentSession, setCurrentSession] = useState<{
    sessionId: string | null;
    experimentName: string | null;
  }>({ sessionId: null, experimentName: null });
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { archive } = useArchive();

  // Load conversations from database
  useEffect(() => {
    const fetchConversations = async () => {
      console.log('[Chat] fetchConversations - user:', user?.email);
      if (!user) {
        console.warn('[Chat] No user found, cannot fetch conversations');
        setDebugInfo(`No user authenticated. User object: ${JSON.stringify(user)}`);
        return;
      }
      
      console.log('[Chat] Fetching conversations for user:', user.id);
      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, in_knowledge_graph, neo4j_episode_id, promoted_at, graphrag_enabled")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false});
      
      if (error) {
        console.error('[Chat] Error fetching conversations:', error);
        setError(`Failed to load conversations: ${error.message}`);
        setDebugInfo(`Supabase error: ${JSON.stringify(error)}`);
        return;
      }
      
      console.log('[Chat] Fetched conversations:', data?.length || 0, 'conversations');
      if (data && data.length > 0) {
        setConversations(data);
        if (!activeId) {
          setActiveId(data[0].id);
          console.log('[Chat] Set active conversation:', data[0].id);
        }
      } else {
        console.warn('[Chat] No conversations found for user');
        setDebugInfo(`No conversations found. User ID: ${user.id}`);
      }
    };
    fetchConversations();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  // NOTE: activeId is intentionally excluded to prevent infinite loop

  // Load messages for the selected conversation from Supabase
  useEffect(() => {
    if (!user || !activeId) {
      console.log('[Chat] Skipping message load - user:', !!user, 'activeId:', activeId);
      return;
    }
    
    console.log('[Chat] Loading messages for conversation:', activeId);
    
    // Load messages
    supabase
      .from("messages")
      .select("id, role, content, tools_called, input_tokens, output_tokens, latency_ms")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('[Chat] Error loading messages:', error);
          setError(`Failed to load messages: ${error.message}`);
          return;
        }
        console.log('[Chat] Loaded messages:', data?.length || 0);
        if (data) setMessages(data);
      });

    // Load feedback for this conversation
    supabase
      .from("feedback")
      .select("response_id, value")
      .eq("user_id", user.id)
      .eq("conversation_id", activeId)
      .then(({ data, error }) => {
        if (error) {
          console.error('[Chat] Error loading feedback:', error);
          return;
        }
        if (data) {
          const feedbackMap: {[key: string]: number} = {};
          data.forEach((item: {response_id: string, value: number}) => {
            feedbackMap[item.response_id] = item.value;
          });
          setFeedback(feedbackMap);
          console.log('[Chat] Loaded feedback:', data.length, 'items');
        }
      });
  }, [user, activeId]);

  // Clean up temp messages on mount (prevents zombie loading states)
  useEffect(() => {
    console.log('[Chat] Checking for temp messages on mount');
    setMessages((msgs) => {
      const tempMessages = msgs.filter(m => m.id.startsWith('temp-'));
      if (tempMessages.length > 0) {
        console.log('[Chat] Cleaned up', tempMessages.length, 'temp messages on mount');
        return msgs.filter(m => !m.id.startsWith('temp-'));
      }
      return msgs;
    });
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuId) setOpenMenuId(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Utility functions
  const handleFeedback = async (messageId: string, value: number) => {
    if (!user) return;
    
    try {
      // Update or insert feedback
      const { error } = await supabase
        .from("feedback")
        .upsert({
          user_id: user.id,
          conversation_id: activeId,
          response_id: messageId,
          value: value,
        });
      
      if (!error) {
        setFeedback(prev => ({ ...prev, [messageId]: value }));
        await logSessionEvent(user.id, "feedback_given", activeId);
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  };

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
    console.log('[Chat] Stop button clicked');

    // Abort the ongoing request
    if (abortControllerRef.current) {
      console.log('[Chat] Aborting request');
      abortControllerRef.current.abort(new Error('Request interrupted by user'));
      abortControllerRef.current = null;
    }

    // Clear the timeout
    if (timeoutRef.current) {
      console.log('[Chat] Clearing timeout');
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Stop loading state
    setLoading(false);

    // Remove temp messages
    setMessages((msgs) => {
      const filtered = msgs.filter(m => !m.id.startsWith('temp-'));
      console.log('[Chat] Removed temp messages, remaining:', filtered.length);
      return filtered;
    });

    // Show user-friendly message
    setError('[Request interrupted by user]');
    console.log('[Chat] Request stopped by user');
  };

  const handleSend = async () => {
    console.log('[Chat] handleSend called - input:', input.trim().substring(0, 20), 'user:', !!user, 'activeId:', activeId);
    
    if (!input.trim()) {
      console.warn('[Chat] Cannot send - empty input');
      setError('Please enter a message');
      return;
    }
    
    if (!user) {
      console.error('[Chat] Cannot send - no user authenticated');
      setError('You must be logged in to send messages');
      return;
    }
    
    if (!activeId) {
      console.error('[Chat] Cannot send - no active conversation');
      setError('Please create or select a conversation first');
      return;
    }
    
    setError(null);
    setLoading(true);

    // Create AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    console.log('[Chat] Created AbortController for request');

    // Set 30-second timeout
    const timeout = setTimeout(() => {
      console.log('[Chat] Request timeout reached (30s), auto-aborting');
      if (abortController) {
        abortController.abort(new Error('Request timed out after 30 seconds'));
      }
      setLoading(false);
      setError('[Request timed out after 30 seconds]');
      setMessages((msgs) => msgs.filter(m => !m.id.startsWith('temp-')));
    }, 30000);
    timeoutRef.current = timeout;
    console.log('[Chat] Set 30-second timeout');

    const userMessage = input;
    setInput("");
    
    // Insert user message into Supabase
    const { data: msgData } = await supabase
      .from("messages")
      .insert({
        conversation_id: activeId,
        user_id: user.id,
        role: "user",
        content: userMessage,
      })
      .select()
      .single();
    if (msgData) setMessages((msgs) => [...msgs, msgData]);
    
    // If this is the first user message, update conversation title
    if (messages.length === 0 && msgData) {
      await supabase
        .from("conversations")
        .update({ title: userMessage.slice(0, 50) + (userMessage.length > 50 ? "..." : "") })
        .eq("id", activeId);
    }

    // METRIC: Start timing for latency measurement
    const requestStartTime = Date.now();

    try {

      // Prepare messages for OpenAI API
      const conversationMessages = [...messages, msgData].map(m => ({
        role: m.role,
        content: m.content
      }));

      console.log('[Chat] Calling OpenAI API with', conversationMessages.length, 'messages');
      
      // Call streaming API
      const activeConversation = conversations.find(c => c.id === activeId);
      const graphragEnabled = activeConversation?.graphrag_enabled !== false;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
        body: JSON.stringify({
          messages: conversationMessages,
          tools: getToolsForOpenAI(),
          memory: { userId: user.id, graphragEnabled },
          modelId: selectedModelId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Chat] API error:', response.status, errorText);
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let graphragCitations: Citation[] | undefined;
      let graphragContextsUsed: number | undefined;
      // METRIC: Token usage tracking
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      // METRIC: Tool tracking
      let toolsCalled: Array<{name: string; success: boolean; error?: string}> | undefined;
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
              if (data === '[DONE]') {
                break;
              }
              try {
                const parsed = JSON.parse(data);

                // Capture GraphRAG metadata
                if (parsed.type === 'graphrag_metadata') {
                  graphragCitations = parsed.citations;
                  graphragContextsUsed = parsed.contextsUsed;
                  console.log('[Chat] Received GraphRAG metadata:', graphragContextsUsed, 'contexts');

                  // Update temp message with metadata immediately
                  setMessages((msgs) =>
                    msgs.map(m =>
                      m.id === tempMessageId
                        ? {
                            ...m,
                            citations: graphragCitations,
                            contextsUsed: graphragContextsUsed
                          }
                        : m
                    )
                  );
                }
                // METRIC: Capture token usage metadata
                else if (parsed.type === 'token_usage') {
                  inputTokens = parsed.input_tokens;
                  outputTokens = parsed.output_tokens;
                  console.log('[Chat] Token usage:', inputTokens, 'in,', outputTokens, 'out');
                }
                // METRIC: Capture tool tracking metadata
                else if (parsed.type === 'tools_metadata') {
                  toolsCalled = parsed.tools_called;
                  const successCount = toolsCalled?.filter(t => t.success).length || 0;
                  console.log('[Chat] Tools called:', toolsCalled?.length, 'total,', successCount, 'succeeded');

                  // Update temp message with tool metadata immediately
                  setMessages((msgs) =>
                    msgs.map(m =>
                      m.id === tempMessageId
                        ? {
                            ...m,
                            tools_called: toolsCalled
                          }
                        : m
                    )
                  );
                }
                // Process content chunks
                else if (parsed.content) {
                  assistantMessage += parsed.content;
                  // Update the temporary message with streaming content
                  setMessages((msgs) =>
                    msgs.map(m =>
                      m.id === tempMessageId
                        ? {
                            ...m,
                            content: assistantMessage,
                            citations: graphragCitations,
                            contextsUsed: graphragContextsUsed
                          }
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

      // METRIC: Calculate response latency
      const latencyMs = Date.now() - requestStartTime;
      console.log('[Chat] Response latency:', latencyMs, 'ms');

      // Save final assistant message to database
      const { data: aiMsg, error: insertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: activeId,
          user_id: user.id,
          role: "assistant",
          content: assistantMessage,
          ...(latencyMs && { latency_ms: latencyMs }),  // METRIC: Save latency (conditional)
          ...(inputTokens && { input_tokens: inputTokens }),  // METRIC: Save input tokens (conditional)
          ...(outputTokens && { output_tokens: outputTokens }),  // METRIC: Save output tokens (conditional)
          ...(toolsCalled && { tools_called: toolsCalled }),  // METRIC: Save tools called (conditional)
          ...(toolsCalled && { tool_success: toolsCalled.every(t => t.success) }),  // METRIC: Save tool success (conditional)
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Chat] Error saving message:', insertError);
      }

      // Replace temporary message with real one from database
      // Preserve GraphRAG metadata since it's not stored in DB
      if (aiMsg) {
        setMessages((msgs) =>
          msgs.map(m =>
            m.id === tempMessageId
              ? {
                  ...aiMsg,
                  citations: graphragCitations,
                  contextsUsed: graphragContextsUsed,
                  // Ensure tool data is included from database
                  tools_called: aiMsg.tools_called,
                  input_tokens: aiMsg.input_tokens,
                  output_tokens: aiMsg.output_tokens,
                  latency_ms: aiMsg.latency_ms
                }
              : m
          )
        );

        // Trigger evaluation for structured output domains
        // Only evaluate if we have GraphRAG citations (company_expert domain)
        if (graphragCitations && graphragCitations.length > 0) {
          fetch('/api/evaluate-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messageId: aiMsg.id,
              domain: 'company_expert',
              retrievedSources: graphragCitations.map(c => ({ text: c.content })),
            }),
          })
            .then(res => res.json())
            .then(result => {
              if (result.success) {
                console.log('[Chat] Evaluation completed:', result.validationResults?.length, 'validators ran');
              } else {
                console.warn('[Chat] Evaluation failed:', result.errors);
              }
            })
            .catch(err => {
              console.error('[Chat] Evaluation error:', err);
            });
        }
      }
    } catch (error) {
      console.error("[Chat] Error getting AI response:", error);

      // Handle abort errors (user clicked stop or timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[Chat] Request was aborted (user stopped or timeout)');
        // Clean up temp messages
        setMessages((msgs) => msgs.filter(m => !m.id.startsWith('temp-')));
        // Don't show error if already shown by handleStop or timeout
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      // METRIC: Categorize error type for analysis
      let errorType = 'unknown_error';
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('timeout') || msg.includes('timed out')) {
          errorType = 'timeout';
        } else if (msg.includes('rate limit') || msg.includes('429')) {
          errorType = 'rate_limit';
        } else if (msg.includes('context length') || msg.includes('token limit') || msg.includes('too long')) {
          errorType = 'context_length';
        } else if (msg.includes('api') || msg.includes('500') || msg.includes('503')) {
          errorType = 'api_error';
        } else if (msg.includes('network') || msg.includes('fetch')) {
          errorType = 'network_error';
        }
      }
      console.log('[Chat] Error type:', errorType);

      // METRIC: Capture error latency
      const errorLatency = Date.now() - requestStartTime;

      // METRIC: Save error message to database for analysis
      try {
        await supabase
          .from("messages")
          .insert({
            conversation_id: activeId,
            user_id: user.id,
            role: "assistant",
            content: `[ERROR] ${errorMessage}`,
            latency_ms: errorLatency,
            error_type: errorType,
          })
          .select()
          .single();
        console.log('[Chat] Error message saved to database');
      } catch (dbError) {
        console.error('[Chat] Failed to save error message:', dbError);
      }

      setError(`Failed to get AI response: ${errorMessage}`);
      // Remove temporary message on error
      setMessages((msgs) => msgs.filter(m => !m.id.startsWith('temp-')));
    }

    // Clear timeout and abort controller refs
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current = null;
    }

    setLoading(false);
  };

  const handlePromoteConversation = async (conversationId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('[Chat] Promoting conversation:', conversationId);

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      if (!authToken) {
        throw new Error('No auth token available');
      }

      const response = await fetch('/api/conversations/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ conversationId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to promote');
      }

      const result = await response.json();
      console.log('[Chat] Conversation promoted successfully:', result);

      setConversations(conversations.map(c =>
        c.id === conversationId
          ? { ...c, in_knowledge_graph: true, promoted_at: new Date().toISOString() }
          : c
      ));
    } catch (error) {
      console.error('[Chat] Promotion error:', error);
      setError(error instanceof Error ? error.message : 'Failed to promote conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveConversation = async (conversationId: string) => {
    if (!user) return;

    try {
      console.log('[Chat] Archiving conversation:', conversationId);

      // Archive using archive service
      await archive({
        conversationIds: [conversationId],
        permanentDelete: false
      });

      console.log('[Chat] Conversation archived successfully');

      // Remove from local state
      const updatedConversations = conversations.filter(c => c.id !== conversationId);
      setConversations(updatedConversations);

      // If we archived the active conversation, switch to another one
      if (activeId === conversationId) {
        if (updatedConversations.length > 0) {
          setActiveId(updatedConversations[0].id);
        } else {
          setActiveId('');
          setMessages([]);
        }
      }

      await logSessionEvent(user.id, 'conversation_archived', conversationId);
    } catch (error) {
      console.error('[Chat] Archive error:', error);
      setError(error instanceof Error ? error.message : 'Failed to archive conversation');
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!user) return;

    try {
      console.log('[Chat] Deleting conversation:', conversationId);

      // Delete from database
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (error) {
        throw new Error(error.message);
      }

      console.log('[Chat] Conversation deleted successfully');

      // Remove from local state
      const updatedConversations = conversations.filter(c => c.id !== conversationId);
      setConversations(updatedConversations);

      // If we deleted the active conversation, switch to another one
      if (activeId === conversationId) {
        if (updatedConversations.length > 0) {
          setActiveId(updatedConversations[0].id);
        } else {
          setActiveId('');
          setMessages([]);
        }
      }

      await logSessionEvent(user.id, 'conversation_deleted', conversationId);
    } catch (error) {
      console.error('[Chat] Delete error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete conversation');
    }
  };

  const handleToggleGraphRAG = async (conversationId: string) => {
    if (!user) return;

    try {
      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) return;

      const newValue = !conversation.graphrag_enabled;
      console.log('[Chat] Toggling GraphRAG for conversation:', conversationId, 'to:', newValue);

      const { error } = await supabase
        .from('conversations')
        .update({ graphrag_enabled: newValue })
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (error) {
        throw new Error(error.message);
      }

      setConversations(conversations.map(c =>
        c.id === conversationId ? { ...c, graphrag_enabled: newValue } : c
      ));

      // Log event (non-critical, don't throw on failure)
      logSessionEvent(user.id, 'graphrag_toggled', conversationId).catch(err =>
        console.warn('[Chat] Failed to log session event:', err)
      );
    } catch (error) {
      console.error('[Chat] GraphRAG toggle error:', error);
      setError(error instanceof Error ? error.message : 'Failed to toggle GraphRAG');
    }
  };

  // Conversation selection and creation UI
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Error Banner */}
      {error && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b border-red-200 p-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
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
      
      {/* Debug Info Banner */}
      {debugInfo && !error && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-50 border-b border-blue-200 p-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🐛</span>
              <p className="text-sm text-blue-800">{debugInfo}</p>
            </div>
            <button
              onClick={() => setDebugInfo("")}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* Sidebar */}
      <aside className="w-64 bg-secondary border-r flex flex-col p-4">
        <div className="mb-6">
          <Button
            onClick={async () => {
              console.log('[Chat] New Chat clicked - user:', !!user);
              if (!user) {
                console.error('[Chat] Cannot create conversation - no user');
                setError('You must be logged in to create a conversation');
                return;
              }

              // Prevent creating new chat if current conversation is empty
              if (activeId && messages.length === 0) {
                console.warn('[Chat] Cannot create new chat - current conversation is empty');
                setError('Please send a message in the current conversation before creating a new one');
                return;
              }

              try {
                console.log('[Chat] Creating new conversation for user:', user.id);
                console.log('[Chat] Current session:', currentSession.sessionId, currentSession.experimentName);
                // Create conversation in database
                const { data, error } = await supabase
                  .from("conversations")
                  .insert({
                    user_id: user.id,
                    title: "New Chat",
                    session_id: currentSession.sessionId,
                    experiment_name: currentSession.experimentName
                  })
                  .select()
                  .single();

                if (error) {
                  console.error('[Chat] Error creating conversation:', error);
                  setError(`Failed to create conversation: ${error.message}`);
                  return;
                }

                if (data) {
                  console.log('[Chat] Successfully created conversation:', data.id);
                  setConversations([data, ...conversations]);
                  setActiveId(data.id);
                  setError(null);
                  await logSessionEvent(user.id, "conversation_created", data.id);
                }
              } catch (err) {
                console.error('[Chat] Unexpected error creating conversation:', err);
                setError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
              }
            }}
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
          >
            <span className="text-xs">New Chat</span>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="mb-2">
          <span className="text-sm text-muted-foreground">Conversations</span>
        </div>
        <nav className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group relative p-2 rounded cursor-pointer mb-1 ${activeId === conv.id ? "bg-accent" : "hover:bg-muted"}`}
            >
              <div onClick={() => setActiveId(conv.id)}>
                <div className="flex items-center justify-between">
                  <span className="truncate flex-1">{conv.title}</span>
                  {conv.in_knowledge_graph && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded ml-2">
                      Graph
                    </span>
                  )}
                </div>
              </div>
              {/* Three-dot menu */}
              <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === conv.id ? null : conv.id);
                  }}
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 hover:bg-muted"
                  title="Options"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
                {/* Dropdown menu */}
                {openMenuId === conv.id && (
                  <div className="absolute right-0 mt-1 w-48 bg-background border rounded-lg shadow-lg z-10">
                    {!conv.in_knowledge_graph && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePromoteConversation(conv.id);
                          setOpenMenuId(null);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2 rounded-t-lg"
                      >
                        <Database className="w-4 h-4" />
                        <span>Add to KGraph</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchiveConversation(conv.id);
                        setOpenMenuId(null);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2"
                    >
                      <Archive className="w-4 h-4" />
                      <span>Archive</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                        setOpenMenuId(null);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-destructive/10 text-destructive flex items-center gap-2 rounded-b-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </nav>

        {/* User Settings Section */}
        {user && (
          <div className="relative mt-auto pt-4 border-t">
            {/* Settings Dropdown (appears above) */}
            {showUserSettings && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-background border rounded-lg shadow-lg z-20">
                <button
                  onClick={() => {
                    setShowArchiveManager(true);
                    setShowUserSettings(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3 rounded-t-lg"
                >
                  <Archive className="w-4 h-4" />
                  <span>Archived</span>
                </button>
                <Link href="/analytics" className="w-full">
                  <button
                    onClick={() => setShowUserSettings(false)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Analytics</span>
                  </button>
                </Link>
                <button
                  onClick={() => {
                    setShowExportDialog(true);
                    setShowUserSettings(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3"
                  disabled={!activeId}
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
                <button
                  onClick={() => {
                    setShowKnowledgeBase(true);
                    setShowUserSettings(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3"
                >
                  <Database className="w-4 h-4" />
                  <span className="flex items-center gap-2">
                    Knowledge
                    {documents.length > 0 && (
                      <span className="px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs font-semibold">
                        {documents.length}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  onClick={() => {
                    if (activeId) {
                      handleToggleGraphRAG(activeId);
                    }
                  }}
                  disabled={!activeId}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Database className="w-4 h-4" />
                  <span className="flex items-center justify-between flex-1">
                    <span>GraphRAG</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      conversations.find(c => c.id === activeId)?.graphrag_enabled !== false
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {conversations.find(c => c.id === activeId)?.graphrag_enabled !== false ? 'ON' : 'OFF'}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => {
                    signOut();
                    setShowUserSettings(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-destructive/10 text-destructive flex items-center gap-3 rounded-b-lg"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            )}

            {/* User Email with Settings Icon */}
            <button
              onClick={() => setShowUserSettings(!showUserSettings)}
              className="w-full flex items-center justify-between p-2 rounded hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Settings className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm truncate">{user.email}</span>
              </div>
              <span className="text-xs ml-2">▼</span>
            </button>
          </div>
        )}
      </aside>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Header */}
        <div className="bg-card border-b px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-card-foreground">MVP Chat Portal</h2>
              <SessionManager
                sessionId={currentSession.sessionId}
                experimentName={currentSession.experimentName}
                onSessionChange={(sessionId, experimentName) => {
                  console.log('[Chat] Session tagged:', sessionId, experimentName);
                  setCurrentSession({ sessionId, experimentName });
                }}
                onClearSession={() => {
                  console.log('[Chat] Session cleared');
                  setCurrentSession({ sessionId: null, experimentName: null });
                }}
                disabled={loading}
              />
            </div>
            <div className="flex items-center">
              <ModelSelector
                value={selectedModelId}
                onChange={setSelectedModelId}
                userId={user?.id}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
          <div className="min-h-full flex flex-col justify-end">
            <div className="space-y-4">
          {loading && (
            <div className="flex justify-center items-center py-8">
              <div className="flex items-center space-x-3 text-muted-foreground">
                <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin"></div>
                <span>Loading...</span>
              </div>
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No messages yet</h3>
              <p className="text-muted-foreground">Start the conversation by sending a message below.</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div
              key={msg.id + msg.role}
              className={`group relative mb-6 ${
                msg.role === "user" 
                  ? "flex justify-end" 
                  : "flex justify-start"
              }`}
            >
              <div className="flex flex-col items-end max-w-[80%]">
                <div className={
                  `rounded-2xl shadow-lg px-6 py-4 w-full ` +
                  (msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border text-card-foreground")
                }>
                  <div className="whitespace-pre-wrap break-words text-base">
                    {msg.content}
                  </div>
                  {/* GraphRAG Citation Display */}
                  {msg.role === "assistant" && (
                    <GraphRAGIndicator
                      citations={msg.citations}
                      contextsUsed={msg.contextsUsed}
                    />
                  )}
                  {/* Tool Execution Display */}
                  {msg.role === "assistant" && msg.tools_called && msg.tools_called.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-xs font-semibold text-gray-600 mb-2">🔧 Tools Used:</div>
                      <div className="space-y-1">
                        {msg.tools_called.map((tool, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span className={`px-2 py-0.5 rounded ${
                              tool.success
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {tool.success ? '✓' : '✗'}
                            </span>
                            <span className="font-mono">{tool.name}</span>
                            {tool.error && (
                              <span className="text-red-600 text-xs">- {tool.error}</span>
                            )}
                          </div>
                        ))}
                      </div>
                      {/* Token and latency metrics */}
                      {(msg.input_tokens || msg.output_tokens || msg.latency_ms) && (
                        <div className="mt-2 text-xs text-gray-500 flex gap-3">
                          {msg.latency_ms && <span>⏱️ {msg.latency_ms}ms</span>}
                          {msg.input_tokens && <span>📥 {msg.input_tokens} tokens</span>}
                          {msg.output_tokens && <span>📤 {msg.output_tokens} tokens</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Modern GPT-style: Buttons below, right-aligned, only for assistant */}
                {msg.role === "assistant" && (
                  <div className="flex justify-end mt-1 w-full">
                    <div className="flex items-center space-x-1">
                      {/* Copy button */}
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
                      {/* Thumbs up button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFeedback(msg.id, 1)}
                        className={`h-7 w-7 p-0 hover:bg-green-50 ${
                          feedback[msg.id] === 1 
                            ? "bg-green-100 text-green-600" 
                            : "hover:bg-gray-100"
                        }`}
                        aria-label="Thumbs up"
                      >
                        <span className="text-xs">👍</span>
                      </Button>
                      {/* Thumbs down button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFeedback(msg.id, -1)}
                        className={`h-7 w-7 p-0 hover:bg-red-50 ${
                          feedback[msg.id] === -1
                            ? "bg-red-100 text-red-600"
                            : "hover:bg-gray-100"
                        }`}
                        aria-label="Thumbs down"
                      >
                        <span className="text-xs">👎</span>
                      </Button>
                      {/* Rate button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowEvaluationModal(msg.id)}
                        className="h-7 w-7 p-0 hover:bg-yellow-50"
                        aria-label="Rate response"
                        title="Detailed rating"
                      >
                        <Star className="w-4 h-4 text-yellow-500" />
                      </Button>
                      {/* Feedback status */}
                      {feedback[msg.id] && (
                        <div className="text-xs text-gray-500 ml-2">
                          {feedback[msg.id] === 1 ? "Liked" : "Disliked"}
                        </div>
                      )}
                    </div>
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
          <div className="flex gap-3 items-end max-w-4xl mx-auto w-full">
            <Button
              onClick={() => setShowQuickUpload(true)}
              variant="ghost"
              size="sm"
              className="min-h-[44px] w-[44px] p-0"
              title="Upload document"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <Input
                value={input}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                placeholder="Type your message..."
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
          {/* GraphRAG Status Indicator */}
          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
            {documents.length > 0 ? (
              <>
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>GraphRAG enabled</span>
                <span>•</span>
                <span>{documents.length} {documents.length === 1 ? 'doc' : 'docs'} indexed</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3 h-3 text-muted-foreground" />
                <span>GraphRAG ready - no documents yet</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Knowledge Base Modal */}
      {showKnowledgeBase && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col m-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-foreground">Knowledge Base</h2>
              <Button
                onClick={() => setShowKnowledgeBase(false)}
                variant="ghost"
                size="sm"
              >
                ✕
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <DocumentUpload
                userId={user.id}
                onUploadComplete={() => refetchDocuments()}
              />
              <DocumentList userId={user.id} />
            </div>
          </div>
        </div>
      )}

      {/* Quick Upload Modal */}
      {showQuickUpload && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full m-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-foreground">Quick Upload</h3>
              <Button
                onClick={() => setShowQuickUpload(false)}
                variant="ghost"
                size="sm"
              >
                ✕
              </Button>
            </div>
            <div className="p-4">
              <DocumentUpload
                userId={user.id}
                onUploadComplete={() => {
                  refetchDocuments();
                  setShowQuickUpload(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && activeId && (
        <ExportDialog
          conversationIds={[activeId]}
          onClose={() => setShowExportDialog(false)}
          onSuccess={() => {
            setShowExportDialog(false);
          }}
        />
      )}

      {/* Archive Manager */}
      {showArchiveManager && (
        <ArchiveManager
          onClose={() => setShowArchiveManager(false)}
          onRestore={(conversationIds) => {
            // Refresh conversations list after restore
            if (user) {
              supabase
                .from("conversations")
                .select("id, title, in_knowledge_graph, neo4j_episode_id, promoted_at, graphrag_enabled")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .then(({ data }) => {
                  if (data) setConversations(data);
                });
            }
          }}
        />
      )}

      {/* Evaluation Modal */}
      {showEvaluationModal && (
        <EvaluationModal
          messageId={showEvaluationModal}
          onClose={() => setShowEvaluationModal(null)}
          onSuccess={() => {
            console.log('[Chat] Evaluation submitted successfully');
            setShowEvaluationModal(null);
          }}
        />
      )}
    </div>
  );
}
