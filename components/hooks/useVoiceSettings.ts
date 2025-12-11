
import { useState } from 'react';

export function useVoiceSettings() {
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
