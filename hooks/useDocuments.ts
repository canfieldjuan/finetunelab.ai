import { useState, useEffect, useCallback } from 'react';
import type { Document } from '@/lib/graphrag/types';
import { supabase } from '@/lib/supabaseClient';

interface UseDocumentsOptions {
  autoFetch?: boolean;
  userId?: string;
  processed?: boolean;
  fileType?: string;
  search?: string;
}

interface UseDocumentsReturn {
  documents: Document[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
}

export function useDocuments(options: UseDocumentsOptions = {}): UseDocumentsReturn {
  const { autoFetch = true, userId, processed, fileType, search } = options;
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Build query params
      const params = new URLSearchParams();
      if (processed !== undefined) params.append('processed', String(processed));
      if (fileType) params.append('fileType', fileType);
      if (search) params.append('search', search);

      const response = await fetch(`/api/graphrag/documents?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.statusText}`);
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, processed, fileType, search]);

  const deleteDocument = useCallback(async (id: string) => {
    if (!userId) return;

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`/api/graphrag/delete/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete document: ${response.statusText}`);
      }

      // Refresh documents list
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error deleting document:', err);
      throw err;
    }
  }, [userId, fetchDocuments]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch) {
      fetchDocuments();
    }
  }, [autoFetch, fetchDocuments]);

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments,
    deleteDocument,
  };
}
