'use client';

import React, { useState, useEffect } from 'react';
import { ChatMessageWithTTS } from '@/components/chat/ChatMessageWithTTS';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

// Mock message data for testing
const mockMessages = [
  { id: '1', role: 'user' as const, content: 'Hello, can you tell me about the Web Speech API?' },
  { id: '2', role: 'assistant' as const, content: 'Certainly! The Web Speech API enables you to incorporate voice data into web apps. It has two parts: SpeechRecognition for voice-to-text, and SpeechSynthesis for text-to-voice.' },
  { id: '3', role: 'assistant' as const, content: 'This second message demonstrates the auto-play functionality. It should be read aloud automatically if the toggle is on.' },
];

/**
 * A temporary test page to verify the Text-to-Speech (TTS) functionality in isolation.
 * This page is not part of the main application navigation.
 * Access it at /testing/voice
 */
export default function VoiceTestPage() {
  const { voices } = useTextToSpeech();
  const [selectedVoice, setSelectedVoice] = useState<string | undefined>();
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    if (voices.length > 0 && !selectedVoice) {
      // Try to select a default Google UK English voice, or fall back to the first available voice.
      const defaultVoice = voices.find(v => v.name === 'Google UK English Female') || voices[0];
      if (defaultVoice) {
        setSelectedVoice(defaultVoice.voiceURI);
        console.log('Debug: Default voice set to', defaultVoice.name);
      }
    }
  }, [voices, selectedVoice]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Voice Integration Test Page</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          This page is for testing the `useTextToSpeech` hook and `ChatMessageWithTTS` component in isolation.
        </p>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-6">
          <h2 className="text-xl font-semibold">Controls</h2>
          
          {/* Voice Selection Dropdown */}
          <div className="flex items-center gap-4">
            <Label htmlFor="voice-select" className="w-24">Select Voice:</Label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={voices.length === 0}>
              <SelectTrigger id="voice-select" className="w-full">
                <SelectValue placeholder="Loading voices..." />
              </SelectTrigger>
              <SelectContent>
                {voices.map((voice) => (
                  <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto-Play Toggle */}
          <div className="flex items-center space-x-2">
            <Switch id="auto-play-switch" checked={autoPlay} onCheckedChange={setAutoPlay} />
            <Label htmlFor="auto-play-switch">Auto-play new messages</Label>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Messages</h2>
          <div className="space-y-4">
            {mockMessages.map((msg) => (
              <ChatMessageWithTTS
                key={msg.id}
                message={msg}
                speechOptions={selectedVoice ? { voiceURI: selectedVoice } : undefined}
              />
            ))}
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg">
          <h3 className="font-bold">How to Test:</h3>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Use the dropdown to change the voice (requires browser support, like Chrome).</li>
            <li>Click the play icon on an assistant message to hear it read aloud.</li>
            <li>While a message is playing, click the stop icon to cancel it.</li>
            <li>Toggle the &ldquo;Auto-play&rdquo; switch to test automatic playback on new messages (simulated with the second assistant message).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
