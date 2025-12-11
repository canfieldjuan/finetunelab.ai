'use client';

import { useState } from 'react';
import Script from 'next/script';

// Type definitions for the LLMOps SDK (loaded via script tag)
interface LLMOpsConfig {
  appId: string;
  endpoint: string;
  token: string;
  debug?: boolean;
  flushIntervalMs?: number;
  maxBatch?: number;
  onBeforeSend?: (event: LLMEvent) => LLMEvent | null;
}

interface LLMEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp?: number;
}

interface LLMOpsSDKInstance {
  track: (eventType: string, data: Record<string, unknown>) => void;
  identify: (data: { userId: string; traits?: Record<string, unknown> }) => void;
  flush: () => void;
}

interface LLMOpsSDKConstructor {
  new (config: LLMOpsConfig): LLMOpsSDKInstance;
}

declare global {
  interface Window {
    LLMOpsSDK?: LLMOpsSDKConstructor;
  }
}

export default function WidgetTestPage() {
  const [appId, setAppId] = useState('');
  const [token, setToken] = useState('');
  const [endpoint, setEndpoint] = useState('http://localhost:3000/api/v1/ingest');
  const [sdk, setSdk] = useState<LLMOpsSDKInstance | null>(null);
  const [logs, setLogs] = useState<string[]>(['Ready. Initialize the widget to start testing.']);
  const [customEventData, setCustomEventData] = useState('{"action": "button_click", "buttonId": "submit", "value": "test"}');

  const log = (message: string, data?: unknown) => {
    const timestamp = new Date().toLocaleTimeString();
    let logMsg = `[${timestamp}] ${message}`;
    if (data) {
      logMsg += '\n' + JSON.stringify(data, null, 2);
    }
    setLogs(prev => [logMsg, ...prev]);
    console.log(message, data);
  };

  const initWidget = () => {
    if (!appId || !token) {
      alert('Please enter both App ID and Token');
      return;
    }

    try {
      const { LLMOpsSDK } = window;
      
      if (!LLMOpsSDK) {
        log('❌ LLMOpsSDK not loaded yet. Please wait...');
        return;
      }

      const instance = new LLMOpsSDK({
        appId: appId,
        endpoint: endpoint,
        token: token,
        debug: true,
        flushIntervalMs: 2000,
        maxBatch: 10,
        onBeforeSend: (event: LLMEvent) => {
          log('📤 Sending event:', event);
          return event;
        }
      });

      setSdk(instance);
      log('✅ Widget initialized successfully!', { appId, endpoint });

      // Track page view automatically
      instance.track('page_view', {
        path: window.location.pathname,
        referrer: document.referrer
      });

      log('📍 Auto-tracked page_view event');
    } catch (error) {
      log('❌ Error initializing widget:', error);
    }
  };

  const trackCustomEvent = () => {
    if (!sdk) {
      alert('Please initialize the widget first');
      return;
    }

    sdk.track('button_click', {
      button: 'custom_event_test',
      timestamp: Date.now()
    });

    log('🎯 Tracked custom event: button_click');
  };

  const trackLLMRequest = () => {
    if (!sdk) {
      alert('Please initialize the widget first');
      return;
    }

    const requestId = 'req_' + Math.random().toString(36).substr(2, 9);

    sdk.track('llm.request', {
      requestId: requestId,
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'What is the capital of France?' }
      ],
      temperature: 0.7,
      maxTokens: 100
    });

    log('🤖 Tracked LLM request:', { requestId });
  };

  const trackLLMResponse = () => {
    if (!sdk) {
      alert('Please initialize the widget first');
      return;
    }

    const requestId = 'req_' + Math.random().toString(36).substr(2, 9);

    sdk.track('llm.response', {
      requestId: requestId,
      content: 'The capital of France is Paris.',
      tokensUsed: 45,
      latencyMs: 1234,
      model: 'gpt-4o-mini'
    });

    log('💬 Tracked LLM response:', { requestId });
  };

  const identifyUser = () => {
    if (!sdk) {
      alert('Please initialize the widget first');
      return;
    }

    const userId = 'user_' + Math.random().toString(36).substr(2, 9);

    sdk.identify({
      userId: userId,
      traits: {
        email: 'test@example.com',
        plan: 'pro',
        signupDate: new Date().toISOString()
      }
    });

    log('👤 Identified user:', { userId });
  };

  const trackCustomJSON = () => {
    if (!sdk) {
      alert('Please initialize the widget first');
      return;
    }

    try {
      const data = JSON.parse(customEventData) as Record<string, unknown>;
      sdk.track('custom', data);
      log('📦 Tracked custom JSON event:', data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert('Invalid JSON: ' + message);
    }
  };

  const flushNow = () => {
    if (!sdk) {
      alert('Please initialize the widget first');
      return;
    }

    sdk.flush();
    log('🚀 Manually flushed events to server');
  };

  return (
    <>
      <Script src="/llmops.min.js" strategy="beforeInteractive" />
      
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
              🚀 LLMOps Widget Test Page
            </h1>

            {/* Setup Warning */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">⚠️ Setup Required</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p><strong>Before testing:</strong></p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Go to <a href="/secrets" className="underline" target="_blank">/secrets</a></li>
                      <li>Create a new Widget App</li>
                      <li>Copy the App ID and Token</li>
                      <li>Paste them in the configuration below</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">📝 Widget Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    App ID:
                  </label>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="e.g., app_abc123xyz"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Token:
                  </label>
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Your widget app token"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Endpoint:
                  </label>
                  <input
                    type="text"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <button
                  onClick={initWidget}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Initialize Widget
                </button>
              </div>
            </div>

            {/* Test Actions */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🧪 Test Actions</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={trackCustomEvent}
                  className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                >
                  Track Custom Event
                </button>
                <button
                  onClick={trackLLMRequest}
                  className="bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors"
                >
                  Track LLM Request
                </button>
                <button
                  onClick={trackLLMResponse}
                  className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Track LLM Response
                </button>
                <button
                  onClick={identifyUser}
                  className="bg-pink-600 text-white py-2 px-4 rounded-md hover:bg-pink-700 transition-colors"
                >
                  Identify User
                </button>
                <button
                  onClick={flushNow}
                  className="col-span-2 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Flush Events Now
                </button>
              </div>
            </div>

            {/* Advanced Test */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Advanced Test</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Event Data (JSON):
                  </label>
                  <textarea
                    value={customEventData}
                    onChange={(e) => setCustomEventData(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={trackCustomJSON}
                  className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 transition-colors"
                >
                  Send Custom Event
                </button>
              </div>
            </div>

            {/* Logs */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">📋 Event Log</h3>
              <div className="bg-black rounded p-3 max-h-96 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className="text-green-400 text-xs font-mono mb-2 whitespace-pre-wrap">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
