/**
 * Wake Word Test Component
 * 
 * Test wake word detection with visual feedback
 */

'use client';

import React, { useState } from 'react';
import { useWakeWord } from '@/hooks/useWakeWord';
import { Mic, MicOff, CheckCircle, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WakeWordDetectionResult } from '@/lib/voice/wakeWordDetector';

export function WakeWordTestPanel() {
  const [detectionHistory, setDetectionHistory] = useState<WakeWordDetectionResult[]>([]);
  const [isActivated, setIsActivated] = useState(false);

  const {
    isListening,
    startListening,
    stopListening,
    config,
    addWakeWord,
    removeWakeWord
  } = useWakeWord({
    onWakeWordDetected: (result) => {
      console.log('[WakeWord Test] Detected:', result);
      setDetectionHistory(prev => [result, ...prev].slice(0, 10));
      
      // Simulate activation
      setIsActivated(true);
      setTimeout(() => setIsActivated(false), 3000);
    },
    autoStart: false,
    enableFeedback: true
  });

  const [customWakeWord, setCustomWakeWord] = useState('');

  return (
    <div className="fixed top-4 right-4 bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-4 max-w-md z-50">
      <h3 className="font-bold mb-2 flex items-center gap-2">
        🎙️ Wake Word Detection Test
        {isListening && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
      </h3>

      {/* Controls */}
      <div className="flex gap-2 mb-4">
        <Button
          onClick={isListening ? stopListening : startListening}
          variant={isListening ? "destructive" : "default"}
          size="sm"
          className="flex items-center gap-2"
        >
          {isListening ? (
            <>
              <MicOff className="w-4 h-4" />
              Stop Listening
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              Start Listening
            </>
          )}
        </Button>
      </div>

      {/* Activation Indicator */}
      {isActivated && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-500 rounded flex items-center gap-2 animate-pulse">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="font-semibold text-green-800 dark:text-green-200">
            ACTIVATED! 🎉
          </span>
        </div>
      )}

      {/* Current Config */}
      <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm">
        <div className="font-semibold mb-1">Active Wake Words:</div>
        <div className="space-y-1">
          {config.wakeWords.map((word, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="font-mono">&quot;{word}&quot;</span>
              <button
                onClick={() => removeWakeWord(word)}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          Confidence threshold: {(config.confidenceThreshold * 100).toFixed(0)}%
        </div>
      </div>

      {/* Add Custom Wake Word */}
      <div className="mb-4">
        <div className="text-xs font-semibold mb-1">Add Custom Wake Word:</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customWakeWord}
            onChange={(e) => setCustomWakeWord(e.target.value)}
            placeholder="e.g., hi there"
            className="flex-1 px-2 py-1 text-xs border rounded dark:bg-gray-700"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customWakeWord.trim()) {
                addWakeWord(customWakeWord.trim());
                setCustomWakeWord('');
              }
            }}
          />
          <Button
            onClick={() => {
              if (customWakeWord.trim()) {
                addWakeWord(customWakeWord.trim());
                setCustomWakeWord('');
              }
            }}
            size="sm"
            variant="outline"
          >
            Add
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
        <div className="font-semibold mb-1">How to test:</div>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Click &quot;Start Listening&quot;</li>
          <li>Say one of the wake words clearly</li>
          <li>Watch for activation indicator</li>
          <li>Try custom wake words</li>
        </ol>
      </div>

      {/* Detection History */}
      <div className="border-t pt-2">
        <p className="text-xs font-semibold mb-2">Detection History:</p>
        <div className="text-xs max-h-40 overflow-y-auto space-y-1">
          {detectionHistory.length === 0 ? (
            <p className="text-gray-400">No detections yet...</p>
          ) : (
            detectionHistory.map((detection, idx) => (
              <div key={idx} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <Volume2 className="w-3 h-3 text-green-500" />
                  <span className="font-semibold">{detection.wakeWord}</span>
                  <span className="text-gray-500">
                    ({(detection.confidence * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                  {detection.transcript}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(detection.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Clear History */}
      {detectionHistory.length > 0 && (
        <Button
          onClick={() => setDetectionHistory([])}
          variant="outline"
          size="sm"
          className="w-full mt-2"
        >
          Clear History
        </Button>
      )}

      {/* Status Footer */}
      <div className="mt-2 pt-2 border-t text-xs text-gray-500">
        {isListening ? (
          <span className="text-green-600">🎤 Listening for wake words...</span>
        ) : (
          <span>Click &quot;Start Listening&quot; to begin</span>
        )}
      </div>
    </div>
  );
}
