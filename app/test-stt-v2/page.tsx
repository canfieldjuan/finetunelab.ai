/**
 * Test Page for useSpeechRecognition v2
 *
 * Route: /test-stt-v2
 *
 * Tests Phases 1-3 fixes:
 * - Phase 1: Effect dependency hell (callbacks update without recreation)
 * - Phase 2: Stale closures (always uses latest callbacks)
 * - Phase 3: Race conditions (single source of truth)
 */

'use client';

import { useState, useCallback } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition.v2';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Trash2, RefreshCw } from 'lucide-react';

export default function TestSTTv2Page() {
  const [messages, setMessages] = useState<string[]>([]);
  const [callbackVersion, setCallbackVersion] = useState(1);
  const [startClicks, setStartClicks] = useState(0);

  // PHASE 2 TEST: Callback that changes
  const handleResult = useCallback((transcript: string, isFinal: boolean) => {
    const prefix = isFinal ? '✓ FINAL' : '⋯ INTERIM';
    const versionTag = `[v${callbackVersion}]`;
    const message = `${prefix} ${versionTag}: &quot;${transcript}&quot;`;

    console.log('[Test] onResult called:', message);
    setMessages(prev => [...prev, message]);
  }, [callbackVersion]); // Callback recreates when version changes

  const handleStart = useCallback(() => {
    console.log('[Test] onStart called');
    setMessages(prev => [...prev, '🎙️ Listening started']);
  }, []);

  const handleEnd = useCallback(() => {
    console.log('[Test] onEnd called');
    setMessages(prev => [...prev, '🛑 Listening stopped']);
  }, []);

  const handleError = useCallback((error: string) => {
    console.error('[Test] onError called:', error);
    setMessages(prev => [...prev, `❌ Error: ${error}`]);
  }, []);

  // Use the new v2 hook
  const {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    hasPermission,
    startListening,
    stopListening,
    clearTranscript,
    requestPermission
  } = useSpeechRecognition({
    onResult: handleResult,
    onStart: handleStart,
    onEnd: handleEnd,
    onError: handleError,
    defaultOptions: {
      continuous: true,
      interimResults: true,
      lang: 'en-US'
    }
  });

  // PHASE 3 TEST: Rapid clicks
  const handleStartClick = () => {
    setStartClicks(prev => prev + 1);
    startListening();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Speech Recognition v2 Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Testing Phases 1-3 fixes: Callbacks, Closures, Race Conditions
          </p>
        </div>

        {/* Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Status</h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Supported:</span>
              <span className={`ml-2 font-semibold ${isSupported ? 'text-green-600' : 'text-red-600'}`}>
                {isSupported ? 'Yes' : 'No'}
              </span>
            </div>

            <div>
              <span className="text-gray-600 dark:text-gray-400">Permission:</span>
              <span className={`ml-2 font-semibold ${
                hasPermission === true ? 'text-green-600' :
                hasPermission === false ? 'text-red-600' :
                'text-yellow-600'
              }`}>
                {hasPermission === true ? 'Granted' : hasPermission === false ? 'Denied' : 'Unknown'}
              </span>
            </div>

            <div>
              <span className="text-gray-600 dark:text-gray-400">Listening:</span>
              <span className={`ml-2 font-semibold ${isListening ? 'text-blue-600' : 'text-gray-600'}`}>
                {isListening ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div>
              <span className="text-gray-600 dark:text-gray-400">Callback Version:</span>
              <span className="ml-2 font-semibold text-purple-600">
                v{callbackVersion}
              </span>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {transcript && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">Final Transcript:</div>
              <div className="text-sm">{transcript}</div>
            </div>
          )}

          {interimTranscript && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Interim:</div>
              <div className="text-sm text-gray-500 dark:text-gray-300 italic">{interimTranscript}</div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Controls</h2>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleStartClick}
              disabled={!isSupported || isListening}
              variant={isListening ? "secondary" : "default"}
              className="w-full"
            >
              {isListening ? (
                <>
                  <Mic className="w-4 h-4 mr-2 animate-pulse" />
                  Listening...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Start Listening
                </>
              )}
            </Button>

            <Button
              onClick={stopListening}
              disabled={!isListening}
              variant="destructive"
              className="w-full"
            >
              <MicOff className="w-4 h-4 mr-2" />
              Stop Listening
            </Button>

            <Button
              onClick={clearTranscript}
              variant="outline"
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Transcript
            </Button>

            <Button
              onClick={requestPermission}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Request Permission
            </Button>
          </div>

          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            <div>Start clicks (Phase 3 test): {startClicks}</div>
            <div className="text-xs mt-1">Try clicking Start rapidly - should only start once</div>
          </div>
        </div>

        {/* Phase 2 Test: Update Callback */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Phase 2 Test: Callback Updates</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Click &quot;Update Callback&quot; while listening. Results should show new version tag WITHOUT stopping recognition.
          </p>

          <Button
            onClick={() => setCallbackVersion(prev => prev + 1)}
            variant="outline"
            className="w-full"
          >
            Update Callback to v{callbackVersion + 1}
          </Button>
        </div>

        {/* Message Log */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Event Log</h2>
            <Button
              onClick={() => setMessages([])}
              variant="ghost"
              size="sm"
            >
              Clear Log
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                No messages yet. Start listening and speak!
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm font-mono"
                >
                  {msg}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Test Instructions */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="font-bold mb-3">🧪 Test Scenarios</h3>

          <div className="space-y-3 text-sm">
            <div>
              <div className="font-semibold">Phase 1 Test (Effect Dependencies):</div>
              <ol className="list-decimal list-inside ml-2 text-gray-700 dark:text-gray-300">
                <li>Start listening</li>
                <li>Speak something</li>
                <li>Click &quot;Update Callback&quot; (should NOT stop recognition)</li>
                <li>Speak again (should show new version tag)</li>
                <li>✅ Pass: Recognition continues without interruption</li>
              </ol>
            </div>

            <div>
              <div className="font-semibold">Phase 2 Test (Stale Closures):</div>
              <ol className="list-decimal list-inside ml-2 text-gray-700 dark:text-gray-300">
                <li>Start listening</li>
                <li>Speak: &quot;test one&quot;</li>
                <li>See result with [v1] tag</li>
                <li>Click &quot;Update Callback to v2&quot;</li>
                <li>Speak: &quot;test two&quot;</li>
                <li>✅ Pass: Second result shows [v2] tag (not stale [v1])</li>
              </ol>
            </div>

            <div>
              <div className="font-semibold">Phase 3 Test (Race Conditions):</div>
              <ol className="list-decimal list-inside ml-2 text-gray-700 dark:text-gray-300">
                <li>Click &quot;Start Listening&quot; 5 times rapidly</li>
                <li>Watch console logs</li>
                <li>✅ Pass: Only ONE &quot;Recognition started&quot; message</li>
                <li>✅ Pass: &quot;Already listening&quot; logged for duplicate attempts</li>
              </ol>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}