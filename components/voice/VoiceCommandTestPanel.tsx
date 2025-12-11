/**
 * Voice Command Testing Panel
 * 
 * Add this to Chat.tsx to test voice commands with visual feedback
 */

'use client';

import React, { useState, useEffect } from 'react';
import { VoiceCommandRegistry, registerCoreCommands, type CommandMatchResult } from '@/lib/voice';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Mic, MicOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoiceCommandTestPanelProps {
  onSend?: () => void;
  onClearInput?: () => void;
  onStop?: () => void;
  onSignOut?: () => void;
}

export function VoiceCommandTestPanel({
  onSend,
  onClearInput,
  onStop,
  onSignOut
}: VoiceCommandTestPanelProps) {
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [lastCommand, setLastCommand] = useState<CommandMatchResult | null>(null);
  const [commandsRegistered, setCommandsRegistered] = useState(false);

  // Register commands on mount
  useEffect(() => {
    console.log('[VoiceTest] Registering core commands...');
    registerCoreCommands();
    setCommandsRegistered(true);
    
    const registry = VoiceCommandRegistry.getInstance();
    const stats = registry.getStats();
    console.log('[VoiceTest] Registered commands:', stats);
  }, []);

  // Setup voice recognition with command detection
  const { startListening, stopListening, isListening, transcript } = useSpeechRecognition({
    enableCommands: true,
    
    commandContext: {
      handleSend: () => {
        console.log('[VoiceTest] handleSend called');
        onSend?.();
        setCommandHistory(prev => [...prev, 'SEND executed']);
      },
      setInput: (value: string) => {
        console.log('[VoiceTest] setInput called:', value);
        onClearInput?.();
        setCommandHistory(prev => [...prev, `CLEAR executed (value: "${value}")`]);
      },
      handleStop: () => {
        console.log('[VoiceTest] handleStop called');
        onStop?.();
        setCommandHistory(prev => [...prev, 'STOP executed']);
      },
      signOut: () => {
        console.log('[VoiceTest] signOut called');
        onSignOut?.();
        setCommandHistory(prev => [...prev, 'SIGN OUT executed']);
      }
    },
    
    onCommandDetected: (match) => {
      console.log('[VoiceTest] Command detected:', match);
      setLastCommand(match);
      setCommandHistory(prev => [
        ...prev,
        `✅ ${match.command.id}: "${match.transcript}"`
      ]);
    },
    
    onResult: (text, isFinal) => {
      if (isFinal) {
        console.log('[VoiceTest] Dictation (no command):', text);
        setCommandHistory(prev => [
          ...prev,
          `📝 Dictation: "${text}"`
        ]);
      }
    },
    
    onError: (error) => {
      console.error('[VoiceTest] Error:', error);
      setCommandHistory(prev => [...prev, `❌ Error: ${error}`]);
    }
  });

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-4 max-w-md z-50">
      <h3 className="font-bold mb-2 flex items-center gap-2">
        🎤 Voice Command Test Panel
        {commandsRegistered && <CheckCircle className="w-4 h-4 text-green-500" />}
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

      {/* Status */}
      <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="font-semibold">
            {isListening ? 'Listening...' : 'Ready'}
          </span>
        </div>
        
        {transcript && (
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Transcript: {transcript}
          </div>
        )}
        
        {lastCommand && (
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            Last Command: {lastCommand.command.description}
          </div>
        )}
      </div>

      {/* Test Commands */}
      <div className="mb-4">
        <p className="text-xs font-semibold mb-2">Try these commands:</p>
        <div className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
          <div>• &quot;send message&quot; - triggers onSend</div>
          <div>• &quot;clear input&quot; - triggers setInput(&quot;&quot;)</div>
          <div>• &quot;stop&quot; - triggers handleStop</div>
          <div>• &quot;go to chat&quot; - navigation</div>
          <div>• &quot;new chat&quot; - navigation</div>
          <div>• Any other text - dictation mode</div>
        </div>
      </div>

      {/* Command History */}
      <div className="border-t pt-2">
        <p className="text-xs font-semibold mb-2">Command History:</p>
        <div className="text-xs max-h-40 overflow-y-auto space-y-1">
          {commandHistory.length === 0 ? (
            <p className="text-gray-400">No commands yet</p>
          ) : (
            commandHistory.slice(-10).reverse().map((entry, idx) => (
              <div key={idx} className="font-mono text-xs">
                {entry}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Clear History */}
      {commandHistory.length > 0 && (
        <Button
          onClick={() => setCommandHistory([])}
          variant="outline"
          size="sm"
          className="w-full mt-2"
        >
          Clear History
        </Button>
      )}
    </div>
  );
}
