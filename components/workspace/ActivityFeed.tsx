'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabaseClient';
import { 
  Activity, 
  Share2, 
  MessageSquare, 
  Upload, 
  PlayCircle, 
  CheckCircle, 
  XCircle, 
  UserPlus, 
  UserMinus,
  Clock,
} from 'lucide-react';

interface WorkspaceActivity {
  id: string;
  activity_type: string;
  actor_email: string;
  actor_name: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ActivityFeedProps {
  limit?: number;
  height?: string;
  showLoadMore?: boolean;
}

export function ActivityFeed({ 
  limit = 50, 
  height = '600px',
  showLoadMore = true 
}: ActivityFeedProps) {
  const { currentWorkspace } = useWorkspace();
  
  const [activities, setActivities] = useState<WorkspaceActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch activities
  const fetchActivities = useCallback(async (offset = 0) => {
    if (!currentWorkspace) return;

    try {
      const { data, error } = await supabase.rpc('get_workspace_activity_feed', {
        p_workspace_id: currentWorkspace.id,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        // Check if it's a 404 (RPC function doesn't exist)
        if (error.code === 'PGRST204' || error.message?.includes('404')) {
          console.warn('[ActivityFeed] RPC function not found - feature not yet configured');
          setError(null); // Don't show error, just show empty state
          setActivities([]);
          setHasMore(false);
          return;
        }
        throw error;
      }

      if (offset === 0) {
        setActivities(data || []);
      } else {
        setActivities(prev => [...prev, ...(data || [])]);
      }

      setHasMore((data?.length || 0) === limit);
      setError(null);
    } catch (err) {
      // Properly serialize the error for logging
      const errorMessage = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null)
          ? JSON.stringify(err)
          : String(err);

      console.error('[ActivityFeed] Error fetching activity feed:', errorMessage);

      // Check if it's a 404 error (RPC doesn't exist)
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        console.warn('[ActivityFeed] RPC function not found - activity feed disabled');
        setError(null); // Don't show error UI for missing RPC
        setActivities([]);
      } else {
        setError('Failed to load activity feed');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentWorkspace, limit]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchActivities(0);
  }, [fetchActivities]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!currentWorkspace) return;

    const channel = supabase
      .channel(`workspace_activity:${currentWorkspace.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'workspace_activity',
          filter: `workspace_id=eq.${currentWorkspace.id}`,
        },
        async () => {
          try {
            // Fetch the full activity with actor details
            const { data, error } = await supabase.rpc('get_workspace_activity_feed', {
              p_workspace_id: currentWorkspace.id,
              p_limit: 1,
              p_offset: 0,
            });

            // Silently ignore if RPC doesn't exist
            if (error && (error.code === 'PGRST204' || error.message?.includes('404'))) {
              return;
            }

            if (data && data.length > 0) {
              setActivities(prev => [data[0], ...prev]);
            }
          } catch (err) {
            // Silently ignore realtime fetch errors - properly serialize for logging
            const errorMsg = err instanceof Error
              ? err.message
              : (typeof err === 'object' && err !== null)
                ? JSON.stringify(err)
                : String(err);
            console.warn('[ActivityFeed] Realtime fetch skipped:', errorMsg);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWorkspace]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    fetchActivities(activities.length);
  };

  const getActivityIcon = (activityType: string) => {
    if (activityType.startsWith('shared_')) return <Share2 className="h-4 w-4" />;
    if (activityType.startsWith('commented_')) return <MessageSquare className="h-4 w-4" />;
    if (activityType.startsWith('created_') || activityType === 'uploaded_dataset') return <Upload className="h-4 w-4" />;
    if (activityType.startsWith('started_')) return <PlayCircle className="h-4 w-4" />;
    if (activityType.startsWith('completed_') || activityType.startsWith('passed_')) return <CheckCircle className="h-4 w-4" />;
    if (activityType.startsWith('failed_') || activityType.startsWith('cancelled_')) return <XCircle className="h-4 w-4" />;
    if (activityType === 'user_joined' || activityType === 'invited_user') return <UserPlus className="h-4 w-4" />;
    if (activityType === 'user_left') return <UserMinus className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const getActivityColor = (activityType: string) => {
    if (activityType.startsWith('completed_') || activityType.startsWith('passed_')) return 'text-green-600 dark:text-green-400';
    if (activityType.startsWith('failed_') || activityType.startsWith('cancelled_')) return 'text-red-600 dark:text-red-400';
    if (activityType.startsWith('started_')) return 'text-blue-600 dark:text-blue-400';
    if (activityType.startsWith('shared_')) return 'text-purple-600 dark:text-purple-400';
    return 'text-muted-foreground';
  };

  const formatActivityMessage = (activity: WorkspaceActivity) => {
    const type = activity.activity_type;
    const name = activity.actor_name;

    // Sharing activities
    if (type === 'shared_training') return `${name} shared a training run`;
    if (type === 'shared_config') return `${name} shared a training config`;
    if (type === 'shared_benchmark') return `${name} shared a benchmark`;
    if (type === 'shared_dataset') return `${name} shared a dataset`;
    if (type === 'shared_conversation') return `${name} shared a conversation`;
    if (type === 'unshared_resource') return `${name} unshared a resource`;

    // Comment activities
    if (type === 'commented_on_training') return `${name} commented on a training run`;
    if (type === 'commented_on_benchmark') return `${name} commented on a benchmark`;
    if (type === 'commented_on_dataset') return `${name} commented on a dataset`;
    if (type === 'replied_to_comment') return `${name} replied to a comment`;

    // Creation activities
    if (type === 'created_config') return `${name} created a training config`;
    if (type === 'created_benchmark') return `${name} created a benchmark`;
    if (type === 'uploaded_dataset') return `${name} uploaded a dataset`;

    // Training activities
    if (type === 'started_training') return `${name} started a training run`;
    if (type === 'completed_training') {
      const accuracy = activity.metadata?.accuracy;
      return accuracy && typeof accuracy === 'number'
        ? `${name} completed training (accuracy: ${(accuracy * 100).toFixed(1)}%)`
        : `${name} completed a training run`;
    }
    if (type === 'failed_training') return `${name}'s training run failed`;
    if (type === 'cancelled_training') return `${name} cancelled a training run`;

    // Benchmark activities
    if (type === 'created_benchmark') return `${name} created a benchmark`;
    if (type === 'ran_benchmark') return `${name} ran a benchmark`;
    if (type === 'passed_benchmark') {
      const score = activity.metadata?.score;
      return score && typeof score === 'number'
        ? `${name}'s benchmark passed (score: ${score.toFixed(1)})`
        : `${name}'s benchmark passed`;
    }
    if (type === 'failed_benchmark') return `${name}'s benchmark failed`;

    // Workspace activities
    if (type === 'invited_user') return `${name} invited a new member`;
    if (type === 'user_joined') return `${name} joined the workspace`;
    if (type === 'user_left') return `${name} left the workspace`;
    if (type === 'role_changed') return `${name} changed a member's role`;

    return `${name} performed an action`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No workspace selected</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/4 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <XCircle className="h-8 w-8 mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Activity className="h-12 w-12 mb-2 opacity-50" />
        <p className="text-lg font-medium">No activity yet</p>
        <p className="text-sm">Start sharing resources to see activity here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-y-auto" style={{ height }}>
        <div className="space-y-1 p-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className={`mt-1 ${getActivityColor(activity.activity_type)}`}>
                {getActivityIcon(activity.activity_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug">
                  {formatActivityMessage(activity)}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatTimestamp(activity.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showLoadMore && hasMore && (
        <div className="p-4 border-t">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load more activity'}
          </button>
        </div>
      )}
    </div>
  );
}
