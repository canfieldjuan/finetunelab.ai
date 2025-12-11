/**
 * ArchiveManager Component
 *
 * Component for managing archived conversations
 */

'use client';

import React, { useEffect } from 'react';
import { useArchive } from '@/hooks/useArchive';
import { Button } from '@/components/ui/button';

interface ArchiveManagerProps {
  onClose: () => void;
  onRestore?: (conversationIds: string[]) => void;
}

export function ArchiveManager({ onClose, onRestore }: ArchiveManagerProps) {
  const { loading, error, archived, restore, fetchArchived } = useArchive();
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // Fetch archived conversations on mount
  useEffect(() => {
    fetchArchived();
  }, [fetchArchived]);

  const handleRestore = async () => {
    if (selectedIds.length === 0) return;

    try {
      await restore({ conversationIds: selectedIds });
      setSelectedIds([]);
      onRestore?.(selectedIds);
    } catch {
      // Error handled by hook
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === archived.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(archived.map(conv => conv.id));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Archived Conversations</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Loading state */}
        {loading && archived.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading archived conversations...</div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && archived.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-2">No archived conversations</p>
            <p className="text-sm text-muted-foreground">
              Conversations you archive will appear here
            </p>
          </div>
        )}

        {/* Content - List of archived conversations */}
        {archived.length > 0 && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="selectAll"
                  checked={selectedIds.length === archived.length}
                  onChange={toggleSelectAll}
                  className="rounded border-input"
                />
                <label htmlFor="selectAll" className="text-sm">
                  Select all ({archived.length})
                </label>
              </div>
              {selectedIds.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedIds.length} selected
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {archived.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`
                    flex items-center space-x-3 p-3 rounded-md border
                    ${selectedIds.includes(conversation.id) ? 'bg-accent border-accent' : 'border-border'}
                    hover:bg-accent/50 cursor-pointer
                  `}
                  onClick={() => toggleSelect(conversation.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(conversation.id)}
                    onChange={() => {}}
                    className="rounded border-input"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{conversation.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {conversation.messages.length} message{conversation.messages.length !== 1 ? 's' : ''}
                      {' • '}
                      Archived {new Date(conversation.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-2 mt-auto pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            onClick={handleRestore}
            disabled={loading || selectedIds.length === 0}
          >
            {loading ? 'Restoring...' : `Restore (${selectedIds.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
