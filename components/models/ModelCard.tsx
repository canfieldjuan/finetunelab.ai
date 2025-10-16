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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
    <Card className={`relative ${model.is_global ? 'border-blue-200' : 'border-input'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg mb-1">{model.name}</CardTitle>
            <p className="text-sm text-muted-foreground truncate">
              {model.provider} • {model.model_id}
            </p>
          </div>

          {/* Ownership Badge */}
          <div>
            {model.is_global ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                <Globe className="h-3 w-3" />
                Global
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                <User className="h-3 w-3" />
                Custom
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        {model.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {model.description}
          </p>
        )}

        {/* Capabilities */}
        <div className="flex flex-wrap gap-2">
          {model.supports_streaming && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
              <Zap className="h-3 w-3" />
              Streaming
            </div>
          )}
          {model.supports_functions && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
              <Sparkles className="h-3 w-3" />
              Tools
            </div>
          )}
          {model.supports_vision && (
            <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
              <Eye className="h-3 w-3" />
              Vision
            </div>
          )}
          {model.has_api_key && (
            <div className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
              Configured
            </div>
          )}
        </div>

        {/* Model Details */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">Context:</span> {model.context_length.toLocaleString()} tokens
          </div>
          <div>
            <span className="font-medium">Max Output:</span> {model.max_output_tokens.toLocaleString()} tokens
          </div>
        </div>

        {/* API Key Preview (for user models) */}
        {isUserModel && model.api_key_preview && (
          <div className="text-xs">
            <span className="font-medium text-muted-foreground">API Key:</span>{' '}
            <code className="px-1.5 py-0.5 bg-muted rounded text-xs">{model.api_key_preview}</code>
          </div>
        )}

        {/* Actions */}
        {!showDeleteConfirm && (canEdit || canDelete) && (
          <div className="flex gap-2 pt-2 border-t">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(model)}
                className="flex-1 gap-2"
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
                className="flex-1 gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            )}
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="pt-2 border-t space-y-2">
            <p className="text-sm font-medium text-destructive">
              Delete "{model.name}"?
            </p>
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. The model will be removed from your account.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
