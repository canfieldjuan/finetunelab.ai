'use client';

import { VoiceCommandTestPanel } from '@/components/voice/VoiceCommandTestPanel';

export default function TestVoicePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Voice Command Test Page</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Test voice commands with visual feedback
        </p>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Click "Start Listening" button in the panel below</li>
            <li>Grant microphone permission when prompted</li>
            <li>Speak one of the test commands (see list below)</li>
            <li>Watch the command history to see if it matched</li>
            <li>Check browser console for detailed logs</li>
          </ol>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Commands</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold mb-2">Navigation</h3>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• "go to chat"</li>
                <li>• "open models"</li>
                <li>• "show settings"</li>
                <li>• "training"</li>
                <li>• "analytics"</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Control</h3>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• "send message"</li>
                <li>• "clear input"</li>
                <li>• "stop"</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Chat</h3>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• "new chat"</li>
                <li>• "log out"</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Settings</h3>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• "turn on voice"</li>
                <li>• "disable voice"</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> Any text that doesn't match a command will appear as "Dictation" 
              in the history (e.g., "hello world", "this is a test")
            </p>
          </div>
        </div>

        <VoiceCommandTestPanel
          onSend={() => console.log('✅ SEND command executed')}
          onClearInput={() => console.log('✅ CLEAR INPUT command executed')}
          onStop={() => console.log('✅ STOP command executed')}
          onSignOut={() => console.log('✅ SIGN OUT command executed')}
        />
      </div>
    </div>
  );
}
