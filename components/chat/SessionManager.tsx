"use client";

import React from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Tag, X } from 'lucide-react';

interface SessionManagerProps {
  sessionId: string | null;
  experimentName: string | null;
  onSessionChange: (sessionId: string, experimentName: string) => void;
  onClearSession: () => void;
  disabled?: boolean;
}

/**
 * SessionManager Component
 * Allows users to tag conversations with session IDs and experiment names
 * for A/B testing and model comparison analytics
 */
export function SessionManager({
  sessionId,
  experimentName,
  onSessionChange,
  onClearSession,
  disabled = false
}: SessionManagerProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [tempSessionId, setTempSessionId] = React.useState(sessionId || '');
  const [tempExperimentName, setTempExperimentName] = React.useState(experimentName || '');

  const handleSave = () => {
    if (tempSessionId.trim()) {
      console.log('[SessionManager] Saving session:', tempSessionId, tempExperimentName);
      onSessionChange(tempSessionId.trim(), tempExperimentName.trim());
      setIsEditing(false);
    }
  };

  const handleClear = () => {
    console.log('[SessionManager] Clearing session');
    setTempSessionId('');
    setTempExperimentName('');
    onClearSession();
    setIsEditing(false);
  };

  // Display mode - show badge if session exists
  if (!isEditing && sessionId) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg">
          <Tag className="w-3 h-3 text-blue-600" />
          <span className="text-xs font-medium text-blue-700">{sessionId}</span>
          {experimentName && (
            <span className="text-xs text-blue-600">({experimentName})</span>
          )}
          <button
            onClick={handleClear}
            disabled={disabled}
            className="ml-1 hover:bg-blue-100 rounded p-0.5 disabled:opacity-50"
            title="Clear session"
          >
            <X className="w-3 h-3 text-blue-600" />
          </button>
        </div>
      </div>
    );
  }

  // Display mode - show button to start tagging
  if (!isEditing && !sessionId) {
    return (
      <Button
        onClick={() => setIsEditing(true)}
        disabled={disabled}
        variant="outline"
        size="sm"
        className="h-8 text-xs"
      >
        <Tag className="w-3 h-3 mr-1" />
        Tag Session
      </Button>
    );
  }

  // Edit mode - show input fields
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-2 items-center px-2 py-1 bg-muted rounded-lg">
        <Input
          value={tempSessionId}
          onChange={(e) => setTempSessionId(e.target.value)}
          placeholder="Session ID (e.g., test-run-1)"
          className="h-7 text-xs w-40"
          disabled={disabled}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave();
            } else if (e.key === 'Escape') {
              setIsEditing(false);
            }
          }}
        />
        <Input
          value={tempExperimentName}
          onChange={(e) => setTempExperimentName(e.target.value)}
          placeholder="Experiment name (optional)"
          className="h-7 text-xs w-40"
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave();
            } else if (e.key === 'Escape') {
              setIsEditing(false);
            }
          }}
        />
        <Button
          onClick={handleSave}
          disabled={disabled || !tempSessionId.trim()}
          size="sm"
          className="h-7 px-3 text-xs"
        >
          Save
        </Button>
        <Button
          onClick={() => setIsEditing(false)}
          disabled={disabled}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
