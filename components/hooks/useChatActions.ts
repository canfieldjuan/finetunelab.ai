import { useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { log } from '../../lib/utils/logger';
import type { Message } from '../chat/types';
import type { Citation } from "@/lib/graphrag/service";
import type { User } from '@supabase/supabase-js';
import type { ContextTracker } from '../../lib/context/context-tracker';
import type { ContextUsage } from '@/lib/context/types';

/**
 * Options for the useChatActions hook.
 */
interface UseChatActionsOptions {
  /** The current user. */
  user: User | null;
  /** The active conversation ID. */
  activeId: string;
  /** Current messages array. */
  messages: Message[];
  /** Function to update messages. */
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  /** Function to set error state. */
  setError: (error: string | null) => void;
  /** Function to set loading state. */
  setLoading: (loading: boolean) => void;
  /** Function to set abort controller. */
  setAbortController: (controller: AbortController | null) => void;
  /** The available tools. */
  tools: Array<Record<string, unknown>>;
  /** Whether deep research is enabled. */
  enableDeepResearch: boolean;
  /** The selected model ID. */
  selectedModelId: string;
  /** A ref to the context tracker. */
  contextTrackerRef: React.MutableRefObject<ContextTracker | null>;
  /** A function to set the context usage. */
  setContextUsage: (usage: ContextUsage | null) => void;
}

/**
 * A hook for managing chat actions (sending messages, handling responses, etc.)
 * This is the actions-only portion split from the original useChat hook.
 *
 * @param options - The options for the hook
 * @returns Chat actions
 */
export function useChatActions({
  user,
  activeId,
  messages,
  setMessages,
  setError,
  setLoading,
  setAbortController,
  tools,
  enableDeepResearch,
  selectedModelId,
  contextTrackerRef,
  setContextUsage,
}: UseChatActionsOptions) {

  const saveMessageToDatabase = useCallback(async (
    assistantMessage: string,
    modelId: string | null,
    provider: string | null,
    streamLatencyMs: number,
    userMessage: string,
    modelName?: string | null
  ) => {
    if (!user) return null;

    const estimatedOutputTokens = Math.ceil(assistantMessage.length / 4);
    const estimatedInputTokens = Math.ceil(userMessage.length / 4);

    // Create metadata object for persistence (matching server-side implementation)
    const messageMetadata = modelId && modelName && provider ? {
      model_name: modelName,
      provider: provider,
      model_id: modelId,
      timestamp: new Date().toISOString()
    } : undefined;

    const { data: aiMsg, error: dbError } = await supabase
      .from("messages")
      .insert({
        conversation_id: activeId,
        user_id: user.id,
        role: "assistant",
        content: assistantMessage,
        model_id: modelId,
        provider: provider,
        latency_ms: streamLatencyMs,
        input_tokens: estimatedInputTokens,
        output_tokens: estimatedOutputTokens,
        ...(messageMetadata && { metadata: messageMetadata })
      })
      .select()
      .single();

    if (dbError) {
      log.error('Chat', 'Failed to save message', { error: dbError });
    }

    return aiMsg;
  }, [user, activeId]);

  const streamAndProcessResponse = useCallback(async (
    response: Response,
    tempMessageId: string,
    userMessage: string
  ) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = "";
    let graphragCitations: Citation[] | undefined;
    let graphragContextsUsed: number | undefined;
    // Detailed GraphRAG retrieval analytics
    let graphragUsed: boolean | undefined;
    let graphragNodes: number | undefined;
    let graphragChunks: number | undefined;
    let graphragRetrievalMs: number | undefined;
    let graphragRelevance: number | undefined;
    let graphragGrounded: boolean | undefined;
    let graphragMethod: string | undefined;
    let modelId: string | null = null;
    let provider: string | null = null;
    let modelName: string | null = null;
    let updateThrottle: NodeJS.Timeout | null = null;
    const THROTTLE_MS = 500;

    const updateMessageThrottled = () => {
      if (updateThrottle) clearTimeout(updateThrottle);
      updateThrottle = setTimeout(() => {
        setMessages((prevMessages) =>
          prevMessages.map((m) =>
            m.id === tempMessageId
              ? {
                  ...m,
                  content: assistantMessage,
                  citations: graphragCitations,
                  contextsUsed: graphragContextsUsed,
                  graphrag_used: graphragUsed,
                  graphrag_nodes: graphragNodes,
                  graphrag_chunks: graphragChunks,
                  graphrag_retrieval_ms: graphragRetrievalMs,
                  graphrag_relevance: graphragRelevance,
                  graphrag_grounded: graphragGrounded,
                  graphrag_method: graphragMethod,
                }
              : m
          )
        );
      }, THROTTLE_MS);
    };

    if (reader) {
      streamLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) break streamLoop;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break streamLoop;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === "graphrag_metadata") {
              console.log('[useChatActions] Received graphrag_metadata:', parsed);
              graphragCitations = parsed.citations;
              graphragContextsUsed = parsed.contextsUsed;
              // Capture detailed GraphRAG retrieval analytics
              graphragUsed = parsed.graphrag_used;
              graphragNodes = parsed.graphrag_nodes;
              graphragChunks = parsed.graphrag_chunks;
              graphragRetrievalMs = parsed.graphrag_retrieval_ms;
              graphragRelevance = parsed.graphrag_relevance;
              graphragGrounded = parsed.graphrag_grounded;
              graphragMethod = parsed.graphrag_method;
              setMessages((prevMessages) =>
                prevMessages.map((m) =>
                  m.id === tempMessageId
                    ? {
                        ...m,
                        citations: graphragCitations,
                        contextsUsed: graphragContextsUsed,
                        graphrag_used: graphragUsed,
                        graphrag_nodes: graphragNodes,
                        graphrag_chunks: graphragChunks,
                        graphrag_retrieval_ms: graphragRetrievalMs,
                        graphrag_relevance: graphragRelevance,
                        graphrag_grounded: graphragGrounded,
                        graphrag_method: graphragMethod,
                      }
                    : m
                )
              );
            }

            if (parsed.content) {
              assistantMessage += parsed.content;
              updateMessageThrottled();
            }

            if (parsed.type === "model_metadata") {
              modelId = parsed.model_id;
              provider = parsed.provider;
              modelName = parsed.model_name;
            }

            if (parsed.type === "token_usage" && contextTrackerRef.current) {
              const inputTokens = parsed.input_tokens || 0;
              const outputTokens = parsed.output_tokens || 0;
              const graphragTokens = parsed.graphrag_tokens || 0;
              const updatedUsage = contextTrackerRef.current.addMessage(inputTokens, outputTokens, graphragTokens);
              setContextUsage(updatedUsage);

              const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedModelId);
              if (selectedModelId !== '__default__' && activeId && isValidUUID) {
                const activeContext = contextTrackerRef.current.getModelContext(selectedModelId === '__default__' ? null : selectedModelId);
                if (activeContext) {
                  supabase.from('conversation_model_contexts').upsert(
                    {
                      conversation_id: activeId,
                      model_id: selectedModelId,
                      total_tokens: activeContext.totalTokens,
                      input_tokens: activeContext.inputTokens,
                      output_tokens: activeContext.outputTokens,
                      graphrag_tokens: activeContext.graphragTokens,
                      message_count: activeContext.messageCount,
                      first_message_at: activeContext.firstMessageAt?.toISOString(),
                      last_message_at: activeContext.lastMessageAt?.toISOString(),
                    },
                    { onConflict: 'conversation_id,model_id' }
                  ).then(({ error }) => {
                    if (error) {
                      log.error('Chat', 'Error saving context', {
                        error,
                        modelId: selectedModelId,
                        conversationId: activeId,
                        errorCode: error.code,
                        errorMessage: error.message,
                        errorDetails: error.details,
                        errorHint: error.hint
                      });
                    }
                  });
                }
              }
            }
          } catch (err) {
            log.warn('Chat', 'Skipping invalid JSON chunk', { error: err });
          }
        }
      }
    }

    if (updateThrottle) {
      clearTimeout(updateThrottle);
    }

    const streamLatencyMs = Date.now() - ((response as Response & { startTime?: number }).startTime ?? Date.now());
    const aiMsg = await saveMessageToDatabase(assistantMessage, modelId, provider, streamLatencyMs, userMessage, modelName);

    if (aiMsg) {
      setMessages((prevMessages) =>
        prevMessages.map((m) =>
          m.id === tempMessageId
            ? {
                ...aiMsg,
                citations: graphragCitations,
                contextsUsed: graphragContextsUsed,
                graphrag_used: graphragUsed,
                graphrag_nodes: graphragNodes,
                graphrag_chunks: graphragChunks,
                graphrag_retrieval_ms: graphragRetrievalMs,
                graphrag_relevance: graphragRelevance,
                graphrag_grounded: graphragGrounded,
                graphrag_method: graphragMethod,
              }
            : m
        )
      );
    }
  }, [saveMessageToDatabase, setMessages, contextTrackerRef, setContextUsage, selectedModelId, activeId]);

  const prepareAndSendMessage = useCallback(async (input: string) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    const userMessage = input;
    const { data: msgData } = await supabase
      .from("messages")
      .insert({
        conversation_id: activeId,
        user_id: user.id,
        role: "user",
        content: userMessage
      })
      .select()
      .single();

    if (msgData) {
      setMessages((prevMessages) => [...prevMessages, msgData]);
    }

    if (messages.length === 0 && msgData) {
      await supabase
        .from("conversations")
        .update({
          title: userMessage.slice(0, 50) + (userMessage.length > 50 ? "..." : "")
        })
        .eq("id", activeId);
    }

    const conversationMessages = [...messages, msgData].map((m) => ({
      role: m.role,
      content: m.content
    }));

    const modifiedTools = tools.map(tool => {
      const toolFn = tool.function as { name: string; description: string } | undefined;
      if (toolFn?.name === 'web_search') {
        let description = toolFn.description;
        description += ' IMPORTANT: Always set summarize=true for enhanced results.';
        if (enableDeepResearch) {
          description += ' IMPORTANT: Deep research mode is ON - you MUST set deepResearchConfirmed=true.';
        }
        return { ...tool, function: { ...toolFn, description } };
      }
      return tool;
    });

    return { conversationMessages, modifiedTools, userMessage };
  }, [user, activeId, messages, setMessages, tools, enableDeepResearch]);

  const handleSendMessage = useCallback(async (input: string) => {
    if (!input.trim()) {
      setError("Please enter a message");
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const { conversationMessages, modifiedTools, userMessage } = await prepareAndSendMessage(input);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationMessages,
          tools: modifiedTools,
          conversationId: activeId,
          modelId: selectedModelId === '__default__' ? null : selectedModelId
        }),
        signal: controller.signal
      });

      (response as Response & { startTime?: number }).startTime = Date.now();

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get AI response");
      }

      const tempMessageId = `temp-${Date.now()}`;
      setMessages((prevMessages) => [
        ...prevMessages,
        { id: tempMessageId, role: "assistant", content: "" } as Message
      ]);

      await streamAndProcessResponse(response, tempMessageId, userMessage);
    } catch (error: unknown) {
      if ((error as Error).name === "AbortError") {
        log.info('Chat', 'Request aborted by user');
      } else {
        log.error('Chat', 'Error sending message', { error });
        setError((error as Error).message || "Failed to send message");
      }
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  }, [
    setError,
    setLoading,
    setAbortController,
    prepareAndSendMessage,
    streamAndProcessResponse,
    activeId,
    selectedModelId,
    setMessages
  ]);

  return {
    handleSendMessage,
  };
}
