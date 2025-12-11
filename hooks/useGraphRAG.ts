import { useState, useCallback } from 'react';
import type { SearchResult } from '@/lib/graphrag/types';

interface UseGraphRAGOptions {
  userId?: string;
}

interface UseGraphRAGReturn {
  search: (query: string) => Promise<SearchResult | null>;
  loading: boolean;
  error: string | null;
  lastResult: SearchResult | null;
}

export function useGraphRAG(options: UseGraphRAGOptions = {}): UseGraphRAGReturn {
  const { userId } = options;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SearchResult | null>(null);

  const search = useCallback(async (query: string): Promise<SearchResult | null> => {
    if (!userId) {
      setError('User ID is required');
      return null;
    }

    if (!query.trim()) {
      setError('Query cannot be empty');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/graphrag/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      const result: SearchResult = {
        context: data.context,
        sources: data.sources,
        metadata: data.metadata,
      };
      
      setLastResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error searching GraphRAG:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    search,
    loading,
    error,
    lastResult,
  };
}
