'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabaseClient';
import { 
  MessageSquare, 
  Reply, 
  Smile,
  MoreVertical,
  Trash2,
  Edit,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ResourceType = 'training_job' | 'training_config' | 'benchmark' | 'dataset' | 'conversation';

interface Comment {
  id: string;
  author_id: string;
  author_email: string;
  author_name: string;
  parent_id: string | null;
  content: string;
  mentions: string[];
  reactions: Record<string, string[]>;
  edited: boolean;
  created_at: string;
  updated_at: string;
  reply_count: number;
}

interface CommentThreadProps {
  resourceType: ResourceType;
  resourceId: string;
  maxDepth?: number;
}

const COMMON_EMOJIS = ['👍', '❤️', '😄', '🎉', '🚀', '👀', '✅', '❌'];

export function CommentThread({ 
  resourceType, 
  resourceId,
  maxDepth = 3 
}: CommentThreadProps) {
  const { currentWorkspace } = useWorkspace();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_resource_comments', {
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_include_replies: true,
      });

      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`comments:${resourceType}:${resourceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'resource_comments',
          filter: `resource_type=eq.${resourceType},resource_id=eq.${resourceId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resourceType, resourceId, fetchComments]);

  const handleSubmitComment = async (parentId: string | null = null) => {
    if (!currentWorkspace || !newComment.trim()) return;

    setSubmitting(true);
    try {
      // Extract @mentions from content
      const mentionRegex = /@(\w+)/g;
      const mentions = Array.from(newComment.matchAll(mentionRegex)).map(m => m[1]);

      const { error } = await supabase
        .from('resource_comments')
        .insert({
          workspace_id: currentWorkspace.id,
          resource_type: resourceType,
          resource_id: resourceId,
          parent_id: parentId,
          content: newComment.trim(),
          mentions: mentions.length > 0 ? JSON.stringify(mentions) : '[]',
        });

      if (error) throw error;

      setNewComment('');
      setReplyingTo(null);
      await fetchComments();
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('resource_comments')
        .update({ content: editContent.trim() })
        .eq('id', commentId);

      if (error) throw error;

      setEditingId(null);
      setEditContent('');
      await fetchComments();
    } catch (err) {
      console.error('Error updating comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const { error } = await supabase
        .from('resource_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      await fetchComments();
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const handleReaction = async (commentId: string, emoji: string) => {
    if (!currentUserId) return;

    try {
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;

      const hasReacted = comment.reactions[emoji]?.includes(currentUserId);

      if (hasReacted) {
        await supabase.rpc('remove_comment_reaction', {
          p_comment_id: commentId,
          p_emoji: emoji,
          p_user_id: currentUserId,
        });
      } else {
        await supabase.rpc('add_comment_reaction', {
          p_comment_id: commentId,
          p_emoji: emoji,
          p_user_id: currentUserId,
        });
      }

      await fetchComments();
    } catch (err) {
      console.error('Error toggling reaction:', err);
    }
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

  const renderComment = (comment: Comment, depth: number = 0) => {
    const isAuthor = currentUserId === comment.author_id;
    const isEditing = editingId === comment.id;
    const canReply = depth < maxDepth;

    return (
      <div key={comment.id} className="group">
        <div className="flex gap-3">
          {/* Author Avatar */}
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
              {comment.author_name[0].toUpperCase()}
            </div>
          </div>

          {/* Comment Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{comment.author_name}</span>
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(comment.created_at)}
              </span>
              {comment.edited && (
                <span className="text-xs text-muted-foreground italic">(edited)</span>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleUpdateComment(comment.id)}
                    disabled={submitting || !editContent.trim()}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setEditContent('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {comment.content}
                </p>

                {/* Reactions */}
                <div className="flex items-center gap-2 mt-2">
                  {Object.entries(comment.reactions).map(([emoji, userIds]) => {
                    if (userIds.length === 0) return null;
                    const hasReacted = userIds.includes(currentUserId || '');
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(comment.id, emoji)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                          hasReacted
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span>{userIds.length}</span>
                      </button>
                    );
                  })}

                  {/* Reaction Picker */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-muted hover:bg-muted/80 transition-colors opacity-0 group-hover:opacity-100">
                        <Smile className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {COMMON_EMOJIS.map((emoji) => (
                        <DropdownMenuItem
                          key={emoji}
                          onClick={() => handleReaction(comment.id, emoji)}
                          className="text-lg cursor-pointer"
                        >
                          {emoji}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Actions */}
                  {canReply && (
                    <button
                      onClick={() => setReplyingTo(comment.id)}
                      className="text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                    >
                      <Reply className="h-3 w-3" />
                      Reply
                    </button>
                  )}

                  {isAuthor && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingId(comment.id);
                            setEditContent(comment.content);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </>
            )}

            {/* Reply Form */}
            {replyingTo === comment.id && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={`Reply to ${comment.author_name}...`}
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSubmitComment(comment.id)}
                    disabled={submitting || !newComment.trim()}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReplyingTo(null);
                      setNewComment('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nested Replies */}
        {comment.reply_count > 0 && depth < maxDepth && (
          <div className="ml-11 mt-3 space-y-3 border-l-2 border-muted pl-4">
            {comments
              .filter(c => c.parent_id === comment.id)
              .map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/4 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const topLevelComments = comments.filter(c => c.parent_id === null);

  return (
    <div className="space-y-6">
      {/* New Comment Form */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4" />
          <span>Comments ({comments.length})</span>
        </div>
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment... (use @username to mention someone)"
          rows={3}
        />
        <Button
          onClick={() => handleSubmitComment(null)}
          disabled={submitting || !newComment.trim()}
        >
          <Send className="h-4 w-4 mr-2" />
          Post Comment
        </Button>
      </div>

      {/* Comments List */}
      {topLevelComments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No comments yet</p>
          <p className="text-sm">Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {topLevelComments.map(comment => renderComment(comment, 0))}
        </div>
      )}
    </div>
  );
}
