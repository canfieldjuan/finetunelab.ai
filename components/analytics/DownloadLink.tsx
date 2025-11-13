'use client';

// Download Link Component
// Display downloadable export with metadata and actions
// Date: October 25, 2025

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Download,
  Copy,
  Trash2,
  FileSpreadsheet,
  Code,
  FileText,
  Clock,
  HardDrive,
} from 'lucide-react';
import type { ExportFormat } from './types';

export interface DownloadLinkProps {
  exportId: string;
  fileName: string;
  fileSize: number;
  format: ExportFormat;
  expiresAt: string;
  downloadCount?: number;
  onDownload?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

export function DownloadLink({
  exportId,
  fileName,
  fileSize,
  format,
  expiresAt,
  downloadCount = 0,
  onDownload,
  onDelete,
  showActions = true,
}: DownloadLinkProps) {
  console.log('[DownloadLink] Rendered', { exportId, fileName });

  const [isDeleting, setIsDeleting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const downloadUrl = `/api/analytics/download/${exportId}`;

  const handleDownload = () => {
    console.log('[DownloadLink] Download clicked', exportId);

    if (onDownload) {
      onDownload();
    }

    window.open(downloadUrl, '_blank');
  };

  const handleCopyLink = async () => {
    console.log('[DownloadLink] Copy link clicked');

    try {
      const fullUrl = `${window.location.origin}${downloadUrl}`;
      await navigator.clipboard.writeText(fullUrl);

      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('[DownloadLink] Copy failed:', error);
    }
  };

  const handleDelete = async () => {
    console.log('[DownloadLink] Delete clicked', exportId);

    if (!confirm('Are you sure you want to delete this export?')) {
      return;
    }

    setIsDeleting(true);

    if (onDelete) {
      onDelete();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  const formatExpiration = (expiresAtStr: string): string => {
    const expiresDate = new Date(expiresAtStr);
    const now = new Date();
    const diffMs = expiresDate.getTime() - now.getTime();

    if (diffMs < 0) {
      return 'Expired';
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 1) {
      return `${diffDays} days`;
    }

    if (diffHours > 1) {
      return `${diffHours} hours`;
    }

    return 'Less than 1 hour';
  };

  const getFormatIcon = () => {
    const className = 'h-5 w-5';
    switch (format) {
      case 'csv':
        return <FileSpreadsheet className={className} />;
      case 'json':
        return <Code className={className} />;
      case 'report':
        return <FileText className={className} />;
    }
  };

  const isExpired = new Date(expiresAt) < new Date();

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-1">{getFormatIcon()}</div>

          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{fileName}</h3>

            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                <span>{formatFileSize(fileSize)}</span>
              </div>

              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  {isExpired ? (
                    <span className="text-destructive">Expired</span>
                  ) : (
                    `Expires in ${formatExpiration(expiresAt)}`
                  )}
                </span>
              </div>

              {downloadCount > 0 && (
                <div className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  <span>{downloadCount} download{downloadCount !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {showActions && !isExpired && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
              disabled={isDeleting}
            >
              <Copy className="h-4 w-4" />
              {copySuccess ? 'Copied!' : ''}
            </Button>

            <Button size="sm" onClick={handleDownload} disabled={isDeleting}>
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>

            {onDelete && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {isExpired && (
          <div className="text-sm text-destructive font-medium">Expired</div>
        )}
      </div>
    </Card>
  );
}
