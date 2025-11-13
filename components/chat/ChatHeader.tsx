
import React from 'react';
import { SessionManager } from './SessionManager';

interface ChatHeaderProps {
  isWidgetMode: boolean;
  activeId: string | null;
  sessionId: string | null;
  experimentName: string | null;
  loading: boolean;
  onSessionChange: (sessionId: string, experimentName: string) => void;
  onClearSession: () => void;
}

export function ChatHeader({ 
  isWidgetMode, 
  activeId, 
  sessionId, 
  experimentName, 
  loading, 
  onSessionChange, 
  onClearSession 
}: ChatHeaderProps) {
  if (isWidgetMode) {
    return null;
  }

  return (
    <div className="bg-transparent px-6 py-4">
      <div className="flex flex-col gap-3 items-center">
        <div className="flex items-center justify-between w-full max-w-4xl">
          <h2 className="text-lg font-semibold text-card-foreground">
            Model Training and Assessment Portal
          </h2>
          {activeId && (
            <SessionManager
              sessionId={sessionId}
              experimentName={experimentName}
              onSessionChange={onSessionChange}
              onClearSession={onClearSession}
              disabled={loading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
