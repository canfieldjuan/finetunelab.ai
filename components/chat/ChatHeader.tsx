
import React, { useState } from 'react';
import { MoreVertical, Download, Share2, Tag, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface ChatHeaderProps {
  isWidgetMode: boolean;
  activeId: string | null;
  loading?: boolean;
  sessionId?: string | null;
  experimentName?: string | null;
  onExport?: () => void;
  modelSelector?: React.ReactNode;
}

export function ChatHeader({
  isWidgetMode,
  activeId,
  loading,
  sessionId,
  experimentName,
  onExport,
  modelSelector
}: ChatHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopySessionId = async () => {
    if (!sessionId) return;

    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy session ID:', err);
    }
  };

  if (isWidgetMode) {
    return null;
  }

  return (
    <div className="bg-transparent px-2 py-3">
      <div className="grid grid-cols-3 items-center w-full gap-4">
        {/* Left side: Model Selector - closer to sidebar, transparent background */}
        <div className="flex justify-start ml-2">
          {modelSelector}
        </div>

        {/* Center: Title */}
        <h2 className="text-lg font-semibold text-card-foreground text-center">
          Model Training and Assessment Portal
        </h2>

        {/* Right side: Session Tag + More Menu */}
        <div className="flex items-center justify-end gap-2 mr-2">
          {/* Session Tag Badge - clickable to copy */}
          {sessionId && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
              onClick={handleCopySessionId}
              title="Click to copy session ID"
            >
              <Tag className="h-3 w-3" />
              <span>{sessionId}</span>
              {experimentName && <span className="text-muted-foreground">• {experimentName}</span>}
              {copied ? (
                <Check className="h-3 w-3 ml-1 text-green-600" />
              ) : (
                <Copy className="h-3 w-3 ml-1 opacity-60" />
              )}
            </Badge>
          )}

          {/* 3-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={onExport}
                disabled={!activeId || !onExport}
                className="cursor-pointer"
              >
                <Download className="mr-2 h-4 w-4" />
                <span>Export Conversation</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Share2 className="mr-2 h-4 w-4" />
                <span>Share</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
