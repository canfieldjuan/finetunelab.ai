
import React from 'react';
import { MoreVertical, Download, Share2, Tag } from 'lucide-react';
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
  loading: boolean;
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

        {/* Center: Title and Session Tag */}
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-lg font-semibold text-card-foreground text-center">
            Model Training and Assessment Portal
          </h2>
          {sessionId && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              <Tag className="h-3 w-3" />
              <span>{sessionId}</span>
              {experimentName && <span className="text-muted-foreground">• {experimentName}</span>}
            </Badge>
          )}
        </div>

        {/* Right side: More Menu */}
        <div className="flex items-center justify-end gap-2 mr-2">
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
