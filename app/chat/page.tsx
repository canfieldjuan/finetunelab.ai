'use client';

import Chat from '@/components/Chat';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function ChatPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Widget mode detection
  const isWidgetMode = searchParams?.get('widget') === 'true';
  const [widgetConfig, setWidgetConfig] = useState<{
    sessionId: string;
    modelId: string;
    apiKey: string;
    userId?: string;
    theme?: string;
  } | null>(null);

  // Extract widget configuration from URL params
  useEffect(() => {
    if (isWidgetMode && searchParams) {
      const sessionId = searchParams.get('session');
      const modelId = searchParams.get('model');
      const apiKey = searchParams.get('key');
      const userId = searchParams.get('user');
      const theme = searchParams.get('theme');

      console.log('[ChatPage] Widget mode detected:', {
        sessionId,
        modelId,
        hasApiKey: !!apiKey,
        userId
      });

      if (!sessionId || !modelId || !apiKey) {
        console.error('[ChatPage] Missing required widget params');
        return;
      }

      setWidgetConfig({
        sessionId,
        modelId,
        apiKey,
        userId: userId || undefined,
        theme: theme || undefined
      });
    }
  }, [isWidgetMode, searchParams]);

  // Auth check - skip if widget mode
  useEffect(() => {
    if (isWidgetMode) {
      console.log('[ChatPage] Widget mode - skipping auth check');
      return;
    }

    console.log('[ChatPage] Auth state:', { user: user?.email, loading });

    if (!loading && !user) {
      console.warn('[ChatPage] No authenticated user, redirecting to login');
      router.push('/login');
    }
  }, [user, loading, router, isWidgetMode]);

  // Widget mode loading - wait for widget config
  if (isWidgetMode && !widgetConfig) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading widget...</p>
        </div>
      </div>
    );
  }

  // Normal mode loading - wait for auth
  if (!isWidgetMode && loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Normal mode auth required
  if (!isWidgetMode && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Authentication Required</h2>
          <p className="text-yellow-700 mb-4">You must be logged in to access the chat.</p>
          <p className="text-sm text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Render Chat component with widget config if in widget mode
  // Wrapped with ErrorBoundary to catch rendering errors and prevent page freeze
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[ChatPage] Error boundary caught error:', {
          error: error.message,
          componentStack: errorInfo.componentStack,
        });
      }}
    >
      <Chat widgetConfig={widgetConfig || undefined} />
    </ErrorBoundary>
  );
}

// Wrap with Suspense for useSearchParams
export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
