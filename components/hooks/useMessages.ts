import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { log } from '../../lib/utils/logger';
import type { Message } from '../chat/types';

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
  validateMultiple?: (data: any[]) => any
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
          const processedMessages = data.map(msg => {
            if (msg.content && msg.content.length > 50000) {
              return {
                ...msg,
                content: msg.content.substring(0, 50000) + '\n\n... [Message truncated due to size. Original length: ' + msg.content.length + ' characters]'
              };
            }
            return msg;
          });

          const conversationData = {
            id: activeId,
            user_id: userId,
            created_at: new Date().toISOString(),
            messages: processedMessages.map(msg => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              metadata: msg.metadata,
              content_json: msg.content_json,
              tools_called: msg.tools_called,
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
      } catch (err: any) {
        setError(err.message);
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
      } catch (err: any) {
        log.error('useMessages', 'Error fetching feedback', { error: err });
      }
    };

    fetchMessages();
    fetchFeedback();

    return () => {
      cancelled = true;
    };
  }, [userId, activeId, connectionError, setConnectionError, validateMultiple]);

  return { messages, setMessages, error, feedback, setFeedback };
}
