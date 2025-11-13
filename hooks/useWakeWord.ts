/**
 * Wake Word Detection Hook
 * 
 * Integrates wake word detection with speech recognition
 * Enables hands-free "Hey Assistant" activation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';
import {
  WakeWordDetector,
  getWakeWordDetector,
  type WakeWordConfig,
  type WakeWordDetectionResult
} from '@/lib/voice/wakeWordDetector';

interface UseWakeWordOptions {
  /** Custom wake word configuration */
  config?: Partial<WakeWordConfig>;
  
  /** Callback when wake word is detected */
  onWakeWordDetected?: (result: WakeWordDetectionResult) => void;
  
  /** Auto-start listening on mount */
  autoStart?: boolean;
  
  /** Enable visual/audio feedback on detection */
  enableFeedback?: boolean;
}

interface UseWakeWordReturn {
  /** Whether wake word detection is active */
  isListening: boolean;
  
  /** Start listening for wake word */
  startListening: () => void;
  
  /** Stop listening for wake word */
  stopListening: () => void;
  
  /** Last detected wake word result */
  lastDetection: WakeWordDetectionResult | null;
  
  /** Current wake word configuration */
  config: WakeWordConfig;
  
  /** Update wake word configuration */
  updateConfig: (config: Partial<WakeWordConfig>) => void;
  
  /** Add custom wake word */
  addWakeWord: (wakeWord: string) => void;
  
  /** Remove wake word */
  removeWakeWord: (wakeWord: string) => void;
}

/**
 * Hook for wake word detection
 * 
 * Continuously listens for wake words like "Hey Assistant" and triggers activation
 * 
 * @example
 * ```tsx
 * const { isListening, startListening, lastDetection } = useWakeWord({
 *   onWakeWordDetected: (result) => {
 *     console.log('Wake word detected:', result.wakeWord);
 *     // Activate voice assistant, show UI, etc.
 *   },
 *   autoStart: true
 * });
 * ```
 */
export function useWakeWord(options: UseWakeWordOptions = {}): UseWakeWordReturn {
  const {
    config: userConfig,
    onWakeWordDetected,
    autoStart = false,
    enableFeedback = true
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [lastDetection, setLastDetection] = useState<WakeWordDetectionResult | null>(null);
  const detectorRef = useRef<WakeWordDetector | null>(null);

  // Initialize detector
  useEffect(() => {
    detectorRef.current = getWakeWordDetector(userConfig);
    
    return () => {
      detectorRef.current?.stop();
    };
  }, [userConfig]);

  // Handle wake word detection
  const handleDetection = useCallback((result: WakeWordDetectionResult) => {
    console.log('[WakeWord Hook] Wake word detected', result);
    setLastDetection(result);
    
    // Visual/audio feedback
    if (enableFeedback && typeof window !== 'undefined') {
      // Play a subtle beep or show visual indicator
      // You could integrate with TTS here to say "Yes?" or similar
      console.log('[WakeWord Hook] 🔔 Activation feedback');
    }
    
    // Notify callback
    onWakeWordDetected?.(result);
  }, [onWakeWordDetected, enableFeedback]);

  // Speech recognition for passive listening
  const { startListening: startSTT, stopListening: stopSTT } = useSpeechRecognition({
    onResult: (transcript, isFinal) => {
      if (isFinal && detectorRef.current) {
        detectorRef.current.processTranscript(transcript, isFinal);
      }
    },
    defaultOptions: {
      continuous: true,
      interimResults: false  // Only process final results for wake word
    }
  });

  // Start wake word detection
  const startListening = useCallback(() => {
    if (detectorRef.current && !isListening) {
      console.log('[WakeWord Hook] Starting wake word detection');
      detectorRef.current.start(handleDetection);
      startSTT();
      setIsListening(true);
    }
  }, [isListening, handleDetection, startSTT]);

  // Stop wake word detection
  const stopListening = useCallback(() => {
    if (detectorRef.current && isListening) {
      console.log('[WakeWord Hook] Stopping wake word detection');
      detectorRef.current.stop();
      stopSTT();
      setIsListening(false);
    }
  }, [isListening, stopSTT]);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart) {
      startListening();
    }
  }, [autoStart, startListening]);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<WakeWordConfig>) => {
    detectorRef.current?.updateConfig(newConfig);
  }, []);

  // Add custom wake word
  const addWakeWord = useCallback((wakeWord: string) => {
    detectorRef.current?.addWakeWord(wakeWord);
  }, []);

  // Remove wake word
  const removeWakeWord = useCallback((wakeWord: string) => {
    detectorRef.current?.removeWakeWord(wakeWord);
  }, []);

  // Get current config
  const config = detectorRef.current?.getConfig() || getWakeWordDetector().getConfig();

  return {
    isListening,
    startListening,
    stopListening,
    lastDetection,
    config,
    updateConfig,
    addWakeWord,
    removeWakeWord
  };
}
