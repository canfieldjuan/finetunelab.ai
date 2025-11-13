import { useState, useRef } from 'react';
import type { Message } from '../chat/types';

/**
 * A hook for managing chat state (input, messages, loading, errors, etc.)
 * This is the state-only portion split from the original useChat hook.
 *
 * @returns Chat state and setters
 */
export function useChatState() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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
  };
}
