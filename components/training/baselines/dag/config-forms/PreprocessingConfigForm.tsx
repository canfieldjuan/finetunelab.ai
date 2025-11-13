/**
 * Preprocessing Job Configuration Form
 *
 * Form for configuring preprocessing job parameters
 */

'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export interface PreprocessingConfig {
  inputPath?: string;
  outputPath?: string;
  operations?: string;
  apiEndpoint?: string;
}

interface PreprocessingConfigFormProps {
  config: PreprocessingConfig;
  onChange: (config: PreprocessingConfig) => void;
}

export function PreprocessingConfigForm({ config, onChange }: PreprocessingConfigFormProps) {
  console.log('[PreprocessingConfigForm] Rendering with config:', config);

  const handleChange = (field: keyof PreprocessingConfig, value: string) => {
    console.log('[PreprocessingConfigForm] Field changed:', field, '=', value);
    onChange({
      ...config,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="inputPath" className="text-xs font-medium">
          Input Path *
        </Label>
        <Input
          id="inputPath"
          value={config.inputPath || ''}
          onChange={(e) => handleChange('inputPath', e.target.value)}
          className="h-8 text-xs"
          placeholder="/data/raw"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="outputPath" className="text-xs font-medium">
          Output Path *
        </Label>
        <Input
          id="outputPath"
          value={config.outputPath || ''}
          onChange={(e) => handleChange('outputPath', e.target.value)}
          className="h-8 text-xs"
          placeholder="/data/processed"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="operations" className="text-xs font-medium">
          Operations
        </Label>
        <Input
          id="operations"
          value={config.operations || ''}
          onChange={(e) => handleChange('operations', e.target.value)}
          className="h-8 text-xs"
          placeholder="normalize, tokenize, clean"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Comma-separated list of operations
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
