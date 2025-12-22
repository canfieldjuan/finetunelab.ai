
import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { log } from '../../lib/utils/logger';
import type { Message } from '../chat/types';
import type { Citation } from "@/lib/graphrag/service";
import type { User } from '@supabase/supabase-js';
import type { ContextTracker } from '../../lib/context/context-tracker';
import type { ContextUsage } from '@/lib/context/types';
import type { ResearchProgress, ActiveResearchJob } from './useResearchState';


interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * Options for the useChat hook.
 */
interface UseChatOptions {
  /** The current user. */
  user: User | null;
  /** The active conversation ID. */
  activeId: string;
  /** The available tools. */
  tools: Tool[];
  /** Whether deep research is enabled. */
  enableDeepResearch: boolean;
  /** The selected model ID. */
  selectedModelId: string;
  /** A ref to the context tracker. */
  contextTrackerRef: React.MutableRefObject<ContextTracker | null>;
  /** A function to set the context usage. */
  setContextUsage: (usage: ContextUsage | null) => void;
  /** Ref to track if currently streaming (prevents effect loops). */
  isStreamingRef: React.MutableRefObject<boolean>;
  /** Research progress state for deep research. */
  researchProgress: ResearchProgress | null;
  /** Setter for research progress. */
  setResearchProgress: (progress: ResearchProgress | null) => void;
  /** Active research job for SSE streaming. */
  activeResearchJob: ActiveResearchJob | null;
  /** Setter for active research job. */
  setActiveResearchJob: (job: ActiveResearchJob | null) => void;
  /** Whether context injection is enabled for this conversation. */
  contextInjectionEnabled: boolean;
  /** Whether thinking mode is enabled (for Qwen3 and similar models with <think> tags). */
  enableThinking?: boolean;
  /** Allow anonymous (demo/widget) usage without auth/DB writes. */
  allowAnonymous?: boolean;
  /** Optional widget config for API auth in widget mode. */
  widgetConfig?: { sessionId: string; modelId: string; apiKey: string; userId?: string; theme?: string } | null;
}

/**
 * A hook for managing the chat state and actions.
 * @param options - The options for the hook.
 * @returns The chat state and actions.
 */
export function useChat({ user, activeId, tools, enableDeepResearch, selectedModelId, contextTrackerRef, setContextUsage, isStreamingRef, researchProgress, setResearchProgress, setActiveResearchJob, contextInjectionEnabled, enableThinking, allowAnonymous, widgetConfig }: UseChatOptions) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastScrolledMessagesLength = useRef<number>(0);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end"
      });
    });
  }, []);

  useEffect(() => {
    // Only scroll if messages actually changed (new message added) and not currently streaming
    if (!isStreamingRef.current && messages.length > 0 && messages.length !== lastScrolledMessagesLength.current) {
      lastScrolledMessagesLength.current = messages.length;
      scrollToBottom();
    }
  }, [messages, scrollToBottom, isStreamingRef]);

  const streamAndProcessResponse = async (response: Response, tempMessageId: string, userMessage: string, streamStartTime: number, updateThrottle: NodeJS.Timeout | null) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = "";
    let graphragCitations: Citation[] | undefined;
    let graphragContextsUsed: number | undefined;
    let modelId: string | null = null;
    let provider: string | null = null;
    let modelName: string | null = null;
    let deepResearchDetected = false; // Track if we've already detected deep research to avoid repeated regex
    // Actual token counts from API (will be populated by token_usage event)
    let actualInputTokens: number | null = null;
    let actualOutputTokens: number | null = null;
    const THROTTLE_MS = 500;

    const updateMessageThrottled = () => {
      if (updateThrottle) clearTimeout(updateThrottle);
      updateThrottle = setTimeout(() => {
        setMessages((msgs) =>
          msgs.map((m) =>
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
      }, THROTTLE_MS);
    };

    if (reader) {
      log.debug('useChat', 'Starting stream read');
      streamLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) {
          log.debug('useChat', 'Stream done', { totalMessageLength: assistantMessage.length });
          break streamLoop;
        }
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") {
            log.debug('useChat', 'Received [DONE] marker');
            break streamLoop;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "graphrag_metadata") {
              graphragCitations = parsed.citations;
              graphragContextsUsed = parsed.contextsUsed;

              // Note: graphrag_tokens will come in token_usage event, not here
              log.debug('useChat', 'GraphRAG metadata received', {
                citationsCount: graphragCitations?.length || 0,
                contextsUsed: graphragContextsUsed || 0
              });

              // Don't update state immediately - will be batched with next content update
              // This prevents extra re-renders during streaming
            }
            if (parsed.content) {
              assistantMessage += parsed.content;
              log.trace('useChat', 'Received content chunk', { totalLength: assistantMessage.length });
              // [UI_FREEZE_FIX] Use throttled update instead of immediate
              updateMessageThrottled();

              // Detect deep research start (only check once to avoid blocking main thread with repeated regex)
              if (!deepResearchDetected && assistantMessage.includes("deep_research_started")) {
                deepResearchDetected = true;
                const jobIdMatch = assistantMessage.match(/jobId['":\s]+([a-f0-9-]+)/i);
                const queryMatch = assistantMessage.match(/for\s+["']([^"']+)["']|query['":\s]+["']([^"']+)["']/i);
                if (jobIdMatch) {
                  const jobId = jobIdMatch[1];
                  const query = queryMatch ? (queryMatch[1] || queryMatch[2] || 'Research Query') : 'Research Query';
                  log.debug('useChat', 'Deep research started', { jobId, query });

                  // Set legacy research progress (for backward compatibility)
                  setResearchProgress({
                    jobId,
                    status: 'running',
                    currentStep: 'Starting research...',
                    totalSteps: 4,
                    completedSteps: 0
                  });

                  // Set structured research job (v2 with SSE streaming)
                  setActiveResearchJob({
                    jobId,
                    query
                  });
                }
              }
            }

            // OBSERVABILITY: Handle server-side research progress events
            if (parsed.type === "research_progress") {
              log.debug('useChat', 'Research progress event', { event: parsed });

              // If a research job was initiated server-side, ensure the SSE viewer is activated.
              // This avoids relying on the model echoing magic strings in assistant content.
              if (!deepResearchDetected && parsed.status === 'started' && parsed.jobId) {
                deepResearchDetected = true;
                const jobId = String(parsed.jobId);
                const query = typeof parsed.query === 'string' && parsed.query.trim().length > 0
                  ? parsed.query
                  : 'Research Query';
                setActiveResearchJob({ jobId, query });
              }

              setResearchProgress({
                jobId: parsed.jobId || researchProgress?.jobId || 'unknown',
                status: parsed.status || 'running',
                currentStep: parsed.currentStep || researchProgress?.currentStep || 'In progress...',
                totalSteps: parsed.totalSteps || researchProgress?.totalSteps || 4,
                completedSteps: parsed.completedSteps ?? researchProgress?.completedSteps ?? 0,
              });
            }

            // Phase 3: progressive per-document summaries (previews before final answer)
            if (parsed.type === "doc_summary") {
              const title = parsed.title || 'Document';
              const url = parsed.url || '';
              const summary = parsed.summary || '';
              const line = `\n• ${title}${url ? ` (${url})` : ''}\n   ${summary}\n`;
              assistantMessage += line;
              updateMessageThrottled();
            }

            if (parsed.type === "model_metadata") {
              modelId = parsed.model_id;
              provider = parsed.provider;
              modelName = parsed.model_name;
            }

            if (parsed.type === "tool_call") {
              const toolInfo = `\n\n🔧 Using tool: ${parsed.tool_name}\n`;
              assistantMessage += toolInfo;
              // [UI_FREEZE_FIX] Use throttled update instead of immediate
              updateMessageThrottled();
            }

            if (parsed.type === "tool_result") {
              const resultInfo = `📊 Result: ${JSON.stringify(
                parsed.result
              )}\n\n`;
              assistantMessage += resultInfo;
              // [UI_FREEZE_FIX] Use throttled update instead of immediate
              updateMessageThrottled();
            }

            // Capture token usage for context tracking AND message persistence
            if (parsed.type === "token_usage") {
              const inputTokens = parsed.input_tokens || 0;
              const outputTokens = parsed.output_tokens || 0;
              const graphragTokens = parsed.graphrag_tokens || 0;

              // Store actual token counts for message persistence
              actualInputTokens = inputTokens;
              actualOutputTokens = outputTokens;

              log.debug('useChat', 'Token usage received', {
                input: inputTokens,
                output: outputTokens,
                graphrag: graphragTokens
              });

              // Update context tracker if available
              if (contextTrackerRef.current) {
                const updatedUsage = contextTrackerRef.current.addMessage(
                  inputTokens,
                  outputTokens,
                  graphragTokens
                );
                setContextUsage(updatedUsage);

                // Save context to database using Supabase
                // Only save if there's a valid model UUID (not '__default__')
                // Validate that selectedModelId is a valid UUID format
                const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedModelId);

                if (selectedModelId !== '__default__' && activeId && isValidUUID) {
                  const activeContext = contextTrackerRef.current.getModelContext(
                    selectedModelId === '__default__' ? null : selectedModelId
                  );

                  if (activeContext) {
                    log.debug('useChat', 'Saving context for model', { modelId: selectedModelId });
                    supabase
                      .from('conversation_model_contexts')
                      .upsert({
                        conversation_id: activeId,
                        model_id: selectedModelId, // Use selectedModelId directly (it's a UUID)
                        total_tokens: activeContext.totalTokens,
                        input_tokens: activeContext.inputTokens,
                        output_tokens: activeContext.outputTokens,
                        graphrag_tokens: activeContext.graphragTokens,
                        message_count: activeContext.messageCount,
                        first_message_at: activeContext.firstMessageAt?.toISOString(),
                        last_message_at: activeContext.lastMessageAt?.toISOString(),
                      }, {
                        onConflict: 'conversation_id,model_id'
                      })
                      .then(({ error }) => {
                        if (error) {
                          // Properly serialize the error for logging
                          const errorDetails = {
                            modelId: selectedModelId,
                            conversationId: activeId,
                            code: error.code,
                            message: error.message,
                            details: error.details,
                            hint: error.hint,
                            errorString: String(error),
                            errorJson: JSON.stringify(error)
                          };
                          log.error('useChat', 'Error saving context', errorDetails);
                          console.error('[useChat] Full error object:', error);
                          console.error('[useChat] Context data attempted:', {
                            conversation_id: activeId,
                            model_id: selectedModelId,
                            total_tokens: activeContext.totalTokens,
                            input_tokens: activeContext.inputTokens,
                            output_tokens: activeContext.outputTokens,
                          });
                        } else {
                          log.debug('useChat', 'Context saved to database');
                        }
                      });
                  }
                } else {
                  if (selectedModelId !== '__default__' && !isValidUUID) {
                    log.warn('useChat', 'Skipping context save - invalid model UUID format', { modelId: selectedModelId });
                  } else {
                    log.debug('useChat', 'Skipping context save - no specific model selected (using __default__)');
                  }
                }
              }
            }
          } catch (err) {
            log.warn('useChat', 'Skipping invalid JSON chunk', { error: err });
          }
        }
      }
    }

    // Clear any pending throttled update
    if (updateThrottle) {
      clearTimeout(updateThrottle);
    }

    // [UI_FREEZE_FIX] Immediate final update (non-throttled) - show complete message right away
    setMessages((msgs) =>
      msgs.map((m) =>
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

    // Calculate stream latency using the streamStartTime parameter (not response.startTime)
    const streamLatencyMs = Date.now() - streamStartTime;
    log.debug('useChat', 'Stream completed, saving to database', {
      tempMessageId,
      assistantMessageLength: assistantMessage.length,
      streamLatencyMs
    });

    // [UI_FREEZE_FIX] Save message to database in background (non-blocking)
    // Use actual token counts from API if available, otherwise estimate from string length
    const estimatedInputTokens = Math.ceil(userMessage.length / 4);
    const estimatedOutputTokens = Math.ceil(assistantMessage.length / 4);
    const finalInputTokens = actualInputTokens ?? estimatedInputTokens;
    const finalOutputTokens = actualOutputTokens ?? estimatedOutputTokens;

    log.debug('useChat', 'Token counts for persistence', {
      actualInput: actualInputTokens,
      actualOutput: actualOutputTokens,
      estimatedInput: estimatedInputTokens,
      estimatedOutput: estimatedOutputTokens,
      usingActual: actualInputTokens !== null
    });

    // Create metadata object for persistence (matching server-side implementation)
    const messageMetadata = modelId && modelName && provider ? {
      model_name: modelName,
      provider: provider,
      model_id: modelId,
      timestamp: new Date().toISOString()
    } : undefined;

    if (user && activeId && !allowAnonymous) {
      void supabase
        .from('messages')
        .insert({
          conversation_id: activeId,
          user_id: user.id,
          role: 'assistant',
          content: assistantMessage,
          model_id: modelId,
          provider: provider,
          latency_ms: streamLatencyMs,
          input_tokens: finalInputTokens,
          output_tokens: finalOutputTokens,
          ...(messageMetadata && { metadata: messageMetadata })
        })
        .select()
        .single()
        .then(({ data: aiMsg, error: dbError }) => {
          if (dbError) {
            log.error('useChat', 'Failed to save message', { error: dbError });
          } else if (aiMsg) {
            log.debug('useChat', 'Message saved successfully', { messageId: aiMsg.id });
            // Replace temp message with real one from database
            setMessages((msgs) =>
              msgs.map((m) =>
                m.id === tempMessageId
                  ? { ...aiMsg, citations: graphragCitations, contextsUsed: graphragContextsUsed }
                  : m
              )
            );
            log.debug('useChat', 'Message updated with real ID', { realId: aiMsg.id, tempId: tempMessageId });
          }
        });
    }
  };

  const prepareAndSendMessage = async (input: string) => {
    if (!user && !allowAnonymous) {
      throw new Error('User not authenticated');
    }

    const userMessage = input;

    // [UI_FREEZE_FIX] Create optimistic user message immediately (non-blocking)
    const tempUserMessageId = `temp-user-${Date.now()}`;
    const optimisticUserMessage = {
      id: tempUserMessageId,
      conversation_id: activeId || 'temp',
      user_id: user?.id || 'anonymous',
      role: "user" as const,
      content: userMessage,
      created_at: new Date().toISOString()
    } as Message;

    // Add optimistic message to UI immediately using functional setState
    setMessages((msgs) => [...msgs, optimisticUserMessage]);

    // [UI_FREEZE_FIX] Save user message to database in background (non-blocking)
    // Don't await - let it complete in the background while UI stays responsive
    if (user && !allowAnonymous) {
      void supabase
        .from("messages")
        .insert({
          conversation_id: activeId,
          user_id: user.id,
          role: "user",
          content: userMessage
        })
        .select()
        .single()
        .then(({ data: realMsgData, error }) => {
          if (error) {
            log.error('useChat', 'Failed to save user message', { error });
          } else if (realMsgData) {
            // Replace temp message with real one from database
            setMessages((msgs) => msgs.map(m =>
              m.id === tempUserMessageId ? realMsgData : m
            ));

            // [UI_FREEZE_FIX] Update conversation title in background (non-blocking)
            if (messages.length === 0) {
              supabase
                .from("conversations")
                .update({
                  title: userMessage.slice(0, 50) + (userMessage.length > 50 ? "..." : "")
                })
                .eq("id", activeId)
                .then(({ error: titleError }) => {
                  if (titleError) {
                    log.error('useChat', 'Failed to update conversation title', { error: titleError });
                  }
                });
            }
          }
        });
    }

    // Use optimistic message for API call (will be replaced with real one when DB responds)
    const conversationMessages = [...messages, optimisticUserMessage].map((m) => ({ role: m.role, content: m.content }));
    const modifiedTools = tools.map(tool => {
      if (tool.function.name === 'web_search') {
        let description = tool.function.description;
        description += ' IMPORTANT: Always set summarize=true for enhanced results.';
        if (enableDeepResearch) {
          description += ' IMPORTANT: Deep research mode is ON - you MUST set deepResearchConfirmed=true.';
        }
        return { ...tool, function: { ...tool.function, description } };
      }
      return tool;
    });

    return { conversationMessages, modifiedTools, userMessage };
  };

  const handleSendMessage = async (input: string) => {
    log.debug('useChat', 'handleSendMessage called', {
      inputPreview: input.trim().substring(0, 20),
      hasUser: !!user,
      activeId
    });

    if (!input.trim()) {
      setError("Please enter a message");
      return;
    }

    if (!user && !allowAnonymous) {
      setError("You must be logged in to send messages");
      return;
    }

    if (!activeId && !allowAnonymous) {
      setError("Please create or select a conversation first");
      return;
    }

    setError(null);
    setLoading(true);
    setInput(""); // Clear input field immediately for better UX
    isStreamingRef.current = true; // Mark as streaming to prevent effect loops
    const controller = new AbortController();
    setAbortController(controller);

    // [UI_FREEZE_FIX] Declare throttle variable before try block so it's accessible in catch
    const updateThrottle: NodeJS.Timeout | null = null;

    try {
      const { conversationMessages, modifiedTools, userMessage } = await prepareAndSendMessage(input);

      log.debug('useChat', 'Calling OpenAI API', {
        messageCount: conversationMessages.length
      });

      // Track latency for analytics
      const streamStartTime = Date.now();

      // Sanitize header values to avoid non ISO-8859-1 code points in fetch headers
      const sanitizeHeaderValue = (val: string) => val.replace(/[^\x00-\xFF]/g, '');
      const rawApiKey = widgetConfig?.apiKey;
      const safeApiKey = typeof rawApiKey === 'string' ? sanitizeHeaderValue(rawApiKey) : undefined;
      if (rawApiKey && safeApiKey !== rawApiKey) {
        log.warn('useChat', 'Sanitized API key to remove non-Latin1 characters');
      }

      console.log('[useChat] ===== SENDING MESSAGE TO API =====');
      console.log('[useChat] contextInjectionEnabled:', contextInjectionEnabled);
      console.log('[useChat] typeof contextInjectionEnabled:', typeof contextInjectionEnabled);
      console.log('[useChat] enableDeepResearch:', enableDeepResearch);
      console.log('[useChat] enableThinking:', enableThinking);
      console.log('[useChat] tools count:', tools.length);
      console.log('[useChat] modifiedTools count:', modifiedTools.length);
      console.log('[useChat] modifiedTools:', modifiedTools.map(t => t.function?.name || 'unknown'));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(safeApiKey ? { "X-API-Key": safeApiKey } : {}),
        },
        body: JSON.stringify({
          messages: conversationMessages,
          tools: modifiedTools,
          conversationId: activeId || null,
          modelId: widgetConfig?.modelId || (selectedModelId === '__default__' ? null : selectedModelId),
          userId: user?.id || null,
          widgetSessionId: widgetConfig?.sessionId || null,
          enableDeepResearch,
          contextInjectionEnabled,
          enableThinking,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error('useChat', 'API error', { status: response.status, errorText });
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      const tempMessageId = "temp-" + Date.now();
      setMessages(prev => [...prev, { id: tempMessageId, role: "assistant", content: "" }]);
      await streamAndProcessResponse(response, tempMessageId, userMessage, streamStartTime, updateThrottle);

    } catch (err: unknown) {
      // [UI_FREEZE_FIX] Comprehensive error handling
      log.error('useChat', 'Error in handleSendMessage', {
        error: err,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        errorName: err instanceof Error ? err.name : 'Unknown',
        errorStack: err instanceof Error ? err.stack : undefined
      });

      // Set streaming ref to false to prevent stuck state
      isStreamingRef.current = false;

      // Remove any temp messages from UI (both user and assistant temp messages)
      setMessages((msgs) => msgs.filter(m => !m.id.startsWith('temp-')));

      // Set error message for user (skip AbortError as it's intentional)
      if (!(err instanceof Error) || err.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'An error occurred while processing your message');
      }

      // Scroll to show error state
      scrollToBottom();
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  const handleStop = () => {
    log.debug('useChat', 'Stopping message generation');
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setLoading(false);
    }
  };

  return {
    input,
    setInput,
    loading,
    setLoading,
    messages,
    setMessages,
    error,
    setError,
    abortController,
    setAbortController,
    messagesEndRef,
    messagesContainerRef,
    handleSendMessage,
    handleStop,
  };
}
