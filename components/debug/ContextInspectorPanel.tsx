'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Eye,
  EyeOff,
  Pin,
  PinOff,
  AlertTriangle,
  BarChart3,
  MessageSquare,
  Database,
  Sparkles,
  X
} from 'lucide-react';
import type { ContextUsage } from '@/lib/context/types';

export interface ContextInspectorPanelProps {
  /** Current context usage data */
  usage: ContextUsage | null;
  /** Model name for display */
  modelName?: string;
  /** Callback when panel is closed */
  onClose: () => void;
  /** Whether the panel is open */
  open: boolean;
  /** Optional: Messages with pin status */
  messages?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    tokens?: number;
    isPinned?: boolean;
  }>;
  /** Callback when message pin status changes */
  onTogglePin?: (messageId: string) => void;
}

/**
 * Context Inspector Panel - Visualize and manage conversation context
 * 
 * Features:
 * - Real-time token usage visualization
 * - Warning level indicators
 * - Per-message token breakdown
 * - Pin/unpin messages
 * - What-if scenarios (toggle messages)
 * - Multi-model context breakdown
 */
export function ContextInspectorPanel({
  usage,
  modelName,
  onClose,
  open,
  messages = [],
  onTogglePin,
}: ContextInspectorPanelProps) {
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [hiddenMessages, setHiddenMessages] = useState<Set<string>>(new Set());

  if (!usage) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Context Inspector</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            No context data available
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Calculate what-if totals (excluding hidden messages)
  const whatIfTotal = whatIfMode
    ? usage.totalTokens - Array.from(hiddenMessages).reduce((sum, msgId) => {
        const msg = messages.find(m => m.id === msgId);
        return sum + (msg?.tokens || 0);
      }, 0)
    : usage.totalTokens;

  const whatIfPercentage = (whatIfTotal / usage.maxContextTokens) * 100;

  // Determine warning color
  const getWarningColor = (percentage: number) => {
    if (percentage >= 95) return 'text-red-600 bg-red-50';
    if (percentage >= 85) return 'text-orange-600 bg-orange-50';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getWarningBadge = (level: string) => {
    const badges = {
      high: <Badge variant="destructive">High Warning</Badge>,
      medium: <Badge className="bg-orange-500">Medium Warning</Badge>,
      low: <Badge className="bg-yellow-500">Low Warning</Badge>,
      none: <Badge variant="outline" className="bg-green-50">Normal</Badge>,
    };
    return badges[level as keyof typeof badges] || badges.none;
  };

  const toggleMessageVisibility = (messageId: string) => {
    setHiddenMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const formatTokens = (tokens: number) => {
    return tokens.toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Context Inspector
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Model Info */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{modelName || 'Default Model'}</span>
            </div>
            {getWarningBadge(usage.warningLevel)}
          </div>

          {/* Usage Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Context Usage</span>
              <span className={getWarningColor(whatIfPercentage)}>
                {whatIfPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getWarningColor(whatIfPercentage)}`}
                style={{ width: `${Math.min(whatIfPercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTokens(whatIfTotal)} tokens</span>
              <span>{formatTokens(usage.maxContextTokens)} max</span>
            </div>
          </div>

          {/* What-If Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">What-If Mode</span>
              <span className="text-xs text-muted-foreground">
                Click messages to simulate removal
              </span>
            </div>
            <Button
              variant={whatIfMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setWhatIfMode(!whatIfMode);
                if (whatIfMode) setHiddenMessages(new Set());
              }}
            >
              {whatIfMode ? 'Active' : 'Inactive'}
            </Button>
          </div>

          {/* Token Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Token Breakdown</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBreakdown(!showBreakdown)}
              >
                {showBreakdown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>

            {showBreakdown && (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Input</span>
                  </div>
                  <div className="text-lg font-semibold">
                    {formatTokens(usage.messages.reduce((sum, m) => sum + m.input_tokens, 0))}
                  </div>
                </div>

                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">Output</span>
                  </div>
                  <div className="text-lg font-semibold">
                    {formatTokens(usage.messages.reduce((sum, m) => sum + m.output_tokens, 0))}
                  </div>
                </div>

                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="h-4 w-4 text-purple-500" />
                    <span className="text-xs text-muted-foreground">GraphRAG</span>
                  </div>
                  <div className="text-lg font-semibold">
                    {formatTokens(usage.messages.reduce((sum, m) => sum + m.graphrag_tokens, 0))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Message List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Messages ({usage.messageCount})</span>
              {whatIfMode && hiddenMessages.size > 0 && (
                <span className="text-xs text-muted-foreground">
                  {hiddenMessages.size} hidden
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {messages.map((message, index) => {
                const isHidden = hiddenMessages.has(message.id);
                const tokens = message.tokens || usage.messages[index]?.total || 0;

                return (
                  <div
                    key={message.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isHidden
                        ? 'bg-gray-100 dark:bg-gray-900 opacity-50'
                        : 'bg-background'
                    } ${whatIfMode ? 'cursor-pointer hover:bg-muted' : ''}`}
                    onClick={() => whatIfMode && toggleMessageVisibility(message.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <Badge variant={message.role === 'user' ? 'outline' : 'secondary'}>
                          {message.role}
                        </Badge>
                        <span className="text-sm text-muted-foreground truncate max-w-md">
                          {message.content.substring(0, 60)}
                          {message.content.length > 60 && '...'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-muted-foreground">
                          {formatTokens(tokens)}
                        </span>
                        {onTogglePin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePin(message.id);
                            }}
                          >
                            {message.isPinned ? (
                              <Pin className="h-3 w-3 text-blue-500" />
                            ) : (
                              <PinOff className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        {whatIfMode && (
                          <div className="w-6 flex items-center justify-center">
                            {isHidden ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Warning Message */}
          {usage.hasWarning && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-yellow-900 dark:text-yellow-100">
                  Context usage is {usage.warningLevel}
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                  Consider starting a new conversation or removing older messages to free up context space.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
