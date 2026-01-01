// Schedule Run History Component
// Purpose: Display execution history for a scheduled evaluation
// Date: 2025-12-16

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { ScheduledEvaluationRun } from '@/lib/batch-testing/types';

interface ScheduleRunHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: string | null;
  scheduleName?: string;
}

export function ScheduleRunHistory({
  open,
  onOpenChange,
  scheduleId,
  scheduleName,
}: ScheduleRunHistoryProps) {
  const [runs, setRuns] = useState<ScheduledEvaluationRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && scheduleId) {
      fetchRuns();
    }
  }, [open, scheduleId]);

  const fetchRuns = async () => {
    if (!scheduleId) return;

    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(
        `/api/scheduled-evaluations/${scheduleId}/runs?limit=50&offset=0`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch run history');
      }

      const data = await response.json();
      setRuns(data.data || []);

    } catch (err) {
      console.error('Error fetching run history:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch run history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      triggered: { variant: 'outline', icon: Clock, label: 'Triggered' },
      running: { variant: 'default', icon: RefreshCw, label: 'Running' },
      completed: { variant: 'outline', icon: CheckCircle, label: 'Completed' },
      failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
      cancelled: { variant: 'secondary', icon: XCircle, label: 'Cancelled' },
    };

    const config = statusConfig[status] || statusConfig.triggered;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDuration = (triggeredAt: string, completedAt?: string) => {
    if (!completedAt) return '-';

    const start = new Date(triggeredAt).getTime();
    const end = new Date(completedAt).getTime();
    const durationMs = end - start;

    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getSuccessRate = (run: ScheduledEvaluationRun) => {
    if (!run.total_prompts || run.total_prompts === 0) return null;
    const rate = ((run.successful_prompts || 0) / run.total_prompts) * 100;
    return Math.round(rate);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Run History</DialogTitle>
          <DialogDescription>
            {scheduleName ? `Execution history for "${scheduleName}"` : 'Execution history'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No runs yet</h3>
            <p className="text-muted-foreground">
              This schedule hasn't executed yet. Runs will appear here once the schedule triggers.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Triggered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Results</TableHead>
                  <TableHead>Avg Latency</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Regression</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const successRate = getSuccessRate(run);

                  return (
                    <TableRow key={run.id}>
                      <TableCell className="text-sm">
                        {formatTimestamp(run.triggered_at)}
                      </TableCell>
                      <TableCell>{getStatusBadge(run.status)}</TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(run.triggered_at, run.completed_at)}
                      </TableCell>
                      <TableCell>
                        {run.total_prompts ? (
                          <div className="text-sm">
                            <div>
                              {run.successful_prompts || 0} / {run.total_prompts}
                            </div>
                            {successRate !== null && (
                              <div className="text-xs text-muted-foreground">
                                {successRate}% success
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.avg_latency_ms
                          ? `${Math.round(run.avg_latency_ms)}ms`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.avg_quality_score !== null && run.avg_quality_score !== undefined
                          ? `${(run.avg_quality_score * 100).toFixed(1)}%`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {run.regression_detected ? (
                          <Badge variant="destructive" className="gap-1">
                            <TrendingDown className="w-3 h-3" />
                            Detected
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {run.batch_test_run_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              window.open(`/testing?run=${run.batch_test_run_id}`, '_blank');
                            }}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        {run.error_message && (
                          <div className="mt-2">
                            <div className="text-xs text-destructive p-2 bg-destructive/10 rounded">
                              <strong>Error:</strong> {run.error_message}
                            </div>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={fetchRuns} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
