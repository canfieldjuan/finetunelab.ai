// Scheduled Evaluation List Component
// Purpose: Display and manage scheduled batch test evaluations
// Date: 2025-12-16

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Clock,
  Play,
  Pause,
  Edit,
  Trash2,
  History,
  Plus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { ScheduledEvaluation } from '@/lib/batch-testing/types';

interface ScheduledEvaluationListProps {
  onCreateNew: () => void;
  onEdit: (schedule: ScheduledEvaluation) => void;
  onViewHistory: (scheduleId: string) => void;
}

export function ScheduledEvaluationList({
  onCreateNew,
  onEdit,
  onViewHistory,
}: ScheduledEvaluationListProps) {
  const [schedules, setSchedules] = useState<ScheduledEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<ScheduledEvaluation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch schedules
  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch('/api/scheduled-evaluations', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch scheduled evaluations');
      }

      const data = await response.json();
      setSchedules(data.data || []);

    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (schedule: ScheduledEvaluation) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/scheduled-evaluations/${schedule.id}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to toggle schedule');
      }

      const data = await response.json();

      // Update local state
      setSchedules(prev =>
        prev.map(s => s.id === schedule.id ? data.data : s)
      );

    } catch (err) {
      console.error('Error toggling schedule:', err);
      alert(err instanceof Error ? err.message : 'Failed to toggle schedule');
    }
  };

  const handleDeleteClick = (schedule: ScheduledEvaluation) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!scheduleToDelete) return;

    try {
      setDeleting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/scheduled-evaluations/${scheduleToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete schedule');
      }

      // Remove from local state
      setSchedules(prev => prev.filter(s => s.id !== scheduleToDelete.id));
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);

    } catch (err) {
      console.error('Error deleting schedule:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete schedule');
    } finally {
      setDeleting(false);
    }
  };

  const formatNextRun = (nextRunAt: string) => {
    const date = new Date(nextRunAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    // If in the past or very soon
    if (diff < 60000) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Due now</Badge>;
    }

    // Format relative time
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours < 1) {
      return `${minutes}m`;
    } else if (hours < 24) {
      return `${hours}h ${minutes}m`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
  };

  const getScheduleTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'hourly': 'Hourly',
      'daily': 'Daily',
      'weekly': 'Weekly',
      'custom': 'Custom',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (schedule: ScheduledEvaluation) => {
    if (!schedule.is_active) {
      return <Badge variant="secondary">Paused</Badge>;
    }

    if (schedule.consecutive_failures >= 3) {
      return <Badge variant="destructive">Failed</Badge>;
    }

    if (schedule.last_run_status === 'failed') {
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">Warning</Badge>;
    }

    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Active</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Evaluations</CardTitle>
          <CardDescription>Loading scheduled evaluations...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Evaluations</CardTitle>
          <CardDescription>Error loading scheduled evaluations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <Button onClick={fetchSchedules} variant="outline" className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheduled Evaluations</CardTitle>
              <CardDescription>
                Manage recurring batch test evaluations
              </CardDescription>
            </div>
            <Button onClick={onCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              New Schedule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No scheduled evaluations</h3>
              <p className="text-muted-foreground mb-4">
                Create your first scheduled evaluation to automate model monitoring
              </p>
              <Button onClick={onCreateNew}>
                <Plus className="w-4 h-4 mr-2" />
                Create Schedule
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">
                        {schedule.name}
                        {schedule.description && (
                          <div className="text-sm text-muted-foreground">
                            {schedule.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getScheduleTypeLabel(schedule.schedule_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {schedule.model_id}
                      </TableCell>
                      <TableCell>
                        {formatNextRun(schedule.next_run_at)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(schedule)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={schedule.is_active}
                          onCheckedChange={() => handleToggle(schedule)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewHistory(schedule.id)}
                            title="View history"
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(schedule)}
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(schedule)}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scheduled Evaluation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{scheduleToDelete?.name}</strong>?
              This will also delete all run history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
