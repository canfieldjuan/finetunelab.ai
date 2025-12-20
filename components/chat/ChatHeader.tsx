
import React from 'react';
import { MoreVertical, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatHeaderProps {
  isWidgetMode: boolean;
  activeId: string | null;
  loading: boolean;
  onExport?: () => void;
  modelSelector?: React.ReactNode;
}

export function ChatHeader({
  isWidgetMode,
  activeId,
  loading,
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

        {/* Center: Title - absolutely centered */}
        <h2 className="text-lg font-semibold text-card-foreground text-center">
          Model Training and Assessment Portal
        </h2>

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
