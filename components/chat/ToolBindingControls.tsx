"use client";

import React from 'react';
import { Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { PortalChatTool } from './types';

interface ToolBindingControlsProps {
  tools: PortalChatTool[];
  enabledToolNames: ReadonlySet<string>;
  disabled?: boolean;
  onToggleTool: (toolName: string, enabled: boolean) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
}

function formatToolName(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toolControlId(name: string): string {
  return `chat-tool-${name.replace(/[^a-z0-9_-]/gi, '-')}`;
}

export function ToolBindingControls({
  tools,
  enabledToolNames,
  disabled,
  onToggleTool,
  onEnableAll,
  onDisableAll,
}: ToolBindingControlsProps) {
  const enabledCount = tools.filter((tool) => enabledToolNames.has(tool.function.name)).length;
  const allEnabled = tools.length > 0 && enabledCount === tools.length;
  const noneEnabled = enabledCount === 0;
  const title = tools.length > 0
    ? `Chat tools (${enabledCount}/${tools.length} enabled)`
    : 'Chat tools';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 relative"
          disabled={disabled}
          title={title}
          aria-label={title}
        >
          <Wrench className="h-4 w-4" />
          {tools.length > 0 && (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
              {enabledCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Chat Tools</h3>
            <p className="text-xs text-muted-foreground">
              {tools.length > 0
                ? `${enabledCount} of ${tools.length} enabled for this chat`
                : 'No built-in portal tools are currently available'}
            </p>
          </div>

          {tools.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onEnableAll}
                  disabled={allEnabled}
                >
                  Enable All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onDisableAll}
                  disabled={noneEnabled}
                >
                  Disable All
                </Button>
              </div>

              <div className="max-h-72 overflow-y-auto pr-1">
                <div className="space-y-1">
                  {tools.map((tool) => {
                    const name = tool.function.name;
                    const checked = enabledToolNames.has(name);
                    const id = toolControlId(name);

                    return (
                      <label
                        key={name}
                        htmlFor={id}
                        className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted"
                      >
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={(value) => onToggleTool(name, value === true)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium leading-none">
                            {formatToolName(name)}
                          </span>
                          <span className="mt-1 block line-clamp-2 text-xs leading-4 text-muted-foreground">
                            {tool.function.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
