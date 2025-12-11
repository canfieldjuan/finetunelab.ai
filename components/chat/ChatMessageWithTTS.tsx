'use client';

import React from 'react';
import { PlayCircle, StopCircle, Pause } from 'lucide-react';
import { useTextToSpeech, type SpeechOptions } from '@/hooks/useTextToSpeech';
import { Button } from '@/components/ui/button';
import type { Message } from './types';

interface ChatMessageWithTTSProps {
  message: Message;
  speechOptions?: SpeechOptions; // Pass speech configuration options
}

/**
 * A standalone chat message component with integrated Text-to-Speech (TTS) capability.
 * This component is for development and verification purposes and is not yet
 * wired into the main application.
 *
 * Features:
 * - Play/pause/stop controls for TTS
 * - Configurable voice, rate, pitch, and volume
 * - Visual feedback for speaking state
 */
export function ChatMessageWithTTS({ message, speechOptions }: ChatMessageWithTTSProps) {
  const { isSpeaking, isPaused, speak, cancel, pause, resume, isSupported } = useTextToSpeech({
    onEnd: () => console.log(`[ChatMessage] Finished speaking message id ${message.id}`),
    onStart: () => console.log(`[ChatMessage] Started speaking message id ${message.id}`),
  });

  const handleToggleSpeech = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent any parent onClick handlers

    if (isSpeaking && !isPaused) {
      console.log(`[ChatMessage] User paused speech for message id ${message.id}`);
      pause();
    } else if (isPaused) {
      console.log(`[ChatMessage] User resumed speech for message id ${message.id}`);
      resume();
    } else {
      console.log(`[ChatMessage] User initiated speech for message id ${message.id}`);
      speak(message.content, speechOptions);
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`[ChatMessage] User stopped speech for message id ${message.id}`);
    cancel();
  };

  const isAssistant = message.role === 'assistant';

  // Don't show TTS controls if not supported
  if (!isSupported && isAssistant) {
    return (
      <div className={`flex items-start gap-4 p-4 rounded-lg w-full max-w-2xl mx-auto my-2 ${isAssistant ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900/20'}`}>
        <div className="flex-1 space-y-2">
          <p className="font-bold text-gray-900 dark:text-white">{isAssistant ? 'Assistant' : 'You'}</p>
          <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-4 p-4 rounded-lg w-full max-w-2xl mx-auto my-2 ${isAssistant ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900/20'}`}>
      <div className="flex-1 space-y-2">
        <p className="font-bold text-gray-900 dark:text-white">{isAssistant ? 'Assistant' : 'You'}</p>
        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
      {isAssistant && message.content && (
        <div className="flex gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleSpeech}
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            aria-label={isSpeaking && !isPaused ? 'Pause speaking' : isPaused ? 'Resume speaking' : 'Read message aloud'}
          >
            {isSpeaking && !isPaused ? (
              <Pause className="h-5 w-5 text-gray-600" />
            ) : isPaused ? (
              <PlayCircle className="h-5 w-5 text-gray-600" />
            ) : (
              <PlayCircle className="h-5 w-5" />
            )}
          </Button>
          {(isSpeaking || isPaused) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleStop}
              className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
              aria-label="Stop speaking"
            >
              <StopCircle className="h-5 w-5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
