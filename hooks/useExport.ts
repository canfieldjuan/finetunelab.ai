/**
 * useExport Hook
 *
 * React hook for managing conversation exports
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { ExportFormat, ExportResult, ExportOptions } from '@/lib/export/types';

interface GenerateExportOptions {
  conversationIds: string[];
  format: ExportFormat;
  includeMetadata?: boolean;
  includeSystemMessages?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  title?: string;
}

interface UseExportReturn {
  exporting: boolean;
  error: string | null;
  result: ExportResult | null;
  generateExport: (options: GenerateExportOptions) => Promise<ExportResult>;
  downloadExport: (exportId: string) => Promise<void>;
  clearError: () => void;
}

export function useExport(): UseExportReturn {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  const generateExport = useCallback(async (options: GenerateExportOptions): Promise<ExportResult> => {
    setExporting(true);
    setError(null);
    setResult(null);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Prepare request body
      const body: ExportOptions = {
        conversationIds: options.conversationIds,
        format: options.format,
        includeMetadata: options.includeMetadata ?? true,
        includeSystemMessages: options.includeSystemMessages ?? false,
        dateRange: options.dateRange,
        title: options.title,
      };

      // Call export API
      const response = await fetch('/api/export/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to generate export');
      }

      const data = await response.json();
      const exportResult = data.export as ExportResult;

      setResult(exportResult);
      return exportResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error generating export:', err);
      throw err;
    } finally {
      setExporting(false);
    }
  }, []);

  const downloadExport = useCallback(async (exportId: string): Promise<void> => {
    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call download API
      const response = await fetch(`/api/export/download/${exportId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download export');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `export_${exportId}`;

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error downloading export:', err);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    exporting,
    error,
    result,
    generateExport,
    downloadExport,
    clearError,
  };
}
