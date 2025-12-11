/**
 * Validation Job Configuration Form
 *
 * Form for configuring validation job parameters
 */

'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export interface ValidationConfig {
  modelPath?: string;
  testDataset?: string;
  metrics?: string;
  apiEndpoint?: string;
}

interface ValidationConfigFormProps {
  config: ValidationConfig;
  onChange: (config: ValidationConfig) => void;
}

export function ValidationConfigForm({ config, onChange }: ValidationConfigFormProps) {
  console.log('[ValidationConfigForm] Rendering with config:', config);

  const handleChange = (field: keyof ValidationConfig, value: string) => {
    console.log('[ValidationConfigForm] Field changed:', field, '=', value);
    onChange({
      ...config,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="modelPath" className="text-xs font-medium">
          Model Path *
        </Label>
        <Input
          id="modelPath"
          value={config.modelPath || ''}
          onChange={(e) => handleChange('modelPath', e.target.value)}
          className="h-8 text-xs"
          placeholder="/models/checkpoint"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="testDataset" className="text-xs font-medium">
          Test Dataset *
        </Label>
        <Input
          id="testDataset"
          value={config.testDataset || ''}
          onChange={(e) => handleChange('testDataset', e.target.value)}
          className="h-8 text-xs"
          placeholder="test-set"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="metrics" className="text-xs font-medium">
          Metrics
        </Label>
        <Input
          id="metrics"
          value={config.metrics || ''}
          onChange={(e) => handleChange('metrics', e.target.value)}
          className="h-8 text-xs"
          placeholder="accuracy, f1, precision, recall"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Comma-separated list of metrics
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiEndpoint" className="text-xs font-medium">
          API Endpoint *
        </Label>
        <Input
          id="apiEndpoint"
          value={config.apiEndpoint || ''}
          onChange={(e) => handleChange('apiEndpoint', e.target.value)}
          className="h-8 text-xs"
          placeholder="http://localhost:8000/api"
        />
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
        * Required fields
      </p>
    </div>
  );
}
