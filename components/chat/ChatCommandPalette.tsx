'use client';

import React, { useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command-palette';
import {
  MessageSquare,
  Archive,
  Database,
  Settings,
  Download,
  Trash2,
  Plus,
  Sparkles,
  BarChart3,
  RefreshCw,
} from 'lucide-react';

export interface CommandAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
  group?: string;
}

export interface ChatCommandPaletteProps {
  /** Conversations for quick navigation */
  conversations?: Array<{ id: string; title: string }>;
  /** Available models for quick switching */
  models?: Array<{ id: string; name: string }>;
  /** Custom actions */
  customActions?: CommandAction[];
  /** Callback when new conversation is triggered */
  onNewConversation?: () => void;
  /** Callback when conversation is selected */
  onSelectConversation?: (id: string) => void;
  /** Callback when model is selected */
  onSelectModel?: (id: string) => void;
  /** Callback when archive manager is opened */
  onOpenArchive?: () => void;
  /** Callback when knowledge base is opened */
  onOpenKnowledgeBase?: () => void;
  /** Callback when settings is opened */
  onOpenSettings?: () => void;
  /** Callback when context inspector is opened */
  onOpenContextInspector?: () => void;
  /** Callback when model comparison is opened */
  onOpenModelComparison?: () => void;
  /** Callback when export is triggered */
  onExport?: () => void;
  /** Callback when conversation deletion is triggered */
  onDeleteConversation?: () => void;
}

/**
 * ChatCommandPalette - VS Code-style command palette for chat interface
 * 
 * Keyboard shortcuts:
 * - Ctrl+K / Cmd+K: Open palette
 * - Escape: Close palette
 * - Arrow keys: Navigate
 * - Enter: Execute command
 * 
 * Features:
 * - Quick conversation navigation
 * - Model switching
 * - Common actions (new, archive, export, etc.)
 * - Fuzzy search
 */
export function ChatCommandPalette({
  conversations = [],
  models = [],
  customActions = [],
  onNewConversation,
  onSelectConversation,
  onSelectModel,
  onOpenArchive,
  onOpenKnowledgeBase,
  onOpenSettings,
  onOpenContextInspector,
  onOpenModelComparison,
  onExport,
  onDeleteConversation,
}: ChatCommandPaletteProps) {
  const [open, setOpen] = useState(false);

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  // Built-in actions
  const actions: CommandAction[] = [
    {
      id: 'new-conversation',
      label: 'New Conversation',
      icon: <Plus className="mr-2 h-4 w-4" />,
      shortcut: '⌘N',
      action: () => onNewConversation?.(),
      group: 'Actions',
    },
    {
      id: 'archive',
      label: 'Open Archive',
      icon: <Archive className="mr-2 h-4 w-4" />,
      action: () => onOpenArchive?.(),
      group: 'Actions',
    },
    {
      id: 'knowledge-base',
      label: 'Knowledge Base',
      icon: <Database className="mr-2 h-4 w-4" />,
      action: () => onOpenKnowledgeBase?.(),
      group: 'Actions',
    },
    {
      id: 'context-inspector',
      label: 'Context Inspector',
      icon: <BarChart3 className="mr-2 h-4 w-4" />,
      action: () => onOpenContextInspector?.(),
      group: 'Actions',
    },
    {
      id: 'model-comparison',
      label: 'Compare Models',
      icon: <RefreshCw className="mr-2 h-4 w-4" />,
      action: () => onOpenModelComparison?.(),
      group: 'Actions',
    },
    {
      id: 'export',
      label: 'Export Conversation',
      icon: <Download className="mr-2 h-4 w-4" />,
      action: () => onExport?.(),
      group: 'Actions',
    },
    {
      id: 'delete',
      label: 'Delete Conversation',
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      action: () => onDeleteConversation?.(),
      group: 'Actions',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="mr-2 h-4 w-4" />,
      action: () => onOpenSettings?.(),
      group: 'Actions',
    },
    ...customActions,
  ];

  // Group actions by category
  const groupedActions = actions.reduce((acc, action) => {
    const group = action.group || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(action);
    return acc;
  }, {} as Record<string, CommandAction[]>);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Conversations Group */}
        {conversations.length > 0 && (
          <>
            <CommandGroup heading="Conversations">
              {conversations.slice(0, 5).map((conv) => (
                <CommandItem
                  key={conv.id}
                  value={conv.title}
                  onSelect={() => handleAction(() => onSelectConversation?.(conv.id))}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span>{conv.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Models Group */}
        {models.length > 0 && (
          <>
            <CommandGroup heading="Switch Model">
              {models.map((model) => (
                <CommandItem
                  key={model.id}
                  value={model.name}
                  onSelect={() => handleAction(() => onSelectModel?.(model.id))}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  <span>{model.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Action Groups */}
        {Object.entries(groupedActions).map(([groupName, groupActions]) => (
          <CommandGroup key={groupName} heading={groupName}>
            {groupActions.map((action) => (
              <CommandItem
                key={action.id}
                value={action.label}
                onSelect={() => handleAction(action.action)}
              >
                {action.icon}
                <span>{action.label}</span>
                {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
