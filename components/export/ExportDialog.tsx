/**
 * ExportDialog Component
 *
 * Dialog for exporting conversations to various formats
 */

'use client';

import React, { useState } from 'react';
import { useExport } from '@/hooks/useExport';
import { Button } from '@/components/ui/button';
import type { ExportFormat } from '@/lib/export/types';

interface ExportDialogProps {
  conversationIds: string[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExportDialog({ conversationIds, onClose, onSuccess }: ExportDialogProps) {
  const { exporting, error, result, generateExport, downloadExport } = useExport();
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [title, setTitle] = useState('');

  const handleExport = async () => {
    try {
      const exportResult = await generateExport({
        conversationIds,
        format,
        includeMetadata,
        title: title || undefined,
      });

      // Auto-download
      await downloadExport(exportResult.id);

      onSuccess?.();
    } catch {
      // Error is handled by hook
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Export Conversations</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Conversation count */}
          <p className="text-sm text-muted-foreground">
            Exporting {conversationIds.length} conversation{conversationIds.length !== 1 ? 's' : ''}
          </p>

          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              disabled={exporting}
            >
              <option value="markdown">Markdown (.md)</option>
              <option value="json">JSON (.json)</option>
              <option value="txt">Plain Text (.txt)</option>
              <option value="jsonl">JSONL - Training Format (.jsonl)</option>
              <option value="html">HTML - Web Format (.html)</option>
              <option value="pdf">PDF - Printable (.pdf)</option>
            </select>
          </div>

          {/* Title (optional) */}
          <div>
            <label className="block text-sm font-medium mb-2">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Export title"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              disabled={exporting}
            />
          </div>

          {/* Options */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="includeMetadata"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.target.checked)}
              className="rounded border-input"
              disabled={exporting}
            />
            <label htmlFor="includeMetadata" className="text-sm">
              Include metadata (timestamps, IDs)
            </label>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Success message */}
          {result && !error && (
            <div className="p-3 bg-green-500/10 text-green-600 rounded-md text-sm">
              Export created successfully! Download started.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={exporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || conversationIds.length === 0}
          >
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </div>
    </div>
  );
}
