
import React from 'react';
import type { SidebarConversation } from '../chat/types';
import { MoreVertical, Archive, Trash2, Database } from 'lucide-react';
import { Button } from '../ui/button';

interface ConversationListProps {
  conversations: SidebarConversation[];
  activeId: string;
  selectMode: boolean;
  selectedConvIds: Set<string>;
  openMenuId: string | null;
  archivingId: string | null;
  archiveLoading: boolean;
  onSelectConversation: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onOpenMenu: (id: string | null) => void;
  onPromoteConversation: (id: string) => void;
  onArchiveConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}

export function ConversationList({ 
  conversations, 
  activeId, 
  selectMode, 
  selectedConvIds, 
  openMenuId,
  archivingId,
  archiveLoading,
  onSelectConversation, 
  onToggleSelection, 
  onOpenMenu,
  onPromoteConversation,
  onArchiveConversation,
  onDeleteConversation
}: ConversationListProps) {
  return (
    <div className="flex-1 min-h-0 space-y-1">
      {conversations.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2 py-4">
          No conversations yet.
        </p>
      ) : (
        conversations.map((conv) => (
          <div
            key={conv.id}
            className="group relative rounded-md border border-transparent transition-colors"
          >
            <div
              onClick={() => {
                if (selectMode) {
                  onToggleSelection(conv.id);
                } else {
                  onSelectConversation(conv.id);
                }
              }}
              className={`flex items-center justify-between px-2.5 py-1.5 text-xs cursor-pointer rounded-md ${
                activeId === conv.id && !selectMode
                  ? "bg-accent text-accent-foreground font-medium border-accent"
                  : selectedConvIds.has(conv.id)
                  ? "bg-primary/10 border-primary"
                  : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0 pr-8">
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedConvIds.has(conv.id)}
                    onChange={() => onToggleSelection(conv.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3.5 h-3.5 flex-shrink-0 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                )}
                <span className="truncate" title={conv.title}>{conv.title}</span>
                {conv.in_knowledge_graph && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">
                    Graph
                  </span>
                )}
              </div>
            </div>
            <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenMenu(openMenuId === conv.id ? null : conv.id);
                }}
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-accent bg-background/80 backdrop-blur-sm"
                title="Conversation options"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
            {openMenuId === conv.id && (
              <div className="absolute left-2 top-8 w-48 bg-background border rounded-lg shadow-lg z-20 py-1">
                  {!(conv.in_knowledge_graph) && (conv.message_count || 0) > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPromoteConversation(conv.id);
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-muted flex items-center gap-2 cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Add to KGraph</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchiveConversation(conv.id);
                    }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-muted flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    disabled={archivingId === conv.id || archiveLoading}
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>
                      {archivingId === conv.id || archiveLoading
                        ? "Archiving..."
                        : "Archive"}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-destructive/10 text-destructive flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
          </div>
        ))
      )}
    </div>
  );
}
