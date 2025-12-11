
import React from 'react';
import { Settings, Archive, Search, RefreshCw, Download, Database, MessageSquare } from 'lucide-react';
import type { OpenModal } from '../chat/types';

interface SidebarMenuProps {
  archiveLoading: boolean;
  hasActiveConversation: boolean;
  documentsCount: number;
  onOpenModal: (modal: OpenModal) => void;
  onNewConversation: () => void;
  onPromoteConversation: (id: string) => void;
  onArchiveConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onBulkArchive: (ids: string[]) => void;
}

export function SidebarMenu({
  archiveLoading,
  hasActiveConversation,
  documentsCount,
  onOpenModal,
  onNewConversation
}: SidebarMenuProps) {
  const menuItems = [
    {
      id: "new-chat",
      label: "New Chat",
      icon: MessageSquare,
      onClick: onNewConversation,
      disabled: false
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      onClick: () => onOpenModal('settings'),
      disabled: false
    },
    {
      id: "archive-manager",
      label: "Archived Conversations",
      icon: Archive,
      onClick: () => onOpenModal('archive-manager'),
      disabled: archiveLoading
    },
    {
      id: "context-inspector",
      label: "Context Inspector",
      icon: Search,
      onClick: () => onOpenModal('context-inspector'),
      disabled: !hasActiveConversation
    },
    {
      id: "model-comparison",
      label: "Compare Models",
      icon: RefreshCw,
      onClick: () => onOpenModal('model-comparison'),
      disabled: false
    },
    {
      id: "export-conversation",
      label: "Export Conversation",
      icon: Download,
      onClick: () => onOpenModal('export-dialog'),
      disabled: !hasActiveConversation
    },
    {
      id: "knowledge-base",
      label: "Add to KGraph",
      icon: Database,
      onClick: () => onOpenModal('knowledge-base'),
      badge: documentsCount > 0 ? String(documentsCount) : undefined
    }
  ];

  return (
    <>
      {menuItems.map(item => (
        <button
          key={item.id}
          onClick={item.onClick}
          disabled={item.disabled}
          className="w-full text-left px-2.5 py-1.5 text-xs rounded-md flex items-center gap-2 transition-colors cursor-pointer hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <item.icon className="w-3.5 h-3.5" />
          <span>{item.label}</span>
          {item.badge && (
            <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </>
  );
}
