import { useState, useCallback } from 'react';

/**
 * Hook for managing message feedback and copy state.
 * Tracks thumbs up/down feedback and copied message indicators.
 * Note: Actual database operations and clipboard access handled in parent component.
 */
export function useFeedbackState() {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ [key: string]: number }>({});

  const handleCopyMessage = useCallback((messageId: string) => {
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  }, []);

  const handleFeedback = useCallback((messageId: string, value: number) => {
    setFeedback((prev) => ({ ...prev, [messageId]: value }));
  }, []);

  return {
    copiedMessageId,
    setCopiedMessageId,
    feedback,
    setFeedback,
    handleCopyMessage,
    handleFeedback,
  };
}
