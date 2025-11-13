import { useState } from 'react';

/**
 * Hook for managing A/B testing session state.
 * Handles session tagging for analytics and model comparison.
 * Note: Actual logging is handled in the parent component.
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
