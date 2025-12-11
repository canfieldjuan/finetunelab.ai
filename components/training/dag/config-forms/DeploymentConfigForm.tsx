/**
 * Deployment Job Configuration Form
 *
 * Form for configuring deployment job parameters
 */

'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export interface DeploymentConfig {
  modelPath?: string;
  deploymentTarget?: string;
  endpoint?: string;
  apiEndpoint?: string;
}

interface DeploymentConfigFormProps {
  config: DeploymentConfig;
  onChange: (config: DeploymentConfig) => void;
}

export function DeploymentConfigForm({ config, onChange }: DeploymentConfigFormProps) {
  console.log('[DeploymentConfigForm] Rendering with config:', config);

  const handleChange = (field: keyof DeploymentConfig, value: string) => {
    console.log('[DeploymentConfigForm] Field changed:', field, '=', value);
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
          placeholder="/models/final"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deploymentTarget" className="text-xs font-medium">
          Deployment Target *
        </Label>
        <Input
          id="deploymentTarget"
          value={config.deploymentTarget || ''}
          onChange={(e) => handleChange('deploymentTarget', e.target.value)}
          className="h-8 text-xs"
          placeholder="production, staging, dev"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="endpoint" className="text-xs font-medium">
          Endpoint Path
        </Label>
        <Input
          id="endpoint"
          value={config.endpoint || ''}
          onChange={(e) => handleChange('endpoint', e.target.value)}
          className="h-8 text-xs"
          placeholder="/v1/model"
        />
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
