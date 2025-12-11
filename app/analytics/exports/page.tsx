'use client';

// Analytics Exports Management Page
// Dedicated page for viewing and managing analytics exports
// Date: October 25, 2025

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { ExportButton } from '@/components/analytics/ExportButton';
import { ExportHistory } from '@/components/analytics/ExportHistory';
import { supabase } from '@/lib/supabaseClient';
import { BarChart3, HardDrive, Download, FileText } from 'lucide-react';

interface ExportStats {
  totalExports: number;
  totalSizeMB: number;
  mostCommonFormat: string;
  exportsThisMonth: number;
}

export default function ExportsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchExportStats = useCallback(async (uid: string) => {
    console.log('[ExportsPage] Fetching export statistics');

    try {
      const { data: exports, error } = await supabase
        .from('analytics_exports')
        .select('format, file_size, created_at')
        .eq('user_id', uid);

      if (error) {
        console.error('[ExportsPage] Stats fetch error:', error);
        return;
      }

      if (!exports || exports.length === 0) {
        setStats({
          totalExports: 0,
          totalSizeMB: 0,
          mostCommonFormat: 'N/A',
          exportsThisMonth: 0,
        });
        return;
      }

      const totalSizeBytes = exports.reduce((sum, exp) => sum + exp.file_size, 0);
      const totalSizeMB = Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100;

      const formatCounts = exports.reduce((acc, exp) => {
        acc[exp.format] = (acc[exp.format] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostCommonFormat =
        Object.keys(formatCounts).length > 0
          ? Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0][0]
          : 'N/A';

      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);

      const exportsThisMonth = exports.filter(
        (exp) => new Date(exp.created_at) >= thisMonthStart
      ).length;

      setStats({
        totalExports: exports.length,
        totalSizeMB,
        mostCommonFormat: mostCommonFormat.toUpperCase(),
        exportsThisMonth,
      });

      console.log('[ExportsPage] Stats loaded');
    } catch (error) {
      console.error('[ExportsPage] Stats calculation error:', error);
    }
  }, []);

  const initializePage = useCallback(async () => {
    console.log('[ExportsPage] Initializing');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error('[ExportsPage] No user found');
        return;
      }

      setUserId(user.id);
      await fetchExportStats(user.id);
    } catch (error) {
      console.error('[ExportsPage] Initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchExportStats]);

  useEffect(() => {
    initializePage();
  }, [initializePage]);

  const handleRefresh = () => {
    console.log('[ExportsPage] Refresh requested');

    if (userId) {
      fetchExportStats(userId);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-8">
          <p className="text-center text-destructive">
            Please sign in to access exports
          </p>
        </Card>
      </div>
    );
  }

  const defaultDateRange = {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Analytics Exports</h1>
          <p className="text-muted-foreground mt-1">
            Manage and download your analytics data exports
          </p>
        </div>

        <ExportButton
          userId={userId}
          dateRange={defaultDateRange}
          onExportCreated={handleRefresh}
        />
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Exports</p>
                <p className="text-2xl font-bold">{stats.totalExports}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <HardDrive className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Size</p>
                <p className="text-2xl font-bold">{stats.totalSizeMB} MB</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Most Used</p>
                <p className="text-2xl font-bold">{stats.mostCommonFormat}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">{stats.exportsThisMonth}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <ExportHistory userId={userId} onRefresh={handleRefresh} />
    </div>
  );
}
