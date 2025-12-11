'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Speech synthesis options that can be configured per utterance
 */
export interface SpeechOptions {
  voiceURI?: string;
  rate?: number;        // 0.1 to 10 (default: 1)
  pitch?: number;       // 0 to 2 (default: 1)
  volume?: number;      // 0 to 1 (default: 1)
  lang?: string;        // Language code (e.g., 'en-US')
}

/**
 * Hook configuration options
 */
interface TextToSpeechHookOptions {
  onEnd?: () => void;
  onStart?: () => void;
  onError?: (error: string) => void;
  defaultOptions?: SpeechOptions;
}

/**
 * Voice provider type for future extensibility
 * Can support Web Speech API, Google Cloud TTS, Azure TTS, etc.
 */
export type VoiceProvider = 'browser' | 'google-cloud' | 'azure' | 'elevenlabs';

/**
 * Enhanced Text-to-Speech hook with configurable options
 *
 * Features:
 * - Configurable rate, pitch, volume, and language
 * - Support for custom voice selection
 * - Pause/resume functionality
 * - Robust browser compatibility checks
 * - Extensible for external TTS services (Google, Azure, etc.)
 * - Proper cleanup and state management
 *
 * @example
 * ```tsx
 * const { speak, cancel, voices } = useTextToSpeech({
 *   defaultOptions: { rate: 1.2, pitch: 1.1 }
 * });
 *
 * // Speak with custom options
 * speak('Hello world', {
 *   voiceURI: 'Google US English',
 *   rate: 1.5
 * });
 * ```
 */
export function useTextToSpeech(hookOptions: TextToSpeechHookOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesLoadedRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Check if Speech Synthesis is supported in the browser
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSupported(false);
      setError('Speech synthesis not supported in this browser');
      console.warn('[TTS] Speech Synthesis API not available');
    }
  }, []);

  /**
   * Load available voices with robust browser compatibility
   */
  const loadVoices = useCallback(() => {
    if (!isSupported || voicesLoadedRef.current) return;

    const availableVoices = window.speechSynthesis.getVoices();

    if (availableVoices.length > 0) {
      console.log(`[TTS] Voices loaded: ${availableVoices.length} voices available`);
      setVoices(availableVoices);
      voicesLoadedRef.current = true;

      // Stop polling once voices are loaded
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        console.log('[TTS] Voice polling stopped - voices loaded successfully');
      }
    }
  }, [isSupported]);

  /**
   * Set up voice loading with multiple strategies for browser compatibility
   */
  useEffect(() => {
    if (!isSupported) return;

    const speechSynthesis = window.speechSynthesis;

    // Strategy 1: Listen for voiceschanged event (Chrome, Edge)
    speechSynthesis.addEventListener('voiceschanged', loadVoices);

    // Strategy 2: Try immediate load (Safari)
    loadVoices();

    // Strategy 3: Poll for voices (fallback for edge cases)
    pollIntervalRef.current = setInterval(() => {
      if (!voicesLoadedRef.current) {
        loadVoices();
      }
    }, 200);

    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
    };
  }, [loadVoices, isSupported]);

  /**
   * Speak text with configurable options
   */
  const speak = useCallback((text: string, speakOptions?: SpeechOptions) => {
    if (!isSupported) {
      const errorMsg = 'Speech synthesis not supported';
      console.error(`[TTS] ${errorMsg}`);
      setError(errorMsg);
      hookOptions.onError?.(errorMsg);
      return;
    }

    const speechSynthesis = window.speechSynthesis;

    // Merge default options with per-call options
    const options: SpeechOptions = {
      ...hookOptions.defaultOptions,
      ...speakOptions,
    };

    const startNewUtterance = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      // Configure voice
      if (options.voiceURI) {
        const selectedVoice = voices.find(v => v.voiceURI === options.voiceURI);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          console.log(`[TTS] Using voice: ${selectedVoice.name} (${selectedVoice.lang})`);
        } else {
          console.warn(`[TTS] Voice "${options.voiceURI}" not found, using default`);
        }
      }

      // Configure speech parameters
      utterance.rate = options.rate ?? 1;
      utterance.pitch = options.pitch ?? 1;
      utterance.volume = options.volume ?? 1;

      if (options.lang) {
        utterance.lang = options.lang;
      }

      console.log(`[TTS] Speech config: rate=${utterance.rate}, pitch=${utterance.pitch}, volume=${utterance.volume}`);

      // Set up event handlers
      utterance.onstart = () => {
        console.log(`[TTS] Started: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
        setIsSpeaking(true);
        setIsPaused(false);
        setError(null);
        hookOptions.onStart?.();
      };

      utterance.onend = () => {
        console.log('[TTS] Speech ended');
        setIsSpeaking(false);
        setIsPaused(false);
        hookOptions.onEnd?.();
        utteranceRef.current = null;
      };

      utterance.onpause = () => {
        console.log('[TTS] Speech paused');
        setIsPaused(true);
      };

      utterance.onresume = () => {
        console.log('[TTS] Speech resumed');
        setIsPaused(false);
      };

      utterance.onerror = (event) => {
        // 'interrupted' errors are expected when canceling/restarting
        if (event.error === 'interrupted') {
          console.log('[TTS] Speech interrupted (expected)');
          setIsSpeaking(false);
          setIsPaused(false);
          return;
        }

        const errorMsg = `Speech synthesis error: ${event.error}`;
        console.error(`[TTS] ${errorMsg}`);
        setError(errorMsg);
        setIsSpeaking(false);
        setIsPaused(false);
        hookOptions.onError?.(errorMsg);
      };

      speechSynthesis.speak(utterance);
    };

    // Handle interruption of ongoing speech
    if (speechSynthesis.speaking) {
      console.log('[TTS] Interrupting current speech');
      speechSynthesis.cancel();

      // Give time for cancel to complete, then start new utterance
      fallbackTimeoutRef.current = setTimeout(startNewUtterance, 200);

      if (utteranceRef.current) {
        utteranceRef.current.onend = () => {
          if (fallbackTimeoutRef.current) {
            clearTimeout(fallbackTimeoutRef.current);
            fallbackTimeoutRef.current = null;
          }
          startNewUtterance();
        };
      }
    } else {
      startNewUtterance();
    }
  }, [voices, hookOptions, isSupported]);

  /**
   * Cancel ongoing speech
   */
  const cancel = useCallback(() => {
    if (!isSupported) return;

    const speechSynthesis = window.speechSynthesis;
    if (speechSynthesis.speaking) {
      console.log('[TTS] Cancelling speech');
      speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  }, [isSupported]);

  /**
   * Pause ongoing speech
   */
  const pause = useCallback(() => {
    if (!isSupported) return;

    const speechSynthesis = window.speechSynthesis;
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      console.log('[TTS] Pausing speech');
      speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isSupported]);

  /**
   * Resume paused speech
   */
  const resume = useCallback(() => {
    if (!isSupported) return;

    const speechSynthesis = window.speechSynthesis;
    if (speechSynthesis.paused) {
      console.log('[TTS] Resuming speech');
      speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [isSupported]);

  return {
    // State
    isSpeaking,
    isPaused,
    voices,
    error,
    isSupported,

    // Actions
    speak,
    cancel,
    pause,
    resume,
  };
}
