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
            <li>Click &quot;Start Listening&quot; button in the panel below</li>
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
                <li>• &quot;go to chat&quot;</li>
                <li>• &quot;open models&quot;</li>
                <li>• &quot;show settings&quot;</li>
                <li>• &quot;training&quot;</li>
                <li>• &quot;analytics&quot;</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Control</h3>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• &quot;send message&quot;</li>
                <li>• &quot;clear input&quot;</li>
                <li>• &quot;stop&quot;</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Chat</h3>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• &quot;new chat&quot;</li>
                <li>• &quot;log out&quot;</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Settings</h3>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• &quot;turn on voice&quot;</li>
                <li>• &quot;disable voice&quot;</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> Any text that doesn&apos;t match a command will appear as &quot;Dictation&quot; 
              in the history (e.g., &quot;hello world&quot;, &quot;this is a test&quot;)
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
