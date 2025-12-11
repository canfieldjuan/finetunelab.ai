/**
 * Voice Conversation Loop Hook
 * 
 * Enables hands-free back-and-forth conversation with the AI
 * Integrates wake word detection, speech recognition, and text-to-speech
 * 
 * Phase 3 of Voice-First Control implementation
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWakeWord } from './useWakeWord';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useTextToSpeech } from './useTextToSpeech';

/**
 * Conversation state machine states
 */
export type ConversationState = 
  | 'idle'          // Waiting for wake word
  | 'active'        // Conversation mode enabled
  | 'listening'     // Recording user input
  | 'processing'    // Waiting for AI response
  | 'speaking'      // TTS is playing response
  | 'interrupted';  // User interrupted TTS

/**
 * Configuration options for voice conversation
 */
export interface VoiceConversationConfig {
  // Auto-listening
  autoListenDelay?: number;         // Delay before auto-listen after TTS (default: 500ms)
  enableAutoListen?: boolean;       // Auto-start listening after TTS (default: true)
  
  // Timeout settings
  timeoutDuration?: number;         // Inactivity timeout (default: 30000ms)
  enableTimeout?: boolean;          // Enable auto-timeout (default: true)
  
  // Interruption
  enableInterruption?: boolean;     // Allow interrupting TTS (default: true)
  
  // Auto-speak
  autoSpeak?: boolean;              // Auto-speak AI responses (default: true)
  
  // Wake word
  enableWakeWord?: boolean;         // Enable wake word activation (default: true)
  autoStartWakeWord?: boolean;      // Auto-start wake word listening (default: true)
}

/**
 * Hook options
 */
interface VoiceConversationOptions {
  onMessage?: (text: string) => void;           // Callback when user speaks
  onStateChange?: (state: ConversationState) => void;  // Callback on state change
  onTimeout?: () => void;                       // Callback on timeout
  onError?: (error: string) => void;            // Callback on error
  config?: VoiceConversationConfig;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<VoiceConversationConfig> = {
  autoListenDelay: 500,
  enableAutoListen: true,
  timeoutDuration: 30000,
  enableTimeout: true,
  enableInterruption: true,
  autoSpeak: true,
  enableWakeWord: true,
  autoStartWakeWord: true
};

/**
 * Voice Conversation Hook
 * 
 * Manages the complete conversation loop:
 * 1. Wake word detection activates conversation
 * 2. Auto-listen for user input
 * 3. Send to AI for processing
 * 4. Speak AI response
 * 5. Auto-listen again (loop)
 * 
 * @example
 * ```tsx
 * const { isActive, state, startConversation, speakResponse } = useVoiceConversation({
 *   onMessage: (text) => {
 *     handleSend(text); // Send to AI
 *   }
 * });
 * 
 * // When AI responds
 * useEffect(() => {
 *   if (lastMessage?.role === 'assistant') {
 *     speakResponse(lastMessage.content);
 *   }
 * }, [messages]);
 * ```
 */
export function useVoiceConversation(options: VoiceConversationOptions = {}) {
  const {
    onMessage,
    onStateChange,
    onTimeout,
    onError,
    config: userConfig = {}
  } = options;

  // Merge with default config
  const config = { ...DEFAULT_CONFIG, ...userConfig };

  // State management
  const [state, setState] = useState<ConversationState>('idle');
  const [isActive, setIsActive] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState<string>('');
  
  // Log isActive changes
  useEffect(() => {
    console.log('[VoiceConv] isActive changed to:', isActive);
  }, [isActive]);
  
  // Refs for timeout management
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoListenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startListeningRef = useRef<(() => void)>(() => {});
  const ttsBlockedRef = useRef(false);
  const cleanupRef = useRef<(() => void)>(() => {});

  // Update state and notify
  const updateState = useCallback((newState: ConversationState) => {
    console.log('[VoiceConv] State:', state, '→', newState);
    setState(newState);
    onStateChange?.(newState);
  }, [state, onStateChange]);

  // Text-to-speech integration
  const { speak, cancel: cancelTTS, isSpeaking } = useTextToSpeech({
    onEnd: () => {
      console.log('[VoiceConv] TTS ended, scheduling auto-listen');
      updateState('active');
      
      // Auto-listen after TTS completes
      if (config.enableAutoListen && isActive) {
        if (autoListenTimeoutRef.current) {
          clearTimeout(autoListenTimeoutRef.current);
        }
        autoListenTimeoutRef.current = setTimeout(() => {
          console.log('[VoiceConv] Auto-starting listening - triggering STT');
          startListeningRef.current();
        }, config.autoListenDelay);
      }
    },
    onStart: () => {
      console.log('[VoiceConv] TTS started');
      updateState('speaking');
    },
    onError: (error) => {
      console.error('[VoiceConv] TTS error:', error);

      if (typeof error === 'string' && error.includes('not-allowed')) {
        console.warn('[VoiceConv] TTS blocked by browser autoplay policy; suppressing further auto-speak');
        ttsBlockedRef.current = true;
      }

      onError?.(`TTS error: ${error}`);
      updateState('active');

      if (config.enableAutoListen && isActive) {
        if (autoListenTimeoutRef.current) {
          clearTimeout(autoListenTimeoutRef.current);
        }
        autoListenTimeoutRef.current = setTimeout(() => {
          console.log('[VoiceConv] Auto-starting listening after TTS error');
          if (isActive && !isSpeaking) {
            startListeningRef.current();
          }
        }, config.autoListenDelay);
      }
    }
  });

  // Speech recognition integration
  const {
    startListening: startSTT,
    stopListening: stopSTT,
    isListening
  } = useSpeechRecognition({
    onResult: (transcript, isFinal) => {
      console.log('[VoiceConv] onResult called:', { transcript, isFinal, trimmed: transcript.trim() });
      if (isFinal && transcript.trim()) {
        console.log('[VoiceConv] User said:', transcript);
        setLastUserMessage(transcript);
        updateState('processing');
        stopSTT();
        
        // Send to callback
        console.log('[VoiceConv] Calling onMessage with:', transcript);
        onMessage?.(transcript);
        
        // IMPORTANT: Auto-restart listening after a short delay
        // This allows continuous conversation without waiting for TTS
        if (config.enableAutoListen && isActive) {
          console.log('[VoiceConv] Scheduling auto-restart listening after user speech');
          if (autoListenTimeoutRef.current) {
            clearTimeout(autoListenTimeoutRef.current);
          }
          autoListenTimeoutRef.current = setTimeout(() => {
            console.log('[VoiceConv] Auto-restarting listening after user spoke');
            if (isActive && !isSpeaking) {
              startListeningRef.current();
            }
          }, config.autoListenDelay);
        }
      } else {
        console.log('[VoiceConv] Skipping - isFinal:', isFinal, 'isEmpty:', !transcript.trim());
      }
    },
    onStart: () => {
      // Handle interruption: if speaking, cancel TTS
      if (config.enableInterruption && isSpeaking) {
        console.log('[VoiceConv] Interruption detected, canceling TTS');
        cancelTTS();
        updateState('interrupted');
      } else {
        updateState('listening');
      }
    },
    onError: (error) => {
      console.error('[VoiceConv] STT error:', error);
      onError?.(`Speech recognition error: ${error}`);
      updateState('active');
    },
    defaultOptions: {
      continuous: false,
      interimResults: true
    }
  });

  // Stop conversation
  const stopConversation = useCallback(() => {
    console.log('[VoiceConv] Stopping conversation');
    console.trace('[VoiceConv] stopConversation called from:');
    setIsActive(false);
    setState('idle');
    stopSTT();
    cancelTTS();
    
    // Clear timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (autoListenTimeoutRef.current) {
      clearTimeout(autoListenTimeoutRef.current);
    }
  }, [stopSTT, cancelTTS]);

  // Reset inactivity timeout
  const resetTimeout = useCallback((forceActive = false) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (config.enableTimeout && (forceActive || isActive)) {
      timeoutRef.current = setTimeout(() => {
        console.log('[VoiceConv] Timeout - stopping conversation');
        onTimeout?.();
        stopConversation();
      }, config.timeoutDuration);
    }
  }, [config.enableTimeout, config.timeoutDuration, isActive, onTimeout, stopConversation]);

  // Wake word integration
  const { 
    startListening: startWakeWordListening, 
    stopListening: stopWakeWordListening 
  } = useWakeWord({
    onWakeWordDetected: (result) => {
      console.log('[VoiceConv] Wake word detected:', result.wakeWord);
      // Stop wake word to avoid config conflict
      stopWakeWordListening();
      // Start conversation
      setIsActive(true);
      setState('active');
      resetTimeout(true);
      
      // Trigger first listen
      setTimeout(() => {
        startListeningRef.current();
      }, 300);
    },
    autoStart: config.autoStartWakeWord && config.enableWakeWord
  });

  // Start listening for user input
  const startListening = useCallback(() => {
    console.log('[VoiceConv] startListening called - isActive:', isActive, 'state:', state, 'isSpeaking:', isSpeaking);

    if (isSpeaking) {
      console.log('[VoiceConv] NOT starting - currently speaking');
      return;
    }

    if (!isActive) {
      console.log('[VoiceConv] Conversation inactive, enabling before listening');
      setIsActive(true);
    }

    if (state === 'idle') {
      updateState('active');
    }

    if (state !== 'speaking') {
      console.log('[VoiceConv] Starting listening');
      startSTT();
    } else {
      console.log('[VoiceConv] NOT starting - state is speaking');
    }
  }, [isActive, state, startSTT, isSpeaking, updateState]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // Start conversation manually or via wake word
  const startConversation = useCallback(() => {
    console.log('[VoiceConv] startConversation called');
    console.log('[VoiceConv] Starting conversation');
    // Stop wake word to avoid config conflict
    stopWakeWordListening();
    setIsActive(true);
    setState('active');
    resetTimeout(true);
    
    // Start listening for user input
    console.log('[VoiceConv] Scheduling startListening in 300ms');
    setTimeout(() => {
      console.log('[VoiceConv] Timeout fired, calling startListening');
      startListeningRef.current();
    }, 300);
  }, [resetTimeout, stopWakeWordListening]);

  // Effect: Restart wake word on conversation end
  useEffect(() => {
    if (!isActive && config.enableWakeWord) {
      console.log('[VoiceConv] Conversation ended, restarting wake word');
      setTimeout(() => {
        startWakeWordListening();
      }, 500);
    }
  }, [isActive, config.enableWakeWord, startWakeWordListening]);

  // Speak AI response
  const speakResponse = useCallback((text: string) => {
    if (ttsBlockedRef.current) {
      console.warn('[VoiceConv] Skipping TTS because browser blocked speech synthesis');
      return;
    }

    if (isActive && config.autoSpeak) {
      console.log('[VoiceConv] Speaking response:', text.substring(0, 50) + '...');
      speak(text);
    }
  }, [isActive, config.autoSpeak, speak]);

  // Update cleanup ref whenever cleanup functions change
  useEffect(() => {
    cleanupRef.current = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (autoListenTimeoutRef.current) {
        clearTimeout(autoListenTimeoutRef.current);
      }
      stopSTT();
      cancelTTS();
    };
  }, [stopSTT, cancelTTS]);

  // Cleanup on unmount (empty deps, uses ref)
  useEffect(() => {
    return () => cleanupRef.current();
  }, []);

  return {
    // State
    state,
    isActive,
    isListening,
    isSpeaking,
    lastUserMessage,
    
    // Actions
    startConversation,
    stopConversation,
    startListening,
    speakResponse,
    
    // Config
    config
  };
}
