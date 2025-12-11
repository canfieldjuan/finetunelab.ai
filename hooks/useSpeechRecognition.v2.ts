/**
 * Enhanced Speech Recognition Hook v2
 *
 * FIXES IMPLEMENTED:
 * - Phase 1: Effect dependency hell (callbacks in refs, not deps)
 * - Phase 2: Stale closures (refs always use latest callbacks)
 * - Phase 3: Race conditions (single source of truth for listening state)
 *
 * Features:
 * - Browser-native Web Speech API (SpeechRecognition)
 * - Microphone permission handling
 * - Real-time transcription with interim results
 * - Configurable language and recognition options
 * - Robust error handling and browser compatibility
 * - Voice command detection support
 */

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

// Track all active recognition instances globally
const activeRecognitions = new Set<SpeechRecognition>();

/**
 * Enhanced Speech Recognition hook with fixed race conditions and stale closures
 */
export function useSpeechRecognition(hookOptions: SpeechRecognitionHookOptions = {}) {
  // ==================== STATE ====================
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // ==================== REFS ====================
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // PHASE 1 FIX: Store callbacks in refs to avoid effect dependency hell
  const callbacksRef = useRef({
    onResult: hookOptions.onResult,
    onStart: hookOptions.onStart,
    onEnd: hookOptions.onEnd,
    onError: hookOptions.onError,
    onCommandDetected: hookOptions.onCommandDetected,
  });

  // PHASE 1 FIX: Store command settings in refs
  const commandSettingsRef = useRef({
    enableCommands: hookOptions.enableCommands || false,
    commandContext: hookOptions.commandContext,
  });

  // PHASE 1 FIX: Store options in ref
  const optionsRef = useRef<RecognitionOptions>({
    continuous: true,
    interimResults: true,
    lang: 'en-US',
    maxAlternatives: 1,
    ...hookOptions.defaultOptions,
  });

  // ==================== UPDATE REFS ON PROP CHANGES ====================
  // PHASE 1 FIX: Update refs without recreating recognition instance
  useEffect(() => {
    console.log('[STT-v2] Updating callback refs');
    callbacksRef.current = {
      onResult: hookOptions.onResult,
      onStart: hookOptions.onStart,
      onEnd: hookOptions.onEnd,
      onError: hookOptions.onError,
      onCommandDetected: hookOptions.onCommandDetected,
    };
  }, [
    hookOptions.onResult,
    hookOptions.onStart,
    hookOptions.onEnd,
    hookOptions.onError,
    hookOptions.onCommandDetected,
  ]);

  useEffect(() => {
    console.log('[STT-v2] Updating command settings refs');
    commandSettingsRef.current = {
      enableCommands: hookOptions.enableCommands || false,
      commandContext: hookOptions.commandContext,
    };
  }, [hookOptions.enableCommands, hookOptions.commandContext]);

  useEffect(() => {
    console.log('[STT-v2] Updating options ref');
    optionsRef.current = {
      continuous: true,
      interimResults: true,
      lang: 'en-US',
      maxAlternatives: 1,
      ...hookOptions.defaultOptions,
    };
  }, [hookOptions.defaultOptions]);

  // ==================== CHECK BROWSER SUPPORT ====================
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsSupported(false);
      setError('Speech recognition not available (SSR)');
      console.warn('[STT-v2] Running in server-side context');
      return;
    }

    const SpeechRecognition =
      (window as Window & { SpeechRecognition: { new(): SpeechRecognition; }; webkitSpeechRecognition: { new(): SpeechRecognition; }; }).SpeechRecognition ||
      (window as Window & { SpeechRecognition: { new(): SpeechRecognition; }; webkitSpeechRecognition: { new(): SpeechRecognition; }; }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Speech recognition not supported in this browser');
      console.warn('[STT-v2] Speech Recognition API not available. Use Chrome, Edge, or Safari.');
      return;
    }

    console.log('[STT-v2] Speech Recognition API is available');
    setIsSupported(true);
  }, []);

  // ==================== INITIALIZE RECOGNITION INSTANCE ====================
  // PHASE 1 FIX: Initialize ONCE, independent of callback changes
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition =
      (window as Window & { SpeechRecognition: { new(): SpeechRecognition; }; webkitSpeechRecognition: { new(): SpeechRecognition; }; }).SpeechRecognition ||
      (window as Window & { SpeechRecognition: { new(): SpeechRecognition; }; webkitSpeechRecognition: { new(): SpeechRecognition; }; }).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    console.log('[STT-v2] Creating recognition instance');
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // Configure recognition with options from ref
    recognition.continuous = optionsRef.current.continuous ?? false;
    recognition.interimResults = optionsRef.current.interimResults ?? true;
    recognition.lang = optionsRef.current.lang ?? 'en-US';
    recognition.maxAlternatives = optionsRef.current.maxAlternatives ?? 1;

    console.log('[STT-v2] Recognition configured:', {
      continuous: recognition.continuous,
      interimResults: recognition.interimResults,
      lang: recognition.lang,
      maxAlternatives: recognition.maxAlternatives
    });

    // ==================== EVENT HANDLERS ====================
    // PHASE 2 FIX: All handlers use callbacksRef.current (always latest)

    recognition.onstart = () => {
      console.log('[STT-v2] Recognition started');
      setIsListening(true);
      setError(null);
      callbacksRef.current.onStart?.();
    };

    // Audio detection logging
    recognition.onaudiostart = () => {
      console.log('[STT-v2] Audio capture started');
    };

    recognition.onaudioend = () => {
      console.log('[STT-v2] Audio capture ended');
    };

    recognition.onsoundstart = () => {
      console.log('[STT-v2] Sound detected');
    };

    recognition.onsoundend = () => {
      console.log('[STT-v2] Sound ended');
    };

    recognition.onspeechstart = () => {
      console.log('[STT-v2] Speech detected');
    };

    recognition.onspeechend = () => {
      console.log('[STT-v2] Speech ended');
    };
    recognition.onend = () => {
      console.log('[STT-v2] Recognition ended');
      setIsListening(false);
      setInterimTranscript('');
      callbacksRef.current.onEnd?.();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptText = result[0].transcript;

        if (result.isFinal) {
          finalText += transcriptText;
          console.log('[STT-v2] Final result:', transcriptText);
        } else {
          interimText += transcriptText;
          console.log('[STT-v2] Interim result:', transcriptText);
        }
      }

      if (interimText) {
        setInterimTranscript(interimText);
        // PHASE 2 FIX: Always uses latest callback
        callbacksRef.current.onResult?.(interimText, false);
      }

      if (finalText) {
        setTranscript(prev => (prev + ' ' + finalText).trim());
        setInterimTranscript('');

        // PHASE 2 FIX: Voice command detection using latest settings
        const { enableCommands, commandContext } = commandSettingsRef.current;

        if (enableCommands) {
          const registry = VoiceCommandRegistry.getInstance();
          const commandMatch = registry.match(finalText);

          if (commandMatch) {
            console.log('[STT-v2] Command detected:', commandMatch.command.id, commandMatch.params);

            try {
              commandMatch.command.handler(commandMatch.params, commandContext);
              callbacksRef.current.onCommandDetected?.(commandMatch);
            } catch (error) {
              console.error('[STT-v2] Command execution failed:', error);
            }
          } else {
            // No command matched - pass through as dictation
            callbacksRef.current.onResult?.(finalText, true);
          }
        } else {
          // Commands disabled - always pass through as dictation
          callbacksRef.current.onResult?.(finalText, true);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMsg = `Speech recognition error: ${event.error}`;

      // Handle different error types
      if (event.error === 'no-speech') {
        console.log('[STT-v2] No speech detected');
        setError('No speech detected. Please try again.');
      } else if (event.error === 'aborted') {
        console.log('[STT-v2] Recognition aborted');
      } else if (event.error === 'not-allowed') {
        console.error('[STT-v2] Microphone permission denied');
        setError('Microphone permission denied');
        setHasPermission(false);
        callbacksRef.current.onError?.(errorMsg);
      } else {
        console.error('[STT-v2]', errorMsg);
        setError(errorMsg);
        callbacksRef.current.onError?.(errorMsg);
      }

      setIsListening(false);
    };

    // ==================== CLEANUP ====================
    return () => {
      console.log('[STT-v2] Cleaning up recognition instance');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          activeRecognitions.delete(recognitionRef.current);
        } catch {
          // Ignore errors on cleanup
        }
      }
    };
  }, [isSupported]); // PHASE 1 FIX: Only recreate if support changes

  // ==================== REQUEST PERMISSION ====================
  const requestPermission = useCallback(async () => {
    try {
      console.log('[STT-v2] Requesting microphone permission');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());

      console.log('[STT-v2] Microphone permission granted');
      setHasPermission(true);
      setError(null);
      return true;
    } catch (err: unknown) {
      let errorMsg = 'Microphone access failed';

      if (err instanceof Error) {
        // Provide specific error messages based on error type
        if (err.name === 'NotAllowedError') {
          errorMsg = 'Microphone permission denied. Please allow microphone access in your browser settings.';
          console.error('[STT-v2] Permission denied by user');
        } else if (err.name === 'NotFoundError') {
          errorMsg = 'No microphone found. Please connect a microphone and try again.';
          console.error('[STT-v2] No microphone device found');
        } else if (err.name === 'NotReadableError') {
          errorMsg = 'Microphone is in use by another application. Please close other apps using the microphone.';
          console.error('[STT-v2] Microphone hardware in use or unavailable');
        } else if (err.name === 'OverconstrainedError') {
          errorMsg = 'Microphone constraints not supported. Please try a different microphone.';
          console.error('[STT-v2] Audio constraints not satisfied');
        } else {
          errorMsg = `Microphone error: ${err.message || 'Unknown error'}`;
          console.error('[STT-v2] Unexpected microphone error:', err.name, err.message);
        }
      }

      console.error('[STT-v2] Full error details:', err);
      setError(errorMsg);
      setHasPermission(false);
      callbacksRef.current.onError?.(errorMsg);
      return false;
    }
  }, []); // No dependencies - stable function

  // ==================== START LISTENING ====================
  const startListening = useCallback(async () => {
    if (!isSupported) {
      const errorMsg = 'Speech recognition not supported';
      console.error('[STT-v2]', errorMsg);
      setError(errorMsg);
      return;
    }

    const recognition = recognitionRef.current;
    if (!recognition) {
      console.error('[STT-v2] Recognition instance not initialized');
      return;
    }

    // PHASE 3 FIX: Check recognition state, let start() throw if already started
    // This is the single source of truth for "is it running?"

    // Request permission if we haven't yet
    if (hasPermission === null) {
      const granted = await requestPermission();
      if (!granted) return;
    } else if (hasPermission === false) {
      setError('Microphone permission denied. Please enable microphone access.');
      return;
    }

    try {
      console.log('[STT-v2] Starting recognition');

      // Stop ALL other active recognitions first
      console.log('[STT-v2] Active recognitions before cleanup:', activeRecognitions.size);
      activeRecognitions.forEach(otherRecognition => {
        if (otherRecognition !== recognition) {
          try {
            console.log('[STT-v2] Stopping conflicting recognition instance');
            otherRecognition.stop();
            activeRecognitions.delete(otherRecognition);
          } catch {
            // Ignore errors from stopping other instances
          }
        }
      });
      console.log('[STT-v2] Active recognitions after cleanup:', activeRecognitions.size);

      // Clear transcripts
      setTranscript('');
      setInterimTranscript('');

      // Add to active set
      activeRecognitions.add(recognition);
      console.log('[STT-v2] Added to active set, total now:', activeRecognitions.size);

      // PHASE 3 FIX: Start recognition - will throw if already started
      recognition.start();
    } catch (err: unknown) {
      // PHASE 3 FIX: Handle "already started" gracefully
      if (err instanceof Error && err.message && err.message.includes('already started')) {
        console.log('[STT-v2] Already listening, ignoring start request');
        return;
      }

      console.error('[STT-v2] Failed to start recognition:', err);
      setError('Failed to start speech recognition');
    }
  }, [isSupported, hasPermission, requestPermission]);

  // ==================== STOP LISTENING ====================
  const stopListening = useCallback(() => {
    if (!isSupported) return;

    const recognition = recognitionRef.current;
    if (!recognition) return;

    try {
      console.log('[STT-v2] Stopping recognition');
      recognition.stop();
      activeRecognitions.delete(recognition);
      setInterimTranscript(''); // Clear interim on stop
    } catch (err) {
      console.error('[STT-v2] Failed to stop recognition:', err);
    }
  }, [isSupported]);

  // ==================== CLEAR TRANSCRIPT ====================
  const clearTranscript = useCallback(() => {
    console.log('[STT-v2] Clearing transcript');
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // ==================== RETURN API ====================
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
