'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabaseClient';
import { 
  Bell,
  MessageSquare,
  Share2,
  PlayCircle,
  CheckCircle,
  XCircle,
  UserPlus,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

export function NotificationCenter() {
  const { currentWorkspace } = useWorkspace();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!currentWorkspace) return;

    try {
      const { data, error } = await supabase.rpc('get_notifications', {
        p_workspace_id: currentWorkspace.id,
        p_limit: 20,
        p_offset: 0,
      });

      if (error) {
        console.error('Error fetching notifications:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      // Don't throw - fail silently to avoid breaking the UI
    }
  }, [currentWorkspace]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!currentWorkspace) return;

    try {
      const { data, error } = await supabase.rpc('get_unread_count', {
        p_workspace_id: currentWorkspace.id,
      });

      if (error) {
        console.error('Error fetching unread count:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
      setUnreadCount(data || 0);
    } catch (err) {
      console.error('Error fetching unread count:', err);
      // Don't throw - fail silently to avoid breaking the UI
    }
  }, [currentWorkspace]);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!currentWorkspace) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'workspace_notifications',
          filter: `workspace_id=eq.${currentWorkspace.id}`,
        },
        () => {
          fetchNotifications();
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspace_notifications',
          filter: `workspace_id=eq.${currentWorkspace.id}`,
        },
        () => {
          fetchNotifications();
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWorkspace, fetchNotifications, fetchUnreadCount]);

  const handleMarkAsRead = async (notificationIds: string[]) => {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_ids: notificationIds,
      });

      if (error) {
        console.error('Error marking notification as read:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          notificationIds,
        });
        throw error;
      }
      await fetchNotifications();
      await fetchUnreadCount();
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // Don't throw - fail silently to avoid breaking the UI
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentWorkspace) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read', {
        p_workspace_id: currentWorkspace.id,
      });

      if (error) {
        console.error('Error marking all as read:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          workspaceId: currentWorkspace.id,
        });
        throw error;
      }
      await fetchNotifications();
      await fetchUnreadCount();
    } catch (err) {
      console.error('Error marking all as read:', err);
      // Don't throw - fail silently to avoid breaking the UI
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      await handleMarkAsRead([notification.id]);
    }

    // Navigate to resource (you can implement this based on your routing)
    // For now, just close the dropdown
    setOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    if (type.includes('mention') || type.includes('reply')) return <MessageSquare className="h-4 w-4" />;
    if (type.includes('shared')) return <Share2 className="h-4 w-4" />;
    if (type.includes('started')) return <PlayCircle className="h-4 w-4" />;
    if (type.includes('completed') || type.includes('passed')) return <CheckCircle className="h-4 w-4" />;
    if (type.includes('failed') || type.includes('cancelled')) return <XCircle className="h-4 w-4" />;
    if (type.includes('invite') || type.includes('joined')) return <UserPlus className="h-4 w-4" />;
    return <Bell className="h-4 w-4" />;
  };

  const getNotificationColor = (type: string) => {
    if (type.includes('completed') || type.includes('passed')) return 'text-green-600 dark:text-green-400';
    if (type.includes('failed') || type.includes('cancelled')) return 'text-red-600 dark:text-red-400';
    if (type.includes('started')) return 'text-blue-600 dark:text-blue-400';
    if (type.includes('mention') || type.includes('reply')) return 'text-purple-600 dark:text-purple-400';
    return 'text-muted-foreground';
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

  if (!currentWorkspace) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-3.5 w-3.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px] max-h-[500px] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-2 py-2 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({unreadCount} unread)
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={loading}
              className="h-7 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <>
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`flex gap-3 p-3 cursor-pointer ${
                  !notification.read ? 'bg-primary/5' : ''
                }`}
              >
                <div className={`mt-1 flex-shrink-0 ${getNotificationColor(notification.type)}`}>
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium leading-snug ${
                      !notification.read ? 'font-semibold' : ''
                    }`}>
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(notification.created_at)}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}

            {notifications.length >= 20 && (
              <>
                <DropdownMenuSeparator />
                <div className="p-2 text-center">
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    View all notifications
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
