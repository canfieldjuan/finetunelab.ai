'use client';

// Export History Component
// List and manage user's past exports
// Date: October 25, 2025

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DownloadLink } from './DownloadLink';
import { RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { ExportRecord } from './types';

export interface ExportHistoryProps {
  userId: string;
  limit?: number;
  showExpired?: boolean;
  onRefresh?: () => void;
}

export function ExportHistory({
  userId,
  limit = 50,
  showExpired = false,
  onRefresh,
}: ExportHistoryProps) {
  console.log('[ExportHistory] Initialized', { userId, limit, showExpired });

  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExportHistory = useCallback(async () => {
    console.log('[ExportHistory] Fetching export history');
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('analytics_exports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!showExpired) {
        query = query.gt('expires_at', new Date().toISOString());
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('[ExportHistory] Fetch error:', fetchError);
        throw fetchError;
      }

      console.log('[ExportHistory] Fetched exports:', data?.length || 0);
      setExports(data || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load exports';
      console.error('[ExportHistory] Error:', errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [userId, limit, showExpired]);

  useEffect(() => {
    fetchExportHistory();
  }, [fetchExportHistory]);

  const handleRefresh = () => {
    console.log('[ExportHistory] Refresh clicked');

    if (onRefresh) {
      onRefresh();
    }

    fetchExportHistory();
  };

  const handleDelete = async (exportId: string) => {
    console.log('[ExportHistory] Delete requested', exportId);

    try {
      const { error: deleteError } = await supabase
        .from('analytics_exports')
        .delete()
        .eq('id', exportId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('[ExportHistory] Delete error:', deleteError);
        throw deleteError;
      }

      console.log('[ExportHistory] Export deleted successfully');
      setExports(exports.filter((exp) => exp.id !== exportId));
    } catch (err) {
      console.error('[ExportHistory] Delete failed:', err);
      alert('Failed to delete export. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading export history...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <p className="text-destructive mb-4">Error: {error}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (exports.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          <p className="mb-4">No exports found</p>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Export History ({exports.length})
        </h3>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {exports.map((exportRecord) => (
          <DownloadLink
            key={exportRecord.id}
            exportId={exportRecord.id}
            fileName={exportRecord.file_name}
            fileSize={exportRecord.file_size}
            format={exportRecord.format}
            expiresAt={exportRecord.expires_at}
            downloadCount={exportRecord.download_count}
            onDelete={() => handleDelete(exportRecord.id)}
          />
        ))}
      </div>
    </div>
  );
}
