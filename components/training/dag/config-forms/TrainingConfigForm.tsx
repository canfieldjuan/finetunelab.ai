/**
 * Training Job Configuration Form
 *
 * Form for configuring training job parameters
 */

'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export interface TrainingConfig {
  provider?: string;
  trainingConfigId?: string; // Reference to saved training config
  modelId?: string;
  datasetId?: string;
}

interface Dataset {
  id: string;
  name: string;
  displayLabel: string;
  format: string;
  totalExamples: number;
  storage_provider: string;
}

interface Model {
  id: string;
  name: string;
  displayLabel: string;
  baseModel: string;
  provider: string;
}

interface TrainingConfigOption {
  id: string;
  name: string;
  description: string | null;
  method: string;
  displayLabel: string;
  epochs: number | string;
  batchSize: number | string;
}

interface TrainingConfigFormProps {
  config: TrainingConfig;
  onChange: (config: TrainingConfig) => void;
}

export function TrainingConfigForm({ config, onChange }: TrainingConfigFormProps) {
  console.log('[TrainingConfigForm] Rendering with config:', config);
  
  const { session } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [trainingConfigs, setTrainingConfigs] = useState<TrainingConfigOption[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  
  // Control which dropdown is open (only one at a time)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Fetch training configs on mount
  useEffect(() => {
    if (!session?.access_token) {
      setLoadingConfigs(false);
      return;
    }

    async function fetchTrainingConfigs() {
      console.log('[TrainingConfigForm] Fetching training configs...');
      setLoadingConfigs(true);

      try {
        const response = await fetch('/api/training/config/available', {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch configs: ${response.status}`);
        }

        const data = await response.json();
        console.log('[TrainingConfigForm] Loaded', data.count, 'training configs');
        setTrainingConfigs(data.configs || []);
      } catch (err) {
        console.error('[TrainingConfigForm] Config fetch error:', err);
        // Don't set error, just log (configs might not exist yet)
      } finally {
        setLoadingConfigs(false);
      }
    }

    fetchTrainingConfigs();
  }, [session?.access_token]);

  // Fetch datasets on mount
  useEffect(() => {
    if (!session?.access_token) {
      setLoadingDatasets(false);
      return;
    }

    async function fetchDatasets() {
      console.log('[TrainingConfigForm] Fetching datasets...');
      setLoadingDatasets(true);

      try {
        const response = await fetch('/api/training/dataset/available', {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch datasets: ${response.status}`);
        }

        const data = await response.json();
        console.log('[TrainingConfigForm] Loaded', data.count, 'datasets');
        setDatasets(data.datasets || []);
      } catch (err) {
        console.error('[TrainingConfigForm] Dataset fetch error:', err);
      } finally {
        setLoadingDatasets(false);
      }
    }

    fetchDatasets();
  }, [session?.access_token]);

  // Fetch models on mount
  useEffect(() => {
    if (!session?.access_token) {
      setLoadingModels(false);
      return;
    }

    async function fetchModels() {
      console.log('[TrainingConfigForm] Fetching models...');
      setLoadingModels(true);

      try {
        const response = await fetch('/api/models/training-compatible', {
          headers: session?.access_token ? {
            'Authorization': `Bearer ${session.access_token}`,
          } : {},
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const data = await response.json();
        console.log('[TrainingConfigForm] Loaded', data.count, 'models');
        setModels(data.models || []);
      } catch (err) {
        console.error('[TrainingConfigForm] Model fetch error:', err);
        // Don't set error here, just log it (models page might be unavailable)
      } finally {
        setLoadingModels(false);
      }
    }

    fetchModels();
  }, [session?.access_token]);

  const handleChange = (field: keyof TrainingConfig, value: string | number) => {
    console.log('[TrainingConfigForm] Field changed:', field, '=', value);
    onChange({
      ...config,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="provider" className="text-xs font-medium">
          Training Provider *
        </Label>
        <Select
          value={config.provider || 'local'}
          onValueChange={(value) => handleChange('provider', value)}
          open={openDropdown === 'provider'}
          onOpenChange={(open) => setOpenDropdown(open ? 'provider' : null)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">Local GPU (Training Server)</SelectItem>
            <SelectItem value="colab">Google Colab</SelectItem>
            <SelectItem value="huggingface">HuggingFace</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {config.provider === 'local' && '✅ Routes through localhost:8000 training server'}
          {config.provider === 'colab' && 'Uses Google Colab for training'}
          {config.provider === 'huggingface' && 'Uses HuggingFace Spaces for training'}
          {config.provider === 'openai' && 'Uses OpenAI fine-tuning API'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="trainingConfigId" className="text-xs font-medium">
          Training Config *
        </Label>
        {loadingConfigs ? (
          <div className="h-8 flex items-center justify-center border rounded-md bg-muted">
            <span className="text-xs text-muted-foreground">Loading configs...</span>
          </div>
        ) : trainingConfigs.length === 0 ? (
          <div className="space-y-2">
            <div className="h-8 flex items-center justify-center border border-dashed rounded-md">
              <span className="text-xs text-muted-foreground">No training configs</span>
            </div>
            <a
              href="/training"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Create config in Training page</span>
            </a>
          </div>
        ) : (
          <Select
            value={config.trainingConfigId || ''}
            onValueChange={(value) => handleChange('trainingConfigId', value)}
            open={openDropdown === 'trainingConfig'}
            onOpenChange={(open) => setOpenDropdown(open ? 'trainingConfig' : null)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select training config..." />
            </SelectTrigger>
            <SelectContent>
              {trainingConfigs.map((cfg) => (
                <SelectItem key={cfg.id} value={cfg.id} className="text-xs">
                  <div className="flex flex-col">
                    <span>{cfg.displayLabel}</span>
                    {cfg.description && (
                      <span className="text-muted-foreground text-xs truncate max-w-[250px]">
                        {cfg.description}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {config.trainingConfigId
            ? `Using: ${trainingConfigs.find(c => c.id === config.trainingConfigId)?.name || 'Unknown'}`
            : 'Includes hyperparameters (epochs, batch size, learning rate)'
          }
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="modelId" className="text-xs font-medium">
          Model *
        </Label>
        {loadingModels ? (
          <div className="h-8 flex items-center justify-center border rounded-md bg-muted">
            <span className="text-xs text-muted-foreground">Loading models...</span>
          </div>
        ) : models.length === 0 ? (
          <div className="space-y-2">
            <div className="h-8 flex items-center justify-center border border-dashed rounded-md">
              <span className="text-xs text-muted-foreground">No models available</span>
            </div>
            <a
              href="/models"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Add models in Models page</span>
            </a>
          </div>
        ) : (
          <Select
            value={config.modelId || ''}
            onValueChange={(value) => handleChange('modelId', value)}
            open={openDropdown === 'model'}
            onOpenChange={(open) => setOpenDropdown(open ? 'model' : null)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select a model..." />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id} className="text-xs">
                  <div className="flex flex-col">
                    <span>{model.displayLabel}</span>
                    {model.baseModel && (
                      <span className="text-muted-foreground text-xs">
                        Base: {model.baseModel}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {config.modelId 
            ? `Using: ${models.find(m => m.id === config.modelId)?.name || 'Unknown'}`
            : 'Select a base model for training'
          }
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="datasetId" className="text-xs font-medium">
          Dataset *
        </Label>
        {loadingDatasets ? (
          <div className="h-8 flex items-center justify-center border rounded-md bg-muted">
            <span className="text-xs text-muted-foreground">Loading datasets...</span>
          </div>
        ) : datasets.length === 0 ? (
          <div className="space-y-2">
            <div className="h-8 flex items-center justify-center border border-dashed rounded-md">
              <span className="text-xs text-muted-foreground">No datasets uploaded</span>
            </div>
            <a
              href="/training?tab=upload"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Upload dataset in Training page</span>
            </a>
          </div>
        ) : (
          <Select
            value={config.datasetId || ''}
            onValueChange={(value) => handleChange('datasetId', value)}
            open={openDropdown === 'dataset'}
            onOpenChange={(open) => setOpenDropdown(open ? 'dataset' : null)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select a dataset..." />
            </SelectTrigger>
            <SelectContent>
              {datasets
                .filter((dataset) => {
                  const requiredStorage = (config.provider === 'sagemaker' || config.provider === 'aws') ? 's3' : 'supabase';
                  return dataset.storage_provider === requiredStorage;
                })
                .map((dataset) => (
                  <SelectItem key={dataset.id} value={dataset.id} className="text-xs">
                    {dataset.displayLabel}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {config.datasetId
            ? `Using: ${datasets.find(d => d.id === config.datasetId)?.name || 'Unknown'}`
            : 'Select training data from your uploaded datasets'
          }
        </p>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
        * Required fields
      </p>
    </div>
  );
}
