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
import { Sparkles, Zap, Eye, Edit, Trash2, Globe, User, PlayCircle, StopCircle, Server, Cloud } from 'lucide-react';
import type { LLMModelDisplay } from '@/lib/models/llm-model.types';
import { toast } from 'sonner';

interface ServerInfo {
  id: string;
  status: 'running' | 'stopped' | 'starting' | 'error';
  port?: number;
}

interface ModelMetadata {
  model_path?: string;
  training_job_id?: string;
}

interface DeployPayload {
  server_type: 'ollama' | 'vllm';
  name: string;
  config: {
    model_path: string;
  };
  job_id?: string;
}

interface ModelCardProps {
  model: LLMModelDisplay;
  onEdit?: (model: LLMModelDisplay) => void;
  onDelete?: (model: LLMModelDisplay) => void;
  currentUserId?: string;
  serverInfo?: ServerInfo;
  sessionToken?: string;
  onServerChanged?: () => void;
}

export function ModelCard({ model, onEdit, onDelete, currentUserId, serverInfo, sessionToken, onServerChanged }: ModelCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [serverActionLoading, setServerActionLoading] = useState(false);
  const [deployingServerless, setDeployingServerless] = useState(false);

  const isUserModel = !model.is_global && model.user_id === currentUserId;
  const canEdit = isUserModel && onEdit;
  const canDelete = isUserModel && onDelete;

  // Check if model can be deployed (vLLM/Ollama/local models)
  const canDeploy = isUserModel && (model.provider === 'vllm' || model.provider === 'ollama' || model.provider === 'local');
  const hasServer = !!serverInfo;

  console.log('[ModelCard] Rendering:', {
    name: model.name,
    isGlobal: model.is_global,
    isUserModel,
    canEdit,
    canDelete,
    canDeploy,
    hasServer,
    serverStatus: serverInfo?.status,
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

  const handleStopServer = async () => {
    if (!serverInfo || !sessionToken) return;

    console.log('[ModelCard] Stopping server:', serverInfo.id);
    setServerActionLoading(true);

    try {
      const response = await fetch('/api/servers/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ server_id: serverInfo.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to stop server');
      }

      toast.success('Server stopped successfully');
      onServerChanged?.();
    } catch (error) {
      console.error('[ModelCard] Stop server failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to stop server');
    } finally {
      setServerActionLoading(false);
    }
  };

  const handleStartServer = async () => {
    if (!serverInfo || !sessionToken) return;

    console.log('[ModelCard] Starting server:', serverInfo.id);
    setServerActionLoading(true);

    try {
      const response = await fetch('/api/servers/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ server_id: serverInfo.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start server');
      }

      toast.success('Server started successfully');
      onServerChanged?.();
    } catch (error) {
      console.error('[ModelCard] Start server failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start server');
    } finally {
      setServerActionLoading(false);
    }
  };

  const handleDeployServer = async () => {
    if (!canDeploy || !sessionToken) return;

    // Check if model has deployment metadata
    const metadata = model.metadata as ModelMetadata | undefined;
    if (!metadata?.model_path) {
      toast.error('No model path found. This model cannot be deployed.');
      return;
    }

    console.log('[ModelCard] Deploying server for model:', model.id);
    setServerActionLoading(true);

    try {
      // Construct payload matching /api/training/deploy expectations
      const payload: DeployPayload = {
        server_type: model.provider === 'ollama' ? 'ollama' : 'vllm',
        name: model.name,
        config: {
          model_path: metadata.model_path,
        },
      };

      // Add optional job_id if available
      if (metadata.training_job_id) {
        payload.job_id = metadata.training_job_id;
      }

      const response = await fetch('/api/training/deploy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deploy server');
      }

      toast.success('Server deployment started');
      onServerChanged?.();
    } catch (error) {
      console.error('[ModelCard] Deploy server failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to deploy server');
    } finally {
      setServerActionLoading(false);
    }
  };

  const handleDeployServerless = async () => {
    if (!sessionToken) {
      toast.error('Authentication required');
      return;
    }

    console.log('[ModelCard] Deploying to RunPod Serverless:', model.id);
    setDeployingServerless(true);

    try {
      const response = await fetch('/api/training/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          server_type: 'runpod-serverless',
          name: `${model.name}-serverless`,
          config: {
            model_path: model.model_id,
            gpu_type: 'NVIDIA RTX A4000',
            budget_limit: 5.0,
            gpu_memory_utilization: 0.85,
            max_model_len: 8192,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Deployment failed');
      }

      toast.success('Serverless deployment started!', {
        description: data.message,
      });

      onServerChanged?.();
    } catch (error) {
      console.error('[ModelCard] Serverless deployment error:', error);
      toast.error('Deployment failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setDeployingServerless(false);
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

          {/* Server Status (for vLLM/Ollama models) */}
          {canDeploy && (
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              <Server className="h-3 w-3 text-muted-foreground" />
              {serverInfo ? (
                <>
                  {serverInfo.status === 'running' ? (
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      Running on port {serverInfo.port}
                    </span>
                  ) : serverInfo.status === 'starting' ? (
                    <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                      Starting...
                    </span>
                  ) : serverInfo.status === 'error' ? (
                    <span className="text-destructive font-medium">
                      Error
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Stopped
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">
                  Not deployed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right Section - Actions */}
        {(canEdit || canDelete || canDeploy || isUserModel) && (
          <div className="border-t sm:border-t-0 sm:border-l p-3 sm:w-40 flex flex-col justify-center">
            {!showDeleteConfirm ? (
              <div className="flex sm:flex-col gap-2">
                {/* Server Controls */}
                {canDeploy && sessionToken && (
                  <>
                    {/* Has server - show start/stop */}
                    {hasServer && serverInfo.status === 'running' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStopServer}
                        disabled={serverActionLoading}
                        className="flex-1 gap-1.5 h-8"
                      >
                        <StopCircle className="h-3 w-3" />
                        {serverActionLoading ? 'Stopping...' : 'Stop Server'}
                      </Button>
                    )}
                    {hasServer && (serverInfo.status === 'stopped' || serverInfo.status === 'error') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartServer}
                        disabled={serverActionLoading}
                        className="flex-1 gap-1.5 h-8"
                      >
                        <PlayCircle className="h-3 w-3" />
                        {serverActionLoading ? 'Starting...' : 'Start Server'}
                      </Button>
                    )}
                    {hasServer && serverInfo.status === 'starting' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="flex-1 gap-1.5 h-8"
                      >
                        <PlayCircle className="h-3 w-3 animate-spin" />
                        Starting...
                      </Button>
                    )}
                    {/* No server - show deploy */}
                    {!hasServer && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeployServer}
                        disabled={serverActionLoading}
                        className="flex-1 gap-1.5 h-8"
                      >
                        <Server className="h-3 w-3" />
                        {serverActionLoading ? 'Deploying...' : 'Deploy Server'}
                      </Button>
                    )}
                  </>
                )}

                {/* Deploy to Serverless */}
                {isUserModel && sessionToken && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeployServerless}
                    disabled={deployingServerless}
                    className="flex-1 gap-1.5 h-8"
                    title="Deploy model to serverless testing endpoint"
                  >
                    <Cloud className="h-3 w-3" />
                    {deployingServerless ? 'Deploying...' : 'Serverless'}
                  </Button>
                )}

                {/* Edit/Delete Controls */}
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
