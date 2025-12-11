/**
 * useArchive Hook
 *
 * React hook for managing conversation archiving and restoration
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { ConversationData } from '@/lib/export/types';

interface ArchiveOptions {
  conversationIds: string[];
  permanentDelete?: boolean;
}

interface RestoreOptions {
  conversationIds: string[];
}

interface ArchiveResult {
  archivedCount: number;
  archivedIds: string[];
  errors: Array<{ id: string; error: string }>;
}

interface RestoreResult {
  restoredCount: number;
  restoredIds: string[];
  errors: Array<{ id: string; error: string }>;
}

interface UseArchiveReturn {
  loading: boolean;
  error: string | null;
  archived: ConversationData[];
  archive: (options: ArchiveOptions) => Promise<ArchiveResult>;
  restore: (options: RestoreOptions) => Promise<RestoreResult>;
  fetchArchived: () => Promise<void>;
  clearError: () => void;
}

export function useArchive(): UseArchiveReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archived, setArchived] = useState<ConversationData[]>([]);

  const archive = useCallback(async (options: ArchiveOptions): Promise<ArchiveResult> => {
    setLoading(true);
    setError(null);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call archive API
      const response = await fetch('/api/export/archive', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to archive conversations');
      }

      const data = await response.json();
      return data as ArchiveResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error archiving conversations:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchArchived = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call list archived API
      const response = await fetch('/api/export/archive', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to fetch archived conversations');
      }

      const data = await response.json();
      setArchived(data.archived || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching archived conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const restore = useCallback(async (options: RestoreOptions): Promise<RestoreResult> => {
    setLoading(true);
    setError(null);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call restore API
      const response = await fetch('/api/export/archive', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to restore conversations');
      }

      const data = await response.json();

      // Refresh archived list
      await fetchArchived();

      return data as RestoreResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error restoring conversations:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchArchived]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    archived,
    archive,
    restore,
    fetchArchived,
    clearError,
  };
}
