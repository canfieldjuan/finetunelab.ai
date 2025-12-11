// Config Name Dialog Component
// Purpose: Dialog for naming new training configurations with metadata preview
// Date: 2025-11-11

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Calendar, FileText, Hash } from 'lucide-react';

console.log('[ConfigNameDialog] Component loaded');

interface ConfigNameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (configName: string) => void;
  templateName: string;
  templateType: string;
  isCreating?: boolean;
}

export function ConfigNameDialog({
  isOpen,
  onClose,
  onConfirm,
  templateName,
  isCreating = false,
}: ConfigNameDialogProps) {
  const [configName, setConfigName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Format current date
  const currentDate = new Date().toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  // Generate short ID preview (will be replaced by actual UUID from backend)
  const shortIdPreview = Math.random().toString(36).substring(2, 8);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setConfigName('');
      setError(null);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    const trimmedName = configName.trim();
    
    if (!trimmedName) {
      setError('Configuration name is required');
      return;
    }

    if (trimmedName.length < 3) {
      setError('Name must be at least 3 characters');
      return;
    }

    if (trimmedName.length > 100) {
      setError('Name must be less than 100 characters');
      return;
    }

    onConfirm(trimmedName);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating) {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg animate-in zoom-in-95">
        <div className="bg-background border rounded-lg shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-semibold">Create Training Configuration</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
              disabled={isCreating}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Template Display */}
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Selected Template</p>
              <p className="font-medium">{templateName}</p>
            </div>

            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="config-name" className="text-sm font-medium">
                Configuration Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="config-name"
                type="text"
                value={configName}
                onChange={(e) => {
                  setConfigName(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Fine-tune Llama for Code, Sales Chat Model v2"
                className={error ? 'border-destructive' : ''}
                autoFocus
                disabled={isCreating}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Choose a memorable name to easily identify this configuration later
              </p>
            </div>

            {/* Metadata Preview */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Configuration Metadata (auto-generated)
              </p>
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Template:</span>
                  <span className="font-medium">{templateName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">{currentDate}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-mono text-xs font-medium">{shortIdPreview}...</span>
                  <span className="text-xs text-muted-foreground">(generated after creation)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t bg-muted/30">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isCreating}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isCreating || !configName.trim()}
              className="flex-1"
            >
              {isCreating ? 'Creating...' : 'Create Configuration'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

console.log('[ConfigNameDialog] Component defined');
