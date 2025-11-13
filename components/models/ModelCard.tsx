"use client";

/**
 * ModelCard Component
 * Phase 5.2.2: Individual Model Display
 * Date: 2025-10-15
 *
 * Displays a single LLM model with:
 * - Model information (name, provider, capabilities)
 * - Capability icons (streaming, tools, vision)
 * - Edit/Delete buttons for user models
 * - Global badge for system models
 */

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Zap, Eye, Edit, Trash2, Globe, User } from 'lucide-react';
import type { LLMModelDisplay } from '@/lib/models/llm-model.types';

interface ModelCardProps {
  model: LLMModelDisplay;
  onEdit?: (model: LLMModelDisplay) => void;
  onDelete?: (model: LLMModelDisplay) => void;
  currentUserId?: string;
}

export function ModelCard({ model, onEdit, onDelete, currentUserId }: ModelCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isUserModel = !model.is_global && model.user_id === currentUserId;
  const canEdit = isUserModel && onEdit;
  const canDelete = isUserModel && onDelete;

  console.log('[ModelCard] Rendering:', {
    name: model.name,
    isGlobal: model.is_global,
    isUserModel,
    canEdit,
    canDelete,
  });

  const handleDelete = async () => {
    if (!onDelete) return;

    console.log('[ModelCard] Deleting model:', model.id);
    setDeleting(true);

    try {
      await onDelete(model);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('[ModelCard] Delete failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="relative">
      <div className="flex flex-col sm:flex-row">
        {/* Left Section - Main Info */}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold mb-0.5">{model.name}</h3>
              <p className="text-xs text-muted-foreground">
                {model.provider} • {model.model_id}
              </p>
            </div>

            {/* Ownership Badge */}
            <div>
              {model.is_global ? (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground rounded text-xs font-medium">
                  <Globe className="h-3 w-3" />
                  Global
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground rounded text-xs font-medium">
                  <User className="h-3 w-3" />
                  Custom
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {model.description && (
            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
              {model.description}
            </p>
          )}

          {/* Capabilities */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {model.supports_streaming && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-muted text-foreground rounded text-xs">
                <Zap className="h-3 w-3" />
                Streaming
              </div>
            )}
            {model.supports_functions && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-muted text-foreground rounded text-xs">
                <Sparkles className="h-3 w-3" />
                Tools
              </div>
            )}
            {model.supports_vision && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-muted text-foreground rounded text-xs">
                <Eye className="h-3 w-3" />
                Vision
              </div>
            )}
            {model.has_api_key && (
              <div className="px-1.5 py-0.5 bg-muted text-foreground rounded text-xs">
                Configured
              </div>
            )}
          </div>

          {/* Model Details */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">Context:</span> {model.context_length.toLocaleString()} tokens
            </div>
            <div>
              <span className="font-medium">Max Output:</span> {model.max_output_tokens.toLocaleString()} tokens
            </div>
          </div>

          {/* API Key Preview (for user models) */}
          {isUserModel && model.api_key_preview && (
            <div className="text-xs mt-2">
              <span className="font-medium text-muted-foreground">API Key:</span>{' '}
              <code className="px-1.5 py-0.5 bg-muted rounded text-xs">{model.api_key_preview}</code>
            </div>
          )}
        </div>

        {/* Right Section - Actions */}
        {(canEdit || canDelete) && (
          <div className="border-t sm:border-t-0 sm:border-l p-3 sm:w-40 flex flex-col justify-center">
            {!showDeleteConfirm ? (
              <div className="flex sm:flex-col gap-2">
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(model)}
                    className="flex-1 gap-1.5 h-8"
                  >
                    <Edit className="h-3 w-3" />
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex-1 gap-1.5 h-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">
                  Delete &quot;{model.name}&quot;?
                </p>
                <p className="text-xs text-muted-foreground">
                  This action cannot be undone.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Confirm'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
