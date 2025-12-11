'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceCommandRegistry, type VoiceCommandContext, type CommandMatchResult } from '@/lib/voice';

// Type declarations for Web Speech API (not in standard TypeScript lib)
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new(): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new(): SpeechRecognition;
    };
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

/**
 * Speech recognition configuration options
 */
export interface RecognitionOptions {
  continuous?: boolean;      // Continue listening until stopped (default: false)
  interimResults?: boolean;   // Return interim results (default: true)
  lang?: string;              // Language code (e.g., 'en-US')
  maxAlternatives?: number;   // Max alternatives per result (default: 1)
}

/**
 * Hook configuration options
 */
interface SpeechRecognitionHookOptions {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onStart?: () => void;
  onError?: (error: string) => void;
  defaultOptions?: RecognitionOptions;
  
  // Voice command support
  enableCommands?: boolean;                              // Enable voice command detection (default: false)
  onCommandDetected?: (match: CommandMatchResult) => void; // Callback when command is detected
  commandContext?: VoiceCommandContext;                  // Context for command handlers (UI functions)
}

/**
 * Enhanced Speech Recognition hook with configurable options
 *
 * Features:
 * - Browser-native Web Speech API (SpeechRecognition)
 * - Microphone permission handling
 * - Real-time transcription with interim results
 * - Configurable language and recognition options
 * - Robust error handling and browser compatibility
 * - Extensible for external STT services (Google Cloud, Azure, etc.)
 *
 * @example
 * ```tsx
 * const { startListening, stopListening, isListening, transcript } = useSpeechRecognition({
 *   onResult: (text, isFinal) => {
 *     if (isFinal) {
 *       setInput(prevInput => prevInput + ' ' + text);
 *     }
 *   }
 * });
 * ```
 */

// Track all active recognition instances globally
const activeRecognitions = new Set<SpeechRecognition>();

export function useSpeechRecognition(hookOptions: SpeechRecognitionHookOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);



  /**
   * Check if Speech Recognition is supported in the browser
   */
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsSupported(false);
      setError('Speech recognition not available (SSR)');
      console.warn('[STT] Running in server-side context');
      return;
    }

    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setIsSupported(false);
      setError('Speech recognition not supported in this browser');
      console.warn('[STT] Speech Recognition API not available. Use Chrome, Edge, or Safari.');
      return;
    }

    console.log('[STT] Speech Recognition API is available');
    setIsSupported(true);
  }, []);

  /**
   * Initialize Speech Recognition instance
   */
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition =
      (window as Window & { SpeechRecognition: { new(): SpeechRecognition; }; webkitSpeechRecognition: { new(): SpeechRecognition; }; }).SpeechRecognition ||
      (window as Window & { SpeechRecognition: { new(): SpeechRecognition; }; webkitSpeechRecognition: { new(): SpeechRecognition; }; }).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    console.log('[STT] Created new recognition instance:', recognition);

    // Configure recognition options
    const options: RecognitionOptions = {
      continuous: true,  // Changed to true - keeps listening until manually stopped
      interimResults: true,
      lang: 'en-US',
      maxAlternatives: 1,
      ...hookOptions.defaultOptions,
    };

    recognition.continuous = options.continuous ?? false;
    recognition.interimResults = options.interimResults ?? true;
    recognition.lang = options.lang ?? 'en-US';
    recognition.maxAlternatives = options.maxAlternatives ?? 1;

    console.log('[STT] Recognition configured:', {
      continuous: recognition.continuous,
      interimResults: recognition.interimResults,
      lang: recognition.lang,
      maxAlternatives: recognition.maxAlternatives
    });

    // Event handlers
    recognition.onstart = () => {
      console.log('[STT] Recognition started');
      setIsListening(true);
      setError(null);
      hookOptions.onStart?.();
    };

    // Add audio detection logging
    recognition.onaudiostart = () => {
      console.log('[STT] Audio capture started');
    };

    recognition.onaudioend = () => {
      console.log('[STT] Audio capture ended');
    };

    recognition.onsoundstart = () => {
      console.log('[STT] Sound detected');
    };

    recognition.onsoundend = () => {
      console.log('[STT] Sound ended');
    };

    recognition.onspeechstart = () => {
      console.log('[STT] Speech detected');
    };

    recognition.onspeechend = () => {
      console.log('[STT] Speech ended');
    };

    recognition.onend = () => {
      console.log('[STT] Recognition ended', {
        wasListening: isListeningRef.current,
        hadTranscript: transcript.length > 0,
        hadInterim: interimTranscript.length > 0
      });
      setIsListening(false);
      setInterimTranscript('');
      isListeningRef.current = false;
      hookOptions.onEnd?.();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptText = result[0].transcript;

        if (result.isFinal) {
          finalText += transcriptText;
          console.log('[STT] Final result:', transcriptText);
        } else {
          interimText += transcriptText;
          console.log('[STT] Interim result:', transcriptText);
        }
      }

      if (interimText) {
        setInterimTranscript(interimText);
        hookOptions.onResult?.(interimText, false);
      }

      if (finalText) {
        setTranscript(prev => prev + ' ' + finalText);
        setInterimTranscript('');
        
        // Voice command detection (if enabled)
        if (hookOptions.enableCommands) {
          const registry = VoiceCommandRegistry.getInstance();
          const commandMatch = registry.match(finalText);
          
          if (commandMatch) {
            console.log('[VoiceCmd] Command detected:', commandMatch.command.id, commandMatch.params);
            
            // Execute command handler with context
            try {
              commandMatch.command.handler(commandMatch.params, hookOptions.commandContext);
              
              // Notify via callback
              hookOptions.onCommandDetected?.(commandMatch);
            } catch (error) {
              console.error('[VoiceCmd] Command execution failed:', error);
            }
          } else {
            // No command matched - pass through as dictation
            hookOptions.onResult?.(finalText, true);
          }
        } else {
          // Commands disabled - always pass through as dictation
          hookOptions.onResult?.(finalText, true);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMsg = `Speech recognition error: ${event.error}`;

      // 'no-speech' and 'aborted' are not critical errors
      if (event.error === 'no-speech') {
        console.log('[STT] No speech detected');
        setError('No speech detected. Please try again.');
      } else if (event.error === 'aborted') {
        console.log('[STT] Recognition aborted');
      } else if (event.error === 'not-allowed') {
        console.error('[STT] Microphone permission denied');
        setError('Microphone permission denied');
        setHasPermission(false);
        hookOptions.onError?.(errorMsg);
      } else {
        console.error('[STT]', errorMsg);
        setError(errorMsg);
        hookOptions.onError?.(errorMsg);
      }

      setIsListening(false);
      isListeningRef.current = false;
    };

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          activeRecognitions.delete(recognitionRef.current);
        } catch {
          // Ignore errors on cleanup
        }
      }
    };
  }, [isSupported, hookOptions, interimTranscript.length, transcript.length]);

  /**
   * Request microphone permission
   */
  const requestPermission = useCallback(async () => {
    try {
      console.log('[STT] Requesting microphone permission');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());

      console.log('[STT] Microphone permission granted');
      setHasPermission(true);
      setError(null);
      return true;
    } catch (err: unknown) {
      let errorMsg = 'Microphone access failed';

      if (err instanceof Error) {
        // Provide specific error messages based on error type
        if (err.name === 'NotAllowedError') {
          errorMsg = 'Microphone permission denied. Please allow microphone access in your browser settings.';
          console.error('[STT] Permission denied by user');
        } else if (err.name === 'NotFoundError') {
          errorMsg = 'No microphone found. Please connect a microphone and try again.';
          console.error('[STT] No microphone device found');
        } else if (err.name === 'NotReadableError') {
          errorMsg = 'Microphone is in use by another application. Please close other apps using the microphone.';
          console.error('[STT] Microphone hardware in use or unavailable');
        } else if (err.name === 'OverconstrainedError') {
          errorMsg = 'Microphone constraints not supported. Please try a different microphone.';
          console.error('[STT] Audio constraints not satisfied');
        } else {
          errorMsg = `Microphone error: ${err.message || 'Unknown error'}`;
          console.error('[STT] Unexpected microphone error:', err.name, err.message);
        }
      }

      console.error('[STT] Full error details:', err);
      setError(errorMsg);
      setHasPermission(false);
      hookOptions.onError?.(errorMsg);
      return false;
    }
  }, [hookOptions]);

  /**
   * Start listening for speech
   */
  const startListening = useCallback(async () => {
    if (!isSupported) {
      const errorMsg = 'Speech recognition not supported';
      console.error('[STT]', errorMsg);
      setError(errorMsg);
      return;
    }

    if (isListeningRef.current) {
      console.log('[STT] Already listening, ignoring start request');
      return;
    }

    // Request permission if we haven't yet
    if (hasPermission === null) {
      const granted = await requestPermission();
      if (!granted) return;
    } else if (hasPermission === false) {
      setError('Microphone permission denied. Please enable microphone access.');
      return;
    }

    try {
      console.log('[STT] Starting recognition');
      
      // CRITICAL: Stop ALL other active recognitions first!
      console.log('[STT] Active recognitions before cleanup:', activeRecognitions.size);
      activeRecognitions.forEach(otherRecognition => {
        if (otherRecognition !== recognitionRef.current) {
          try {
            console.log('[STT] Stopping conflicting recognition instance');
            otherRecognition.stop();
            activeRecognitions.delete(otherRecognition);
          } catch {
            // Ignore errors from stopping other instances
          }
        }
      });
      console.log('[STT] Active recognitions after cleanup:', activeRecognitions.size);
      
      isListeningRef.current = true;
      setTranscript('');
      setInterimTranscript('');
      
      const recognition = recognitionRef.current;
      if (recognition) {
        activeRecognitions.add(recognition);
        console.log('[STT] Added to active set, total now:', activeRecognitions.size);
        recognition.start();
      }
    } catch (err) {
      console.error('[STT] Failed to start recognition:', err);
      setError('Failed to start speech recognition');
      isListeningRef.current = false;
    }
  }, [isSupported, hasPermission, requestPermission]);

  /**
   * Stop listening for speech
   */
  const stopListening = useCallback(() => {
    if (!isSupported) return;

    if (!isListeningRef.current) {
      console.log('[STT] Not listening, ignoring stop request');
      return;
    }

    try {
      console.log('[STT] Stopping recognition');
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.stop();
        activeRecognitions.delete(recognition);
      }
      isListeningRef.current = false;
    } catch (err) {
      console.error('[STT] Failed to stop recognition:', err);
    }
  }, [isSupported]);

  /**
   * Clear transcript
   */
  const clearTranscript = useCallback(() => {
    console.log('[STT] Clearing transcript');
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    // State
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    hasPermission,

    // Actions
    startListening,
    stopListening,
    clearTranscript,
    requestPermission,
  };
}
