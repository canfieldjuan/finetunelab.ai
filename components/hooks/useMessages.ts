import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { log } from '../../lib/utils/logger';
import type { Message } from '../chat/types';

interface ConversationData {
  id: string;
  user_id?: string;
  created_at?: string;
  messages?: Message[];
  title?: string;
  widget_session_id?: string;
  // Index signature for compatibility with conversation-validator types
  [key: string]: unknown;
}

interface ValidationResult {
  invalid: { conversation: ConversationData; result: unknown }[];
  summary: {
    averageHealthScore: number;
    totalCount?: number;
    validCount?: number;
    invalidCount?: number;
  };
  valid: ConversationData[];
}

/**
 * A hook for fetching messages for the active conversation.
 * @param userId - The ID of the current user.
 * @param activeId - The active conversation ID.
 * @param connectionError - Whether there is a connection error.
 * @param setConnectionError - A function to set the connection error.
 * @param validateMultiple - Optional function to validate conversation data.
 * @returns The messages, a function to update them, error, and feedback map.
 */
export function useMessages(
  userId: string | null,
  activeId: string,
  connectionError: boolean,
  setConnectionError: (error: boolean) => void,
  validateMultiple?: (data: ConversationData[]) => ValidationResult
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    let cancelled = false;

    if (!userId || !activeId) {
      return;
    }

    if (connectionError) {
      return;
    }

    const fetchMessages = async () => {
      try {
        const { data, error: msgError } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", activeId)
          .order("created_at", { ascending: false })
          .limit(200);

        if (cancelled) return;

        if (msgError) {
          const isNetworkError = msgError.message?.includes('Failed to fetch') || msgError.message?.includes('NetworkError') || !msgError.code;
          if (isNetworkError) {
            setConnectionError(true);
            setError('Unable to connect to database. Please check your connection and refresh the page.');
          } else {
            setError(`Failed to load messages: ${msgError.message || 'Unknown error'}`);
          }
          return;
        }

        if (data) {
          // Fetch model names for messages
          // Note: Messages store model_id which can be either UUID (llm_models.id) or string (model name)
          const modelIds = [...new Set(
            data
              .map((msg: Message) => msg.model_id)
              .filter((id): id is string => id != null)
          )];

          log.debug('useMessages', 'Fetching model names', {
            conversationId: activeId,
            uniqueModelIds: modelIds.length,
            sampleIds: modelIds.slice(0, 3),
          });

          const modelMap = new Map<string, { name: string; provider: string }>();
          
          if (modelIds.length > 0) {
            // Fetch from llm_models table matching by model_id
            // Messages store model_id directly (either UUID or string identifier)
            const { data: models, error: modelsError } = await supabase
              .from('llm_models')
              .select('id, name, model_id, provider')
              .in('model_id', modelIds);

            if (modelsError) {
              log.warn('useMessages', 'Failed to fetch model names from llm_models', {
                error: modelsError.message,
                query: 'OR query for id/model_id',
              });
            } else if (models && models.length > 0) {
              // Map by both UUID and model_id string for flexible lookup
              models.forEach(m => {
                const modelInfo = { name: m.name || m.model_id, provider: m.provider };
                modelMap.set(m.id, modelInfo);
                modelMap.set(m.model_id, modelInfo);
              });
              log.debug('useMessages', 'Fetched model names from llm_models', {
                modelCount: models.length,
                mapped: modelMap.size,
              });
            }
          }

          // Track enrichment stats for single log entry (avoid loop detection)
          let enrichedCount = 0;
          let fallbackCount = 0;

          const processedMessages = data.map((msg: Message) => {
            const enrichedMsg: Message = { ...msg };

            // PRIORITY 1: Use persisted metadata if available
            if (msg.metadata && typeof msg.metadata === 'object') {
              const meta = msg.metadata as {
                model_name?: string;
                provider?: string;
                graphrag?: {
                  graph_used?: boolean;
                  nodes_retrieved?: number;
                  context_chunks_used?: number;
                  retrieval_time_ms?: number;
                  context_relevance_score?: number;
                  answer_grounded_in_graph?: boolean;
                  retrieval_method?: string;
                };
              };
              if (meta.model_name) {
                enrichedMsg.model_name = meta.model_name;
                enrichedCount++;
                // Also use persisted provider if message provider field is missing
                if (!enrichedMsg.provider && meta.provider) {
                  enrichedMsg.provider = meta.provider;
                }

                // Extract GraphRAG metadata if available
                if (meta.graphrag) {
                  enrichedMsg.graphrag_used = meta.graphrag.graph_used;
                  enrichedMsg.graphrag_nodes = meta.graphrag.nodes_retrieved;
                  enrichedMsg.graphrag_chunks = meta.graphrag.context_chunks_used;
                  enrichedMsg.graphrag_retrieval_ms = meta.graphrag.retrieval_time_ms;
                  enrichedMsg.graphrag_relevance = meta.graphrag.context_relevance_score;
                  enrichedMsg.graphrag_grounded = meta.graphrag.answer_grounded_in_graph;
                  enrichedMsg.graphrag_method = meta.graphrag.retrieval_method;
                }

                // Apply content truncation if needed
                if (msg.content && msg.content.length > 50000) {
                  enrichedMsg.content = msg.content.substring(0, 50000) + '\n\n... [Message truncated due to size. Original length: ' + msg.content.length + ' characters]';
                }

                return enrichedMsg;
              }
            }

            // PRIORITY 2: Try to get model name from llm_models lookup (for old messages)
            const modelInfo = msg.model_id ? modelMap.get(msg.model_id) : null;

            if (modelInfo?.name) {
              // Found in llm_models table
              enrichedMsg.model_name = modelInfo.name;
              enrichedCount++;
            } else if (msg.model_id) {
              // PRIORITY 3: Fallback - use model_id directly as display name
              enrichedMsg.model_name = msg.model_id;
              fallbackCount++;
            }

            if (msg.content && msg.content.length > 50000) {
              enrichedMsg.content = msg.content.substring(0, 50000) + '\n\n... [Message truncated due to size. Original length: ' + msg.content.length + ' characters]';
            }

            return enrichedMsg;
          });

          // Log enrichment summary once (not per message to avoid loop detection)
          if (enrichedCount > 0 || fallbackCount > 0) {
            log.debug('useMessages', 'Model name enrichment complete', {
              totalMessages: processedMessages.length,
              enrichedFromDB: enrichedCount,
              usedFallback: fallbackCount,
              notEnriched: processedMessages.length - enrichedCount - fallbackCount,
            });
          }

          const conversationData: ConversationData = {
            id: activeId,
            user_id: userId,
            created_at: new Date().toISOString(),
            messages: processedMessages.map((msg: Message) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              metadata: msg.metadata,
              content_json: msg.content_json,
              tools_called: msg.tools_called,
              // Include all metadata fields for MessageMetadata component
              model_id: msg.model_id,
              model_name: msg.model_name,
              provider: msg.provider,
              input_tokens: msg.input_tokens,
              output_tokens: msg.output_tokens,
              latency_ms: msg.latency_ms,
            })),
          };

          // Validate messages if validation function provided
          let finalMessages = processedMessages;
          if (validateMultiple) {
            const validationResult = validateMultiple([conversationData]);

            if (validationResult.invalid.length > 0) {
              log.error('useMessages', 'Messages failed validation', {
                conversationId: activeId,
                invalidCount: validationResult.invalid.length,
                summary: validationResult.summary,
              });

              // Show error if health score is too low
              if (validationResult.summary.averageHealthScore < 30) {
                setError('This conversation contains corrupted data and cannot be displayed safely. Please archive it and start a new conversation.');
                return;
              }
            }

            // Use validated messages if available
            finalMessages = validationResult.valid.length > 0
              ? validationResult.valid[0].messages || processedMessages
              : processedMessages;
          }

          setMessages([...finalMessages].reverse());
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred while fetching messages.');
        }
      }
    };

    const fetchFeedback = async () => {
      try {
        const { data, error: feedbackError } = await supabase
          .from("feedback")
          .select("response_id, value")
          .eq("user_id", userId)
          .eq("conversation_id", activeId);

        if (feedbackError) {
          const isNetworkError = feedbackError.message?.includes('Failed to fetch') ||
                                 feedbackError.message?.includes('NetworkError') ||
                                 !feedbackError.code;

          if (isNetworkError && !connectionError) {
            log.error('useMessages', 'Network error loading feedback', { error: feedbackError });
            setConnectionError(true);
          } else if (!isNetworkError) {
            log.error('useMessages', 'Error loading feedback', { error: feedbackError });
          }
          return;
        }

        if (data && !cancelled) {
          const feedbackMap: { [key: string]: number } = {};
          data.forEach((item: { response_id: string; value: number }) => {
            feedbackMap[item.response_id] = item.value;
          });
          setFeedback(feedbackMap);
        }
      } catch (err: unknown) {
        log.error('useMessages', 'Error fetching feedback', { error: err });
      }
    };

    fetchMessages();
    fetchFeedback();

    return () => {
      cancelled = true;
    };
    // Note: validateMultiple is intentionally not in deps to prevent infinite loop
    // It's stable enough for our use case and only used for validation, not data fetching
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activeId, connectionError, setConnectionError]);

  return { messages, setMessages, error, feedback, setFeedback };
}
