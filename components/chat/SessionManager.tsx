"use client";

import React from 'react';
import { Button } from '../ui/button';
import { Tag, Copy, Check } from 'lucide-react';

interface SessionManagerProps {
  sessionId: string | null;
  experimentName: string | null;
  onSessionChange: (sessionId: string, experimentName: string) => void;
  onClearSession: () => void;
  disabled?: boolean;
}

/**
 * SessionManager Component
 * Displays auto-generated session tags for conversation tracking and analytics
 * Format: chat_model_{uuid}_{counter} (e.g., chat_model_abc123_015)
 */
export function SessionManager({
  sessionId,
  experimentName,
  onSessionChange,
  onClearSession,
  disabled = false
}: SessionManagerProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!sessionId) return;
    
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[SessionManager] Failed to copy session tag:', error);
    }
  };

  // Display auto-generated session tag as badge
  if (sessionId) {
    return (
      <div className="flex items-center gap-2">
        <div 
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          title="Click to copy session tag"
        >
          <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-mono font-medium text-blue-700 dark:text-blue-300">
            {sessionId}
          </span>
          {experimentName && (
            <span className="text-xs text-blue-600 dark:text-blue-400">
              ({experimentName})
            </span>
          )}
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 opacity-60" />
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          Auto-generated
        </span>
      </div>
    );
  }

  // No session tag yet - show placeholder
  return (
    <div className="flex items-center gap-2 px-3 py-1 border border-dashed border-muted-foreground/30 rounded-lg">
      <Tag className="w-3 h-3 text-muted-foreground/50" />
      <span className="text-xs text-muted-foreground/50">
        Session tag will appear on first message
      </span>
    </div>
  );
}
