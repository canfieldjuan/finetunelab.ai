'use client';

import { useState } from 'react';
import { Share2, Users, CheckCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useWorkspace } from '@/contexts/WorkspaceContext';

type ResourceType = 'training_job' | 'training_config' | 'benchmark' | 'dataset' | 'conversation';
type Permission = 'view' | 'comment' | 'edit';

interface ShareResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
}

export function ShareResourceDialog({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  resourceName,
}: ShareResourceDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(['view']);
  const [notes, setNotes] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const resourceTypeLabels: Record<ResourceType, string> = {
    training_job: 'Training Run',
    training_config: 'Training Config',
    benchmark: 'Benchmark',
    dataset: 'Dataset',
    conversation: 'Conversation',
  };

  const permissionDescriptions: Record<Permission, string> = {
    view: 'Can view this resource',
    comment: 'Can add comments and reactions',
    edit: 'Can modify this resource',
  };

  const togglePermission = (permission: Permission) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(permission)) {
        // Can't uncheck 'view' if it's the only one
        if (prev.length === 1 && permission === 'view') return prev;
        return prev.filter((p) => p !== permission);
      } else {
        // Auto-include 'view' when selecting comment or edit
        if (permission !== 'view' && !prev.includes('view')) {
          return [...prev, 'view', permission];
        }
        return [...prev, permission];
      }
    });
  };

  const handleShare = async () => {
    if (!currentWorkspace) return;

    setIsSharing(true);
    setShareStatus('idle');

    try {
      const response = await fetch(`/api/workspaces/${currentWorkspace.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceType,
          resourceId,
          permissions: selectedPermissions,
          notes: notes.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to share resource');
      }

      setShareStatus('success');
      
      // Reset form after 1.5 seconds and close
      setTimeout(() => {
        setNotes('');
        setSelectedPermissions(['view']);
        setShareStatus('idle');
        onOpenChange(false);
      }, 1500);
    } catch (error) {
      console.error('Error sharing resource:', error);
      setShareStatus('error');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCancel = () => {
    setNotes('');
    setSelectedPermissions(['view']);
    setShareStatus('idle');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share {resourceTypeLabels[resourceType]}
          </DialogTitle>
          <DialogDescription>
            {`Share "${resourceName}" with your workspace team`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Workspace Info */}
          <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/50">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Sharing to workspace</p>
              <p className="text-sm text-muted-foreground">
                {currentWorkspace?.name || 'Current Workspace'}
              </p>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-3">
            <Label>Permissions</Label>
            <div className="space-y-2">
              {(['view', 'comment', 'edit'] as Permission[]).map((permission) => (
                <div key={permission} className="flex items-start gap-3">
                  <Checkbox
                    id={`permission-${permission}`}
                    checked={selectedPermissions.includes(permission)}
                    onCheckedChange={() => togglePermission(permission)}
                    disabled={permission === 'view' && selectedPermissions.length === 1}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={`permission-${permission}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize cursor-pointer"
                    >
                      {permission}
                    </label>
                    <p className="text-sm text-muted-foreground">
                      {permissionDescriptions[permission]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add a note about why you're sharing this..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {notes.length}/500 characters
            </p>
          </div>

          {/* Status Messages */}
          {shareStatus === 'success' && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-3 text-sm text-green-800 dark:text-green-200">
              <CheckCircle className="h-4 w-4" />
              <span>Resource shared successfully!</span>
            </div>
          )}

          {shareStatus === 'error' && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-3 text-sm text-red-800 dark:text-red-200">
              <AlertCircle className="h-4 w-4" />
              <span>Failed to share resource. Please try again.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSharing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={isSharing || selectedPermissions.length === 0}
          >
            {isSharing ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Sharing...
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 mr-2" />
                Share Resource
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
