import { useState } from 'react';

/**
 * Hook for managing A/B testing session state (UI state only).
 * Handles session tagging for analytics and model comparison.
 *
 * NOTE: This state is synced from the active conversation in Chat.tsx.
 * When activeId changes, the Chat component reads session_id and experiment_name
 * from the conversations array and updates this state via setSessionId/setExperimentName.
 *
 * Actual database persistence is handled in useConversationActions.handleSessionChange().
 */
export function useSessionState() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [experimentName, setExperimentName] = useState<string | null>(null);

  return {
    sessionId,
    setSessionId,
    experimentName,
    setExperimentName,
  };
}
