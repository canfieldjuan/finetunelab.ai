'use client';

import { useEffect, useState } from 'react';

interface TrainingStats {
  total_jobs: number;
}

export function TrainingStatsBadge() {
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/training/stats');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.statusText}`);
        }
        
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Failed to fetch training stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm">
        <span className="animate-pulse">📊</span>
        <span className="text-gray-600 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/20 text-sm">
        <span>⚠️</span>
        <span className="text-red-600 dark:text-red-400">Error loading stats</span>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-sm font-medium">
      <span>📊</span>
      <span className="text-blue-700 dark:text-blue-300">
        Training Jobs: {stats.total_jobs}
      </span>
    </div>
  );
}
