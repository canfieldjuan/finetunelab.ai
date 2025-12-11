/**
 * DAG Toolbar Component
 *
 * Toolbar with controls for adding nodes, saving, validating, and managing DAG
 */

'use client';

import { Button } from '@/components/ui/button';
import {
  BrainCircuit,
  Filter,
  CheckCircle,
  Rocket,
  Shield,
  Save,
  Upload,
  Trash2,
  AlertCircle,
  Play
} from 'lucide-react';
import { JobType } from '@/lib/training/dag-orchestrator';

interface DagToolbarProps {
  onAddNode: (type: JobType) => void;
  onSave: () => void;
  onLoad: () => void;
  onValidate: () => void;
  onExecute: () => void;
  onClear: () => void;
  disabled?: boolean;
  hasNodes?: boolean;
}

const jobTypes: Array<{
  type: JobType;
  label: string;
  icon: typeof BrainCircuit;
}> = [
  { type: 'training', label: 'Training', icon: BrainCircuit },
  { type: 'preprocessing', label: 'Preprocessing', icon: Filter },
  { type: 'validation', label: 'Validation', icon: CheckCircle },
  { type: 'deployment', label: 'Deployment', icon: Rocket },
  { type: 'regression-gate', label: 'Regression Gate', icon: Shield }
];

export function DagToolbar({
  onAddNode,
  onSave,
  onLoad,
  onValidate,
  onExecute,
  onClear,
  disabled = false,
  hasNodes = false
}: DagToolbarProps) {
  console.log('[DagToolbar] Rendering toolbar, disabled:', disabled, 'hasNodes:', hasNodes);

  const handleAddNode = (type: JobType) => {
    console.log('[DagToolbar] Add node clicked:', type);
    onAddNode(type);
  };

  const handleSave = () => {
    console.log('[DagToolbar] Save clicked');
    onSave();
  };

  const handleLoad = () => {
    console.log('[DagToolbar] Load clicked');
    onLoad();
  };

  const handleValidate = () => {
    console.log('[DagToolbar] Validate clicked');
    onValidate();
  };

  const handleExecute = () => {
    console.log('[DagToolbar] Execute clicked');
    onExecute();
  };

  const handleClear = () => {
    console.log('[DagToolbar] Clear clicked');
    onClear();
  };

  return (
    <div className="flex items-center gap-2 p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Add Job:
        </span>
        {jobTypes.map(({ type, label, icon: Icon }) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            onClick={() => handleAddNode(type)}
            disabled={disabled}
            className="gap-2"
          >
            <Icon className="w-4 h-4" />
            {label}
          </Button>
        ))}
      </div>

      <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />

      <Button
        variant="outline"
        size="sm"
        onClick={handleValidate}
        disabled={disabled || !hasNodes}
        className="gap-2"
      >
        <AlertCircle className="w-4 h-4" />
        Validate
      </Button>

      <Button
        variant="default"
        size="sm"
        onClick={handleExecute}
        disabled={disabled || !hasNodes}
        className="gap-2 bg-green-600 hover:bg-green-700 text-white"
      >
        <Play className="w-4 h-4" />
        Execute
      </Button>

      <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />

      <Button
        variant="outline"
        size="sm"
        onClick={handleSave}
        disabled={disabled || !hasNodes}
        className="gap-2"
      >
        <Save className="w-4 h-4" />
        Save
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleLoad}
        disabled={disabled}
        className="gap-2"
      >
        <Upload className="w-4 h-4" />
        Load
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleClear}
        disabled={disabled}
        className="gap-2 text-red-600 hover:text-red-700 dark:text-red-400"
      >
        <Trash2 className="w-4 h-4" />
        Clear
      </Button>
    </div>
  );
}
