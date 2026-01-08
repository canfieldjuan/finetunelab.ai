/**
 * Error Boundary Component
 *
 * Catches React errors in Chat component to prevent full page freeze.
 * Provides fallback UI and recovery options.
 *
 * Created: October 29, 2025
 * Purpose: Prevent conversation data corruption from freezing UI
 */

import React, { Component, ReactNode } from 'react';
import { Button } from './ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    // Update state so next render shows fallback UI
    // Normalize error to ensure it's always a proper Error object
    const normalizedError = error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : JSON.stringify(error));

    return {
      hasError: true,
      error: normalizedError,
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    // Normalize error to ensure it's always a proper Error object
    const normalizedError = error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : JSON.stringify(error));

    console.error('[ErrorBoundary] Caught error:', normalizedError);
    console.error('[ErrorBoundary] Original error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);

    // Update state with error details
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Log error to Supabase for monitoring
    this.logErrorToDatabase(normalizedError, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(normalizedError, errorInfo);
    }
  }

  async logErrorToDatabase(error: Error, errorInfo: React.ErrorInfo) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('errors').insert({
        error_type: 'react_error_boundary',
        error_message: error.message,
        stack_trace: error.stack || null,
        severity: 'high',
        metadata_json: {
          componentStack: errorInfo.componentStack,
          errorCount: this.state.errorCount + 1,
          userId: user?.id || 'anonymous',
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        }
      });

      console.log('[ErrorBoundary] Error logged to database');
    } catch (dbError) {
      console.error('[ErrorBoundary] Failed to log error to database:', dbError);
    }
  }

  handleReset = () => {
    console.log('[ErrorBoundary] Resetting error boundary');

    // Clear error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Clear local storage to reset any cached state
    try {
      localStorage.removeItem('lastActiveConversation');
      console.log('[ErrorBoundary] Cleared cached conversation state');
    } catch (err) {
      console.error('[ErrorBoundary] Failed to clear cache:', err);
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
          <div className="max-w-2xl w-full space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="rounded-full bg-red-100 p-3">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">
                  Something went wrong
                </h1>
                <p className="text-muted-foreground">
                  The chat encountered an unexpected error. This is usually caused by corrupted conversation data.
                </p>
              </div>
            </div>

            {/* Error Details (collapsed by default) */}
            <details className="border rounded-lg p-4 bg-muted">
              <summary className="cursor-pointer font-medium text-sm">
                Error Details
              </summary>
              <div className="mt-4 space-y-2 text-sm">
                <div>
                  <span className="font-medium">Error:</span>
                  <pre className="mt-1 p-2 bg-background rounded overflow-x-auto">
                    {this.state.error?.message}
                  </pre>
                </div>
                {this.state.error?.stack && (
                  <div>
                    <span className="font-medium">Stack Trace:</span>
                    <pre className="mt-1 p-2 bg-background rounded overflow-x-auto text-xs">
                      {this.state.error.stack}
                    </pre>
                  </div>
                )}
                {this.state.errorInfo && (
                  <div>
                    <span className="font-medium">Component Stack:</span>
                    <pre className="mt-1 p-2 bg-background rounded overflow-x-auto text-xs">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>

            {/* Recovery Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={this.handleReset}
                className="flex-1"
                variant="default"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button
                onClick={this.handleGoHome}
                className="flex-1"
                variant="outline"
              >
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </div>

            {/* Helpful Tips */}
            <div className="text-sm text-muted-foreground space-y-2 border-t pt-4">
              <p className="font-medium">What you can try:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Click &quot;Try Again&quot; to reload the chat</li>
                <li>Go to the Models or Training page and return to chat</li>
                <li>If the issue persists, try archiving recent conversations</li>
                <li>Contact support if the problem continues</li>
              </ul>
            </div>

            {/* Error Count Warning */}
            {this.state.errorCount > 3 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                <p className="font-medium">Multiple errors detected</p>
                <p className="mt-1">
                  This conversation may be corrupted. Consider archiving it and starting a new one.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
