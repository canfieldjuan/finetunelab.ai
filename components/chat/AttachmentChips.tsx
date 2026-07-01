'use client';

import React from 'react';
import { AlertCircle, Download, FileText, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import type { ChatAttachmentDto } from '@/lib/chat/attachments';
import type { PendingChatAttachment } from './types';

type AttachmentChip = ChatAttachmentDto | PendingChatAttachment;

interface AttachmentChipsProps {
  attachments: AttachmentChip[];
  className?: string;
  onRemove?: (clientId: string) => void;
}

function isPendingAttachment(attachment: AttachmentChip): attachment is PendingChatAttachment {
  return 'clientId' in attachment;
}

function getFilename(attachment: AttachmentChip): string {
  return isPendingAttachment(attachment)
    ? attachment.attachment?.filename ?? attachment.filename
    : attachment.filename;
}

function getSizeBytes(attachment: AttachmentChip): number {
  return isPendingAttachment(attachment)
    ? attachment.attachment?.sizeBytes ?? attachment.sizeBytes
    : attachment.sizeBytes;
}

function getStatus(attachment: AttachmentChip): string | undefined {
  return isPendingAttachment(attachment) ? attachment.status : attachment.status;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: string | undefined): string | null {
  if (status === 'uploading') return 'Uploading';
  if (status === 'deleting') return 'Removing';
  if (status === 'error') return 'Failed';
  return null;
}

export function AttachmentChips({ attachments, className, onRemove }: AttachmentChipsProps) {
  const [downloadingIds, setDownloadingIds] = React.useState<Set<string>>(() => new Set());

  const handleDownload = React.useCallback(async (attachment: ChatAttachmentDto) => {
    const downloadWindow = window.open('about:blank', '_blank');
    if (downloadWindow) {
      downloadWindow.opener = null;
    }

    setDownloadingIds((current) => new Set(current).add(attachment.id));
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) {
        throw new Error('You must be logged in to download attachments');
      }

      const response = await fetch(`/api/chat/attachments?attachmentId=${encodeURIComponent(attachment.id)}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const payload = await response.json().catch(() => ({})) as {
        success?: boolean;
        url?: string;
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.url) {
        throw new Error(payload.error || `Attachment download failed: ${response.status}`);
      }

      if (downloadWindow) {
        downloadWindow.location.href = payload.url;
      } else {
        window.open(payload.url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      if (downloadWindow && !downloadWindow.closed) {
        downloadWindow.close();
      }
      console.error('[AttachmentChips] Download failed:', error);
    } finally {
      setDownloadingIds((current) => {
        const next = new Set(current);
        next.delete(attachment.id);
        return next;
      });
    }
  }, []);

  if (attachments.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ''}`}>
      {attachments.map((attachment) => {
        const isPending = isPendingAttachment(attachment);
        const pending = isPending ? attachment : null;
        const chipKey = isPending ? attachment.clientId : attachment.id;
        const filename = getFilename(attachment);
        const status = getStatus(attachment);
        const busy = status === 'uploading' || status === 'deleting';
        const failed = status === 'error';
        const canDownload = !isPending && status !== 'deleted';
        const downloading = !isPending && downloadingIds.has(attachment.id);

        return (
          <div
            key={chipKey}
            className={`inline-flex max-w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
              failed
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
                : 'border-border bg-muted/60 text-muted-foreground'
            }`}
            title={pending?.error ?? filename}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : failed ? (
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="min-w-0 max-w-52 truncate font-medium text-foreground">
              {filename}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {statusLabel(status) ?? formatBytes(getSizeBytes(attachment))}
            </span>
            {canDownload && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-0.5 h-5 w-5 rounded-full p-0"
                onClick={() => void handleDownload(attachment)}
                disabled={downloading}
                aria-label={`Download ${filename}`}
                title={`Download ${filename}`}
              >
                {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            {pending && onRemove && status !== 'uploading' && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-0.5 h-5 w-5 rounded-full p-0"
                onClick={() => onRemove(pending.clientId)}
                disabled={status === 'deleting'}
                aria-label={`Remove ${filename}`}
                title={`Remove ${filename}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
