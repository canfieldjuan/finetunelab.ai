/**
 * DAG Sidebar Component
 *
 * Properties panel for editing selected node configuration
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DagNodeData } from './types';
import { DagStatusBadge } from './DagStatusBadge';
import { X } from 'lucide-react';
import {
  TrainingConfigForm,
  PreprocessingConfigForm,
  ValidationConfigForm,
  DeploymentConfigForm,
} from './config-forms';
import type { TrainingConfig } from './config-forms/TrainingConfigForm';

interface DagSidebarProps {
  selectedNode: DagNodeData | null;
  onUpdateNode: (id: string, updates: Partial<DagNodeData>) => void;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
}

export function DagSidebar({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
  onClose
}: DagSidebarProps) {
  console.log('[DagSidebar] Rendering with selected node:', selectedNode?.id);

  if (!selectedNode) {
    return (
      <Card className="w-80 h-full">
        <CardHeader>
          <CardTitle className="text-sm">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a node to view its properties
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleNameChange = (name: string) => {
    console.log('[DagSidebar] Name changed:', name);
    onUpdateNode(selectedNode.id, { name });
  };

  const handleConfigChange = (config: unknown) => {
    console.log('[DagSidebar] Config changed:', config);
    onUpdateNode(selectedNode.id, { config: config as Record<string, unknown> });
  };

  const handleDelete = () => {
    console.log('[DagSidebar] Delete node:', selectedNode.id);
    onDeleteNode(selectedNode.id);
    onClose();
  };

  return (
    <Card className="w-80 h-full max-h-full overflow-y-auto shadow-2xl border-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">Node Properties</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="node-id" className="text-xs font-medium">
            ID
          </Label>
          <Input
            id="node-id"
            value={selectedNode.id}
            disabled
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="node-type" className="text-xs font-medium">
            Type
          </Label>
          <Input
            id="node-type"
            value={selectedNode.type}
            disabled
            className="h-8 text-xs capitalize"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="node-name" className="text-xs font-medium">
            Name
          </Label>
          <Input
            id="node-name"
            value={selectedNode.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="h-8 text-xs"
            placeholder="Enter node name"
          />
        </div>

        {/* Job-specific configuration form */}
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Label className="text-xs font-medium">Job Configuration</Label>
          
          {selectedNode.type === 'training' && (
            <TrainingConfigForm
              config={selectedNode.config as TrainingConfig}
              onChange={handleConfigChange}
            />
          )}

          {selectedNode.type === 'preprocessing' && (
            <PreprocessingConfigForm
              config={selectedNode.config as Record<string, unknown>}
              onChange={handleConfigChange}
            />
          )}

          {selectedNode.type === 'validation' && (
            <ValidationConfigForm
              config={selectedNode.config as Record<string, unknown>}
              onChange={handleConfigChange}
            />
          )}

          {selectedNode.type === 'deployment' && (
            <DeploymentConfigForm
              config={selectedNode.config as Record<string, unknown>}
              onChange={handleConfigChange}
            />
          )}
        </div>

        {selectedNode.status && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Status</Label>
            <DagStatusBadge status={selectedNode.status} />
          </div>
        )}

        {selectedNode.progress !== undefined && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Progress</Label>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {selectedNode.progress}%
            </div>
          </div>
        )}

        {selectedNode.error && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-red-600 dark:text-red-400">
              Error
            </Label>
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-2 rounded">
              {selectedNode.error}
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="w-full"
          >
            Delete Node
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
