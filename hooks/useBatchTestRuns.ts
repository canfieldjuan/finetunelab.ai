/**
 * useBatchTestRuns Hook
 *
 * React hook for managing batch test run operations (archive, restore, delete)
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ArchiveOptions {
  testRunIds: string[];
}

interface RestoreOptions {
  testRunIds: string[];
}

interface DeleteOptions {
  testRunIds: string[];
}

interface OperationResult {
  count: number;
  ids: string[];
  errors: Array<{ id: string; error: string }>;
}

interface UseBatchTestRunsReturn {
  loading: boolean;
  error: string | null;
  archive: (options: ArchiveOptions) => Promise<OperationResult>;
  restore: (options: RestoreOptions) => Promise<OperationResult>;
  permanentDelete: (options: DeleteOptions) => Promise<OperationResult>;
  clearError: () => void;
}

export function useBatchTestRuns(): UseBatchTestRunsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const archive = useCallback(async (options: ArchiveOptions): Promise<OperationResult> => {
    setLoading(true);
    setError(null);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call archive API
      const response = await fetch('/api/batch-testing/archive', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to archive test runs');
      }

      const data = await response.json();
      return {
        count: data.archivedCount || 0,
        ids: data.archivedIds || [],
        errors: []
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useBatchTestRuns] Archive error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const restore = useCallback(async (options: RestoreOptions): Promise<OperationResult> => {
    setLoading(true);
    setError(null);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call restore API
      const response = await fetch('/api/batch-testing/archive', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to restore test runs');
      }

      const data = await response.json();
      return {
        count: data.restoredCount || 0,
        ids: data.restoredIds || [],
        errors: []
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useBatchTestRuns] Restore error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const permanentDelete = useCallback(async (options: DeleteOptions): Promise<OperationResult> => {
    setLoading(true);
    setError(null);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call delete API
      const response = await fetch('/api/batch-testing/archive', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to delete test runs');
      }

      const data = await response.json();
      return {
        count: data.deletedCount || 0,
        ids: data.deletedIds || [],
        errors: []
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useBatchTestRuns] Delete error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    archive,
    restore,
    permanentDelete,
    clearError,
  };
}
