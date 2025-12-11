/**
 * Wake Word Detection Test Page
 * 
 * Route: /test-wake-word
 * 
 * Test the wake word detection system
 */

import { WakeWordTestPanel } from '@/components/voice/WakeWordTestPanel';

export default function TestWakeWordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Wake Word Detection Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test the &quot;Hey Assistant&quot; wake word detection system
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">How It Works</h2>
          
          <div className="space-y-4 mb-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-1">Enable Wake Word Detection</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Click the &quot;Start Listening&quot; button in the test panel
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1">Say a Wake Word</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Speak clearly: &quot;Hey Assistant&quot;, &quot;OK Assistant&quot;, &quot;Hello Assistant&quot;, or &quot;Wake Up&quot;
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1">Watch for Activation</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  The system will show an &quot;ACTIVATED!&quot; indicator when a wake word is detected
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h3 className="font-semibold mb-1">Try Custom Wake Words</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Add your own wake words and test the detection system
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Default Wake Words */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Default Wake Words</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="font-mono text-lg mb-2">&quot;hey assistant&quot;</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Most common activation phrase
              </p>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="font-mono text-lg mb-2">&quot;ok assistant&quot;</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Alternative activation phrase
              </p>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="font-mono text-lg mb-2">&quot;hello assistant&quot;</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Friendly greeting activation
              </p>
            </div>

            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="font-mono text-lg mb-2">&quot;wake up&quot;</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Short activation command
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Features</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="text-2xl mb-2">🎯</div>
              <h3 className="font-semibold mb-2">Confidence Scoring</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Fuzzy matching with confidence threshold to reduce false positives
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="text-2xl mb-2">⏱️</div>
              <h3 className="font-semibold mb-2">Cooldown Period</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                1-second cooldown prevents repeated activations
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="text-2xl mb-2">🔧</div>
              <h3 className="font-semibold mb-2">Customizable</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add or remove wake words on the fly
              </p>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            💡 Tips for Best Results
          </h2>
          
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400">•</span>
              <span>Speak clearly and at normal volume</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400">•</span>
              <span>Use Chrome or Edge for best speech recognition support</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400">•</span>
              <span>Allow microphone permissions when prompted</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400">•</span>
              <span>Test in a quiet environment for better accuracy</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400">•</span>
              <span>Custom wake words work best with 2-3 words</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Test Panel */}
      <WakeWordTestPanel />
    </div>
  );
}
