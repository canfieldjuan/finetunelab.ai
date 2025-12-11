'use client';

import { useEffect, useState } from 'react';

export interface EmbeddedChatWidgetProps {
  title: string;
  subtitle: string;
  defaultModel: string;
  welcomeMessage?: string;
  height?: string;
  theme?: 'light' | 'dark';
  apiKey: string;
}

/**
 * Embedded Chat Widget Component
 * 
 * Renders an inline iframe pointing to the chat page in widget mode.
 * Uses the lightweight widget architecture (GraphRAG-style) but as a React component
 * for embedding directly in the landing page.
 * 
 * @param title - Header title for the widget
 * @param subtitle - Subtitle/description
 * @param defaultModel - Model ID to use for chat
 * @param welcomeMessage - Initial welcome message (optional)
 * @param height - Widget height (default: 600px)
 * @param theme - UI theme (default: light)
 * @param apiKey - Widget API key for authentication
 */
export function EmbeddedChatWidget({
  title,
  subtitle,
  defaultModel,
  welcomeMessage,
  height = '600px',
  theme = 'light',
  apiKey
}: EmbeddedChatWidgetProps) {
  const [sessionId, setSessionId] = useState<string>('');
  const [iframeUrl, setIframeUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Generate unique session ID for this widget instance
    const newSessionId = `landing_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newSessionId);

    // Build iframe URL with widget parameters
    const params = new URLSearchParams({
      widget: 'true',
      session: newSessionId,
      model: defaultModel,
      key: apiKey,
      theme: theme
    });

    // Use relative URL (same origin, no CORS issues)
    const url = `/chat?${params.toString()}`;
    setIframeUrl(url);

    console.log('[EmbeddedChatWidget] Initialized with session:', newSessionId);
  }, [defaultModel, apiKey, theme]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    console.log('[EmbeddedChatWidget] Iframe loaded successfully');
  };

  if (!iframeUrl) {
    return (
      <div className="border rounded-lg overflow-hidden shadow-lg bg-white dark:bg-slate-900">
        <div className="bg-slate-100 dark:bg-slate-800 p-4 border-b">
          <div className="animate-pulse">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
          </div>
        </div>
        <div 
          className="flex items-center justify-center bg-slate-50 dark:bg-slate-900"
          style={{ height }}
        >
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Initializing chat...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden shadow-lg bg-white dark:bg-slate-900 transition-all">
      {/* Widget Header */}
      <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 p-4 border-b">
        <h3 className="font-bold text-lg mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div 
          className="flex items-center justify-center bg-slate-50 dark:bg-slate-900 absolute inset-0 z-10"
          style={{ height }}
        >
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-muted-foreground">Loading chat interface...</p>
          </div>
        </div>
      )}

      {/* Chat Iframe */}
      <iframe
        src={iframeUrl}
        className="w-full border-0"
        style={{ height }}
        allow="clipboard-write"
        title={title}
        onLoad={handleIframeLoad}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />

      {/* Powered By Badge */}
      <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-t text-center">
        <p className="text-xs text-muted-foreground">
          Powered by Fine Tune Lab • Try it free at{' '}
          <a href="/signup" className="text-primary hover:underline">
            finetunelab.ai
          </a>
        </p>
      </div>
    </div>
  );
}
