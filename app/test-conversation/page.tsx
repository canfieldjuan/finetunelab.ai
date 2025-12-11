/**
 * Voice Conversation Test Page
 * 
 * Route: /test-conversation
 * 
 * Test the hands-free conversation loop system
 */

'use client';

/* eslint-disable react/no-unescaped-entities */

import { useState, useEffect } from 'react';
import { useVoiceConversation } from '@/hooks/useVoiceConversation';
import { Mic, Volume2, VolumeX, Brain, Power, PowerOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MESSAGE_ROLES, type MessageRole } from '@/lib/constants';

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: typeof window.SpeechRecognition;
  webkitSpeechRecognition?: typeof window.SpeechRecognition;
};

export default function TestConversationPage() {
  const [messages, setMessages] = useState<Array<{ role: MessageRole; content: string }>>([]);
  const [simulateAI, setSimulateAI] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  // Check browser support on mount
  useEffect(() => {
    const recognitionWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionCtor = recognitionWindow.SpeechRecognition || recognitionWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setErrors(prev => [...prev, '❌ Speech Recognition not supported in this browser']);
    }
    if (!('speechSynthesis' in window)) {
      setErrors(prev => [...prev, '❌ Speech Synthesis not supported in this browser']);
    }
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      setErrors(prev => [...prev, '❌ Media Devices API not supported in this browser']);
    }
  }, []);
  
  const {
    state,
    isActive,
    isListening,
    isSpeaking,
    lastUserMessage,
    startConversation,
    stopConversation,
    speakResponse
  } = useVoiceConversation({
    onMessage: (text) => {
      console.log('[Test] User said:', text);
      // Add user message
      setMessages(prev => [...prev, { role: MESSAGE_ROLES.USER, content: text }]);
      
      // Simulate AI response
      if (simulateAI) {
        setTimeout(() => {
          const responses = [
            "I understand. That's interesting!",
            "Tell me more about that.",
            "That makes sense. What else?",
            "Great point! Anything else?",
            "I see what you mean. Continue.",
            "Fascinating! Go on.",
            "I'm listening. What's next?",
            "Got it! Keep talking."
          ];
          const response = responses[Math.floor(Math.random() * responses.length)];
          setMessages(prev => [...prev, { role: MESSAGE_ROLES.ASSISTANT, content: response }]);
          speakResponse(response);
        }, 1000);
      }
    },
    onStateChange: (newState) => {
      console.log('[Test] State changed to:', newState);
    },
    onTimeout: () => {
      console.log('[Test] Conversation timed out');
      setErrors(prev => [...prev, 'Conversation timed out at ' + new Date().toLocaleTimeString()]);
    },
    onError: (error) => {
      console.error('[Test] Error:', error);
      setErrors(prev => [...prev, new Date().toLocaleTimeString() + ': ' + error]);
    },
    config: {
      autoListenDelay: 500,
      enableAutoListen: true,
      timeoutDuration: 30000,
      enableTimeout: true,
      enableInterruption: true,
      autoSpeak: true,
      enableWakeWord: true,
      autoStartWakeWord: true
    }
  });

  // Auto-scroll messages
  useEffect(() => {
    const container = document.getElementById('messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Get state display info
  const getStateInfo = () => {
    switch (state) {
      case 'idle':
        return { icon: PowerOff, label: 'Idle', color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' };
      case 'active':
        return { icon: Power, label: 'Active', color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' };
      case 'listening':
        return { icon: Mic, label: 'Listening', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' };
      case 'processing':
        return { icon: Brain, label: 'Processing', color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' };
      case 'speaking':
        return { icon: Volume2, label: 'Speaking', color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' };
      case 'interrupted':
        return { icon: VolumeX, label: 'Interrupted', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' };
      default:
        return { icon: PowerOff, label: 'Unknown', color: 'text-gray-400', bg: 'bg-gray-100' };
    }
  };

  const stateInfo = getStateInfo();
  const StateIcon = stateInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Conversation Loop Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test hands-free back-and-forth conversation with AI
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Instructions & Controls */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* State Indicator */}
            <div className={`${stateInfo.bg} border-2 ${stateInfo.color.replace('text-', 'border-')} rounded-lg p-6`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-full ${stateInfo.bg} ${stateInfo.color}`}>
                  <StateIcon className={`w-8 h-8 ${isListening || isSpeaking ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Current State</div>
                  <div className={`text-2xl font-bold ${stateInfo.color}`}>
                    {stateInfo.label}
                  </div>
                </div>
              </div>
              
              {/* Status Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Conversation:</span>
                  <span className="font-semibold">{isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Listening:</span>
                  <span className="font-semibold">{isListening ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Speaking:</span>
                  <span className="font-semibold">{isSpeaking ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Controls</h2>
              
              <div className="space-y-3">
                <Button
                  onClick={isActive ? stopConversation : startConversation}
                  variant={isActive ? "destructive" : "default"}
                  className="w-full"
                  size="lg"
                >
                  {isActive ? (
                    <>
                      <PowerOff className="w-5 h-5 mr-2" />
                      Stop Conversation
                    </>
                  ) : (
                    <>
                      <Power className="w-5 h-5 mr-2" />
                      Start Conversation
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-700 rounded">
                  <input
                    type="checkbox"
                    id="simulate-ai"
                    checked={simulateAI}
                    onChange={(e) => setSimulateAI(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="simulate-ai" className="text-sm cursor-pointer">
                    Simulate AI responses
                  </label>
                </div>

                <Button
                  onClick={() => setMessages([])}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  Clear Messages
                </Button>

                <Button
                  onClick={async () => {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                      stream.getTracks().forEach(track => track.stop());
                      setErrors(prev => [...prev, `✅ Microphone access granted at ${new Date().toLocaleTimeString()}`]);
                    } catch (err) {
                      setErrors(prev => [...prev, `❌ Microphone error: ${err instanceof Error ? err.message : 'Unknown error'}`]);
                    }
                  }}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Test Microphone
                </Button>

                {errors.length > 0 && (
                  <Button
                    onClick={() => setErrors([])}
                    variant="ghost"
                    className="w-full"
                    size="sm"
                  >
                    Clear Errors ({errors.length})
                  </Button>
                )}
              </div>
            </div>

            {/* Error Display */}
            {errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="font-bold mb-2 text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Errors & Status ({errors.length})
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {errors.map((error, i) => (
                    <div key={i} className="text-sm text-red-600 dark:text-red-400 font-mono bg-white dark:bg-gray-800 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* How to Test */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                💡 How to Test
              </h3>
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li>Click "Start Conversation" or say "Hey Assistant"</li>
                <li>Speak when you see "Listening" state</li>
                <li>Wait for AI response (simulated)</li>
                <li>System auto-listens after speaking</li>
                <li>Try interrupting during TTS</li>
                <li>Test 30s inactivity timeout</li>
              </ol>
            </div>

            {/* State Machine */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="font-bold mb-3">State Machine Flow</h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  <span>idle → active (wake word)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>active → listening (auto-start)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>listening → processing (speech end)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span>processing → speaking (AI response)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span>speaking → listening (TTS end)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>* → interrupted (user speaks)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Conversation */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg h-[700px] flex flex-col">
              
              {/* Header */}
              <div className="p-4 border-b dark:border-gray-700">
                <h2 className="text-xl font-bold">Conversation History</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {messages.length === 0 ? 'No messages yet. Start the conversation!' : `${messages.length} messages`}
                </p>
              </div>

              {/* Messages */}
              <div 
                id="messages-container"
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <Mic className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p>Waiting for conversation to start...</p>
                      <p className="text-sm mt-2">
                        Say &quot;Hey Assistant&quot; or click &quot;Start Conversation&quot;
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === MESSAGE_ROLES.USER ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          msg.role === MESSAGE_ROLES.USER
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        <div className="text-xs opacity-70 mb-1">
                          {msg.role === MESSAGE_ROLES.USER ? 'You' : 'Assistant'}
                        </div>
                        <div className="text-sm">{msg.content}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t dark:border-gray-700">
                {lastUserMessage && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Last detected: &quot;{lastUserMessage}&quot;
                  </div>
                )}
                {!lastUserMessage && (
                  <div className="text-sm text-gray-400">
                    Speak to start chatting...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Features Showcase */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500">
            <h3 className="font-bold mb-2">🎙️ Auto-Listen</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Automatically starts listening after AI finishes speaking (500ms delay)
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-purple-500">
            <h3 className="font-bold mb-2">⚡ Interruption</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Speak during TTS to interrupt and immediately start listening
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-orange-500">
            <h3 className="font-bold mb-2">⏱️ Auto-Timeout</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Conversation ends after 30 seconds of inactivity
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            💡 Testing Tips
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Test Wake Word:</h4>
              <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                <li>• Say &quot;Hey Assistant&quot; to start</li>
                <li>• Works even when page is inactive</li>
                <li>• Auto-restarts after conversation ends</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Test Conversation Loop:</h4>
              <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                <li>• Speak → AI responds → Auto-listen</li>
                <li>• No button clicks needed!</li>
                <li>• Natural back-and-forth flow</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Test Interruption:</h4>
              <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                <li>• Start speaking during AI response</li>
                <li>• TTS should stop immediately</li>
                <li>• Your speech is captured</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Test Timeout:</h4>
              <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                <li>• Start conversation</li>
                <li>• Wait 30+ seconds without speaking</li>
                <li>• Should return to wake word mode</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
