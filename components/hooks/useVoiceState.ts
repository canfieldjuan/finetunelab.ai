import { useState } from 'react';

/**
 * Hook for managing Text-to-Speech state.
 * Tracks selected voice, auto-speak, and currently speaking message.
 */
export function useVoiceState() {
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | undefined>();
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  return {
    selectedVoiceURI,
    setSelectedVoiceURI,
    autoSpeakEnabled,
    setAutoSpeakEnabled,
    speakingMessageId,
    setSpeakingMessageId,
  };
}
