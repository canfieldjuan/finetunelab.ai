// Config Editor Component
// Purpose: Edit training config parameters
// Date: 2025-10-16
// Updated: 2025-10-31 - Added prefilledModel prop for auto-fill

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
// Server icon removed - was used by Provider/Infrastructure card (now hidden)
import type { TrainingConfig, TrainingProvider, LocalProviderConfig, AdvancedTrainingConfig } from '@/lib/training/training-config.types';
import type { PredictionsConfig } from '@/lib/training/types/predictions-types';
import { supabase } from '@/lib/supabaseClient';
import { buildUiConfig, validateBeforeUse } from '@/lib/training/config-builder';
// DistributedTrainingConfig removed from UI - component preserved for future use
import { servicesConfig } from '@/lib/config/services';
import { PredictionsConfigPanel } from './PredictionsConfigPanel';

interface ConfigEditorProps {
  configId: string;
  configName: string;
  initialConfig: TrainingConfig;
  onSave: () => void;
  onCancel: () => void;
  prefilledModel?: string | null; // New: Auto-fill model name from selected model
}

export function ConfigEditor({ 
  configId, 
  configName, 
  initialConfig, 
  onSave, 
  onCancel,
  prefilledModel,
}: ConfigEditorProps) {
  const [config, setConfig] = useState<TrainingConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Provider state (Phase 2.3: Local Training Connection) - UI removed, preserved for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedProvider, setSelectedProvider] = useState<TrainingProvider>('local');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [localUrl, setLocalUrl] = useState(servicesConfig.training.serverUrl);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [testingConnection, setTestingConnection] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [connectionMessage, setConnectionMessage] = useState<string>('');

  // Auto-fill model name when prefilledModel prop changes
  useEffect(() => {
    if (prefilledModel && config.model.name !== prefilledModel) {
      console.log('[ConfigEditor] Auto-filling model name:', prefilledModel);
      setConfig(prev => ({
        ...prev,
        model: {
          ...prev.model,
          name: prefilledModel,
        },
        tokenizer: {
          ...prev.tokenizer,
          name: prefilledModel, // Also update tokenizer to match
        },
      }));
    }
  }, [prefilledModel, config.model.name]);

  useEffect(() => {
    // Load saved provider config
    if (config.provider) {
      if (config.provider.type === 'local') {
        setSelectedProvider('local');
        setLocalUrl(config.provider.base_url);
      }
    }
  }, [config.provider]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const testLocalConnection = async () => {
    console.log('[ConfigEditor] Testing local connection:', localUrl);
    setTestingConnection(true);
    setConnectionStatus('unknown');
    setConnectionMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/training/local', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base_url: localUrl,
          save_config: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setConnectionStatus('connected');
        setConnectionMessage('Successfully connected to local training server');
        
        // Update config with provider info
        const providerConfig: LocalProviderConfig = {
          type: 'local',
          base_url: localUrl,
        };
        
        setConfig(prev => ({
          ...prev,
          provider: providerConfig,
        }));
      } else {
        setConnectionStatus('error');
        setConnectionMessage(data.error || 'Connection failed');
      }
    } catch (err) {
      console.error('[ConfigEditor] Connection test error:', err);
      setConnectionStatus('error');
      setConnectionMessage(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const updateTrainingField = (field: string, value: unknown) => {
    console.log('[ConfigEditor] Updating', field, 'to', value);
    setConfig(prev => ({
      ...prev,
      training: {
        ...prev.training,
        [field]: value,
      },
    }));
  };

  const updateDataField = (field: string, value: unknown) => {
    console.log('[ConfigEditor] Updating data field', field, 'to', value);
    setConfig(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [field]: value,
      },
    }));
  };

  const handlePredictionsChange = useCallback((predictionsConfig: PredictionsConfig) => {
    setConfig(prev => ({
      ...prev,
      predictions: predictionsConfig,
    }));
  }, []);

  const handleSave = async () => {
    console.log('[ConfigEditor] Saving config:', configId);
    setSaving(true);
    setError(null);

    try {
      // Build + validate config before saving (non-destructive)
      const builtConfig: TrainingConfig = buildUiConfig(config);
      const validation = validateBeforeUse(builtConfig);
      if (!validation.isValid) {
        console.warn('[ConfigEditor] Validation failed before save:', validation.errors);
        throw new Error(validation.errors[0]?.message || 'Configuration validation failed');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      // Determine if this is a create or update operation
      const isUpdate = configId && configId.trim() !== '';
      const requestUrl = isUpdate ? `/api/training/${configId}` : '/api/training';
      const method = isUpdate ? 'PUT' : 'POST';

      console.log('[ConfigEditor] Operation:', isUpdate ? 'UPDATE' : 'CREATE');
      console.log('[ConfigEditor] Making', method, 'request to:', requestUrl);
      console.log('[ConfigEditor] Config ID:', configId);
      console.log('[ConfigEditor] Request body keys:', Object.keys({ config_json: builtConfig }));

      // For new configs, generate a unique name with timestamp
      const uniqueConfigName = isUpdate 
        ? undefined 
        : `${configName} - ${Date.now()}`;

      const requestBody = isUpdate
        ? { config_json: builtConfig }
        : {
            name: uniqueConfigName,
            description: `Configuration created on ${new Date().toISOString()}`,
            template_type: (builtConfig as unknown as Record<string, unknown>).template_type || 'sft',
            config_json: builtConfig
          };

      console.log('[ConfigEditor] Request body:', isUpdate ? 'config_json only' : `name: ${uniqueConfigName}`);
      const trainingParams = builtConfig.training as unknown as Record<string, unknown>;
      console.log('[ConfigEditor] Sending new parameters:', {
        lr_scheduler_type: trainingParams.lr_scheduler_type,
        warmup_ratio: trainingParams.warmup_ratio,
        save_strategy: trainingParams.save_strategy,
        save_steps: trainingParams.save_steps,
        save_total_limit: trainingParams.save_total_limit,
        evaluation_strategy: trainingParams.evaluation_strategy,
        eval_batch_size: trainingParams.eval_batch_size,
        packing: trainingParams.packing,
        group_by_length: trainingParams.group_by_length,
        dataloader_num_workers: trainingParams.dataloader_num_workers,
        dataloader_prefetch_factor: trainingParams.dataloader_prefetch_factor,
        dataloader_pin_memory: trainingParams.dataloader_pin_memory,
      });

      const response = await fetch(requestUrl, {
        method,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[ConfigEditor] Save response status:', response.status, response.statusText);
      console.log('[ConfigEditor] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = 'Failed to save config';
        
        // Clone the response to inspect the body
        const clonedResponse = response.clone();
        const responseText = await clonedResponse.text();
        console.log('[ConfigEditor] Error response body:', responseText);
        
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch (jsonError) {
          // Response body might be empty or malformed
          console.error('[ConfigEditor] Failed to parse error response:', jsonError);
          errorMessage = `Server error: ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ''}`;
        }
        throw new Error(errorMessage);
      }

      console.log('[ConfigEditor] Config saved successfully');
      onSave();
    } catch (err) {
      console.error('[ConfigEditor] Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Edit Config: {configName}</h3>
        <p className="text-sm text-muted-foreground">
          Customize training parameters
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Form Content */}
      <div className="space-y-6">
        {/* 1. Model & Tokenizer Configuration */}
        <div className="space-y-4 border-b pb-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold">1. Model & Tokenizer</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Model Name</label>
              <input
                type="text"
                value={config.model.name}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  model: { ...prev.model, name: e.target.value }
                }))}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="meta-llama/Llama-2-7b-hf"
              />
              <p className="text-xs text-gray-500">
                HuggingFace model identifier or local path. Selected in Model Selection card above.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tokenizer Name</label>
              <input
                type="text"
                value={config.tokenizer.name}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  tokenizer: { ...prev.tokenizer, name: e.target.value }
                }))}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Usually same as model name"
              />
              <p className="text-xs text-gray-500">
                Usually same as model name. Auto-filled from Model Selection.
              </p>
            </div>
          </div>
        </div>


        {/* 2. Data Configuration */}
        <div className="space-y-4 border-b pb-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold">2. Data Configuration</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Samples</label>
              <input
                type="number"
                value={config.data.max_samples ?? ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                  updateDataField('max_samples', value);
                }}
                placeholder="Leave empty to use entire dataset"
                className="w-full px-3 py-2 border rounded-md"
                min="1"
              />
              <p className="text-xs text-gray-500">
                <strong>What it does:</strong> Limits how many examples from your dataset are used for training.<br/>
                <strong>Leave empty (recommended):</strong> Uses your entire dataset - best for quality<br/>
                <strong>Set a number:</strong> Only uses that many examples (e.g., 1000) - faster but may reduce quality<br/>
                <strong>Why it matters:</strong> Training on MORE data = better model (unless you&apos;re testing/debugging)
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Train/Validation Split</label>
              <input
                type="number"
                step="0.01"
                value={config.data.train_split ?? 0.99}
                onChange={(e) => updateDataField('train_split', parseFloat(e.target.value) || 0.99)}
                className="w-full px-3 py-2 border rounded-md"
                min="0.1"
                max="0.99"
              />
              <p className="text-xs text-gray-500">
                <strong>What it does:</strong> Percentage of data used for training vs validation.<br/>
                <strong>0.99 (99%):</strong> Default - 99% for training, 1% for validation<br/>
                <strong>0.90 (90%):</strong> More aggressive - 90% train, 10% validation<br/>
                <strong>Why it matters:</strong> Validation data checks if model is overfitting (memorizing vs learning)
              </p>
            </div>
          </div>

          {/* Data Loading Performance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">DataLoader Workers</label>
              <input
                type="number"
                value={(config.training as AdvancedTrainingConfig).dataloader_num_workers ?? 4}
                onChange={(e) => updateTrainingField('dataloader_num_workers', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-md"
                min="0"
                max="16"
              />
              <p className="text-xs text-gray-500">
                Number of parallel CPU workers for data loading. 4-8 recommended for fast loading. 0 = single-threaded.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Prefetch Factor</label>
              <input
                type="number"
                value={(config.training as AdvancedTrainingConfig).dataloader_prefetch_factor ?? 2}
                onChange={(e) => updateTrainingField('dataloader_prefetch_factor', parseInt(e.target.value) || 2)}
                className="w-full px-3 py-2 border rounded-md"
                min="1"
                max="10"
              />
              <p className="text-xs text-gray-500">
                Batches to prefetch per worker. Higher = faster but more RAM. Only used when workers &gt; 0.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="dataloader_pin_memory"
                  checked={Boolean((config.training as AdvancedTrainingConfig).dataloader_pin_memory ?? true)}
                  onChange={(e) => updateTrainingField('dataloader_pin_memory', e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="dataloader_pin_memory" className="text-sm font-medium">Pin Memory</label>
              </div>
              <p className="text-xs text-gray-500">
                Pins data in RAM for faster GPU transfer. Recommended unless low on RAM.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Training Hyperparameters */}
        <div className="space-y-4 border-b pb-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold">4. Training Hyperparameters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Training Method</label>
            <select
              value={config.training.method}
              onChange={(e) => updateTrainingField('method', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="sft">Supervised Fine-Tuning (SFT)</option>
              <option value="dpo">Direct Preference Optimization (DPO)</option>
              <option value="rlhf">Reinforcement Learning from Human Feedback (RLHF)</option>
              <option value="orpo">Odds Ratio Preference Optimization (ORPO)</option>
            </select>
            <p className="text-xs text-gray-500">
              SFT: Standard | DPO: Preference pairs | RLHF: PPO + reward model | ORPO: Efficient (no ref model)
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Epochs</label>
            <input
              type="number"
              value={config.training.num_epochs || ''}
              onChange={(e) => updateTrainingField('num_epochs', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border rounded-md"
              min="1"
            />
            <p className="text-xs text-gray-500">
              How many times to train on the full dataset. Start with 1-3, increase if underfitting.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Learning Rate</label>
            <input
              type="number"
              step="0.00001"
              value={config.training.learning_rate || ''}
              onChange={(e) => updateTrainingField('learning_rate', parseFloat(e.target.value) || 0.0001)}
              className="w-full px-3 py-2 border rounded-md"
            />
            <p className="text-xs text-gray-500">
              How fast the model learns. Default 0.0001 works well. Too high = unstable, too low = slow learning.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Batch Size</label>
            <input
              type="number"
              value={config.training.batch_size || ''}
              onChange={(e) => updateTrainingField('batch_size', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border rounded-md"
              min="1"
            />
            <p className="text-xs text-gray-500">
              Examples processed at once. Start with 1-4 for QLoRA. Larger = faster but uses more VRAM.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Eval Batch Size</label>
            <input
              type="number"
              value={(config.training as AdvancedTrainingConfig).eval_batch_size || ''}
              onChange={(e) => updateTrainingField('eval_batch_size', parseInt(e.target.value) || 4)}
              className="w-full px-3 py-2 border rounded-md"
              min="1"
            />
            <p className="text-xs text-gray-500">
              Batch size for evaluation only (no gradients). Can be 4-8x larger than training batch size. Speeds up validation.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Gradient Accumulation Steps</label>
            <input
              type="number"
              value={config.training.gradient_accumulation_steps || ''}
              onChange={(e) => updateTrainingField('gradient_accumulation_steps', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border rounded-md"
              min="1"
            />
            <p className="text-xs text-gray-500">
              Simulate larger batches without using more VRAM. Effective batch = batch_size × this value.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Warmup Steps</label>
            <input
              type="number"
              value={config.training.warmup_steps ?? ''}
              onChange={(e) => updateTrainingField('warmup_steps', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-md"
              min="0"
            />
            <p className="text-xs text-gray-500">
              Gradually increase learning rate for this many steps. Helps training stability. Use 50-100 or 10% of total steps.
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={(config.training as AdvancedTrainingConfig).pretokenize ?? true}
                onChange={(e) => updateTrainingField('pretokenize', e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Pre-tokenize Dataset (Recommended)</span>
            </label>
            <p className="text-xs text-gray-500">
              ✅ HIGHLY RECOMMENDED: Tokenize dataset once before training for 100-1000x speedup. Especially critical on Windows. Disable only if you need on-the-fly tokenization for dynamic data.
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={(config.training as AdvancedTrainingConfig).use_streaming ?? false}
                onChange={(e) => updateTrainingField('use_streaming', e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Enable Dataset Streaming</span>
            </label>
            <p className="text-xs text-gray-500">
              ⚠️ For large datasets (&gt;100K examples): Stream batches from disk instead of loading entire dataset into RAM. Reduces memory usage but disables pre-tokenization cache (slower training). Not recommended for most use cases.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Max Length</label>
            <input
              type="number"
              value={config.training.max_length || ''}
              onChange={(e) => updateTrainingField('max_length', parseInt(e.target.value) || 512)}
              className="w-full px-3 py-2 border rounded-md"
              min="1"
            />
            <p className="text-xs text-gray-500">
              Maximum tokens per training example. 512 = short responses, 2048 = long conversations. Higher = more VRAM.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Logging Steps</label>
            <input
              type="number"
              value={config.training.logging_steps ?? 50}
              onChange={(e) => updateTrainingField('logging_steps', parseInt(e.target.value) || 50)}
              className="w-full px-3 py-2 border rounded-md"
              min="1"
            />
            <p className="text-xs text-gray-500">
              How often to log training metrics (loss, learning rate). Lower = more detailed logs but slower.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Eval Steps</label>
            <input
              type="number"
              value={(config.training as AdvancedTrainingConfig).eval_steps ?? 100}
              onChange={(e) => updateTrainingField('eval_steps', parseInt(e.target.value) || 100)}
              className="w-full px-3 py-2 border rounded-md"
              min="1"
            />
            <p className="text-xs text-gray-500">
              How often to evaluate on validation set. Use 100-500 depending on dataset size.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">LR Scheduler Type</label>
            <select
              value={(config.training as AdvancedTrainingConfig).lr_scheduler_type ?? 'cosine'}
              onChange={(e) => updateTrainingField('lr_scheduler_type', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="linear">Linear</option>
              <option value="cosine">Cosine (Recommended)</option>
              <option value="cosine_with_restarts">Cosine with Restarts</option>
              <option value="polynomial">Polynomial</option>
              <option value="constant">Constant</option>
              <option value="constant_with_warmup">Constant with Warmup</option>
            </select>
            <p className="text-xs text-gray-500">
              How learning rate changes during training. Cosine gradually decreases LR in a smooth curve - works best for most cases.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Warmup Ratio</label>
            <input
              type="number"
              step="0.01"
              value={(config.training as AdvancedTrainingConfig).warmup_ratio ?? ''}
              onChange={(e) => updateTrainingField('warmup_ratio', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="Leave empty to use Warmup Steps"
              className="w-full px-3 py-2 border rounded-md"
              min="0"
              max="0.5"
            />
            <p className="text-xs text-gray-500">
              Alternative to Warmup Steps - fraction of total training for warmup (e.g., 0.03 = 3%). Leave empty to use Warmup Steps instead.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Save Strategy</label>
            <select
              value={(config.training as AdvancedTrainingConfig).save_strategy ?? 'epoch'}
              onChange={(e) => updateTrainingField('save_strategy', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="no">No Checkpoints</option>
              <option value="steps">Save Every N Steps</option>
              <option value="epoch">Save Every Epoch</option>
            </select>
            <p className="text-xs text-gray-500">
              When to save model checkpoints. &quot;epoch&quot; is recommended for most cases.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Save Steps</label>
            <input
              type="number"
              value={(config.training as AdvancedTrainingConfig).save_steps ?? 500}
              onChange={(e) => updateTrainingField('save_steps', parseInt(e.target.value) || 500)}
              className="w-full px-3 py-2 border rounded-md"
              min="1"
              disabled={(config.training as AdvancedTrainingConfig).save_strategy !== 'steps'}
            />
            <p className="text-xs text-gray-500">
              Save a checkpoint every N steps (only used when Save Strategy = &quot;steps&quot;).
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Save Total Limit</label>
            <input
              type="number"
              value={(config.training as AdvancedTrainingConfig).save_total_limit ?? 3}
              onChange={(e) => updateTrainingField('save_total_limit', parseInt(e.target.value) || 3)}
              className="w-full px-3 py-2 border rounded-md"
              min="1"
            />
            <p className="text-xs text-gray-500">
              Maximum number of checkpoints to keep. Oldest checkpoints are deleted first. Saves disk space while keeping recent backups.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Evaluation Strategy</label>
            <select
              value={(config.training as AdvancedTrainingConfig).evaluation_strategy ?? 'epoch'}
              onChange={(e) => updateTrainingField('evaluation_strategy', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              disabled={(config.data.train_split ?? 0.9) >= 1.0}
            >
              <option value="no">No Evaluation</option>
              <option value="steps">Evaluate Every N Steps</option>
              <option value="epoch">Evaluate Every Epoch</option>
            </select>
            <p className="text-xs text-gray-500">
              When to run evaluation. Disabled if Eval Split Ratio is 0.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="packing"
                checked={Boolean((config.training as AdvancedTrainingConfig).packing)}
                onChange={(e) => updateTrainingField('packing', e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="packing" className="text-sm font-medium">Packing Sequences</label>
            </div>
            <p className="text-xs text-gray-500">
              Pack multiple short sequences into one batch to maximize GPU utilization. Speeds up training on datasets with varying lengths. Recommended for efficiency.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="group_by_length"
                checked={Boolean((config.training as AdvancedTrainingConfig).group_by_length)}
                onChange={(e) => updateTrainingField('group_by_length', e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="group_by_length" className="text-sm font-medium">Group By Length</label>
            </div>
            <p className="text-xs text-gray-500">
              Groups sequences of similar lengths together in batches. Reduces padding waste and saves memory. Highly recommended for stability and efficiency.
            </p>
          </div>
        </div>
        </div>

        {/* 6. Precision & Mixed Precision */}
        <div className="space-y-4 border-b pb-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold">6. Precision & Mixed Precision</h3>
          </div>
          <p className="text-xs text-gray-600 italic mb-4">
            Mixed precision training speeds up training and reduces memory usage. Choose BFloat16 for best results with QLoRA.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bf16_main"
                  checked={Boolean((config.training as AdvancedTrainingConfig).bf16)}
                  onChange={(e) => {
                    updateTrainingField('bf16', e.target.checked);
                    if (e.target.checked) updateTrainingField('fp16', false);
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="bf16_main" className="text-sm font-medium">BFloat16 Training (Recommended)</label>
              </div>
              <p className="text-xs text-gray-500">
                <strong>What it is:</strong> Train using 16-bit Brain Float format (developed by Google for AI)<br/>
                <strong>Benefits:</strong> 2x faster training, 50% less memory than FP32, excellent numerical stability<br/>
                <strong>Best for:</strong> RTX 30/40 series, A100, H100 GPUs (Ampere/Hopper architecture)<br/>
                <strong>QLoRA recommendation:</strong> Enable this + set compute_dtype to bfloat16 in quantization settings above
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="fp16_main"
                  checked={Boolean((config.training as AdvancedTrainingConfig).fp16)}
                  onChange={(e) => {
                    updateTrainingField('fp16', e.target.checked);
                    if (e.target.checked) updateTrainingField('bf16', false);
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="fp16_main" className="text-sm font-medium">Float16 Training</label>
              </div>
              <p className="text-xs text-gray-500">
                <strong>What it is:</strong> Train using standard 16-bit floating point<br/>
                <strong>Benefits:</strong> Similar speed to BF16, but less numerical stability<br/>
                <strong>Best for:</strong> Older GPUs (GTX 1080 Ti, RTX 20 series) that don&apos;t support BF16<br/>
                <strong>Caution:</strong> May cause gradient overflow/underflow with some models. Use BF16 if available.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="gradient_checkpointing_main"
                  checked={Boolean((config.training as AdvancedTrainingConfig).gradient_checkpointing)}
                  onChange={(e) => updateTrainingField('gradient_checkpointing', e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="gradient_checkpointing_main" className="text-sm font-medium">Gradient Checkpointing</label>
              </div>
              <p className="text-xs text-gray-500">
                <strong>What it does:</strong> Trade compute for memory - recomputes gradients instead of storing them<br/>
                <strong>Memory savings:</strong> ~30% VRAM reduction<br/>
                <strong>Speed impact:</strong> ~20% slower training<br/>
                <strong>When to use:</strong> If you&apos;re running out of GPU memory (OOM errors)
              </p>
            </div>
          </div>
          <Alert className="mt-4">
            <AlertDescription className="text-xs">
              <strong>💡 QLoRA Best Practice:</strong> Enable BFloat16 here AND set compute_dtype to &quot;bfloat16&quot; in the Quantization section (section 3 above). 
              This combination provides the best training stability and memory efficiency. Don&apos;t enable both BF16 and FP16 - they&apos;re mutually exclusive.
            </AlertDescription>
          </Alert>
        </div>

        {/* 3. LoRA & Quantization (QLoRA) */}
        <div className="space-y-4 border-b pb-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold">3. LoRA & Quantization (QLoRA)</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="use_lora"
                checked={config.training.use_lora}
                onChange={(e) => updateTrainingField('use_lora', e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="use_lora" className="text-sm font-medium">Use LoRA</label>
            </div>
            <p className="text-xs text-gray-500">
              Low-Rank Adaptation - Train only small adapter layers instead of full model. Essential for fine-tuning large models on consumer GPUs.
            </p>
          </div>

          {config.training.use_lora && (
            <div className="space-y-4 pl-6">
              {/* Quick Start Guide */}
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-xs space-y-2">
                  <div>
                    <strong>🚀 Quick Start for QLoRA Fine-tuning:</strong>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li><strong>Basic LoRA:</strong> Keep defaults (Rank=16, Alpha=32, Dropout=0.1) - works for 95% of cases</li>
                    <li><strong>Quantization:</strong> Enable &quot;Load in 4-bit&quot; + NF4 type + BFloat16 compute dtype</li>
                    <li><strong>Training Precision:</strong> Enable &quot;BFloat16 Training&quot; (scroll down)</li>
                    <li><strong>Advanced:</strong> Only modify if you need specific target modules or task types</li>
                  </ol>
                  <div className="mt-2 pt-2 border-t border-blue-300">
                    <strong>💾 Memory estimates (7B model):</strong> No QLoRA ~14GB | With QLoRA ~3.5GB | 13B model with QLoRA ~6.5GB
                  </div>
                </AlertDescription>
              </Alert>

              {/* Basic LoRA Parameters (Legacy - Still Supported) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">LoRA R (Rank)</label>
                  <input
                    type="number"
                    value={config.training.lora_r || 16}
                    onChange={(e) => updateTrainingField('lora_r', parseInt(e.target.value) || 16)}
                    className="w-full px-3 py-2 border rounded-md"
                    min="1"
                  />
                  <p className="text-xs text-gray-500">
                    <strong>What it is:</strong> The &quot;size&quot; of the LoRA adapter layers. Think of it like training a smaller, focused version of the model.<br/>
                    <strong>Higher values (16-64):</strong> More learning capacity, better quality, uses more memory<br/>
                    <strong>Lower values (4-8):</strong> Faster training, less memory, may reduce quality<br/>
                    <strong>Recommended:</strong> 16 for most tasks, 32-64 for complex fine-tuning
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">LoRA Alpha</label>
                  <input
                    type="number"
                    value={config.training.lora_alpha || 32}
                    onChange={(e) => updateTrainingField('lora_alpha', parseInt(e.target.value) || 32)}
                    className="w-full px-3 py-2 border rounded-md"
                    min="1"
                  />
                  <p className="text-xs text-gray-500">
                    <strong>What it is:</strong> Controls how much the LoRA changes affect the base model. Scaling factor for learning.<br/>
                    <strong>Rule of thumb:</strong> Set to 2x the rank (if rank=16, use alpha=32)<br/>
                    <strong>Why it matters:</strong> Balances between preserving original model knowledge and learning new patterns
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">LoRA Dropout</label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.training.lora_dropout || 0.1}
                    onChange={(e) => updateTrainingField('lora_dropout', parseFloat(e.target.value) || 0.1)}
                    className="w-full px-3 py-2 border rounded-md"
                    min="0"
                    max="1"
                  />
                  <p className="text-xs text-gray-500">
                    <strong>What it is:</strong> Randomly &quot;turns off&quot; some LoRA connections during training to prevent overfitting.<br/>
                    <strong>0.0:</strong> No dropout (may overfit on small datasets)<br/>
                    <strong>0.1:</strong> 10% dropout (recommended default)<br/>
                    <strong>0.2-0.3:</strong> More aggressive (use for very small datasets)
                  </p>
                </div>
              </div>

              {/* Enhanced LoRA Config */}
              <div className="border-t pt-4 space-y-4">
                <h4 className="text-sm font-semibold">Advanced LoRA Configuration</h4>
                <p className="text-xs text-gray-600 italic">
                  These settings control exactly where and how LoRA adapters are applied to the model. 
                  Default values work for 95% of use cases - only modify if you know what you&apos;re doing!
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Target Modules</label>
                    <input
                      type="text"
                      value={(config.training as AdvancedTrainingConfig).lora_config?.target_modules?.join(', ') || 'q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj'}
                      onChange={(e) => updateTrainingField('lora_config', {
                        ...((config.training as AdvancedTrainingConfig).lora_config || {}),
                        target_modules: e.target.value.split(',').map(s => s.trim())
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj"
                    />
                    <p className="text-xs text-gray-500">
                      <strong>What it is:</strong> Which parts of the model get LoRA adapters applied.<br/>
                      <strong>Default (recommended):</strong> All 7 modules (attention + MLP) for best quality<br/>
                      <strong>q_proj, k_proj, v_proj, o_proj:</strong> Attention mechanism<br/>
                      <strong>gate_proj, up_proj, down_proj:</strong> Feed-forward network (MLP)<br/>
                      <strong>Budget option:</strong> Remove MLP modules to save 40% VRAM (slight quality loss)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bias</label>
                    <select
                      value={(config.training as AdvancedTrainingConfig).lora_config?.bias || 'none'}
                      onChange={(e) => updateTrainingField('lora_config', {
                        ...((config.training as AdvancedTrainingConfig).lora_config || {}),
                        bias: e.target.value
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="none">None (Recommended)</option>
                      <option value="all">All</option>
                      <option value="lora_only">LoRA Only</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      <strong>What it is:</strong> Whether to train bias parameters (small offset values in layers).<br/>
                      <strong>None (recommended):</strong> Don&apos;t train biases - fastest, uses least memory, works great<br/>
                      <strong>All:</strong> Train all biases - slightly better quality but slower and more memory<br/>
                      <strong>LoRA Only:</strong> Train only LoRA adapter biases - middle ground
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Task Type</label>
                    <select
                      value={(config.training as AdvancedTrainingConfig).lora_config?.task_type || 'CAUSAL_LM'}
                      onChange={(e) => updateTrainingField('lora_config', {
                        ...((config.training as AdvancedTrainingConfig).lora_config || {}),
                        task_type: e.target.value
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="CAUSAL_LM">Causal LM (Text Generation)</option>
                      <option value="SEQ_2_SEQ_LM">Seq2Seq LM (Translation/Summary)</option>
                      <option value="TOKEN_CLS">Token Classification (NER)</option>
                      <option value="SEQ_CLS">Sequence Classification (Sentiment)</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      <strong>Causal LM:</strong> ChatGPT-style text generation (most common - use this for chatbots, assistants)<br/>
                      <strong>Seq2Seq:</strong> Input→Output tasks like translation or summarization<br/>
                      <strong>Token Classification:</strong> Label each word (Named Entity Recognition)<br/>
                      <strong>Seq Classification:</strong> Classify entire text (sentiment analysis, spam detection)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Modules to Save</label>
                    <input
                      type="text"
                      value={(config.training as AdvancedTrainingConfig).lora_config?.modules_to_save?.join(', ') || ''}
                      onChange={(e) => updateTrainingField('lora_config', {
                        ...((config.training as AdvancedTrainingConfig).lora_config || {}),
                        modules_to_save: e.target.value ? e.target.value.split(',').map(s => s.trim()) : []
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="Optional: embed_tokens, lm_head"
                    />
                    <p className="text-xs text-gray-500">
                      <strong>What it is:</strong> Additional non-LoRA layers to fully train and save.<br/>
                      <strong>Leave empty (recommended):</strong> Only save LoRA adapters - smallest file size<br/>
                      <strong>Advanced use:</strong> Add &quot;embed_tokens, lm_head&quot; to train vocabulary/output layer (for new tokens)
                    </p>
                  </div>
                </div>
              </div>

              {/* Quantization Configuration */}
              <div className="border-t pt-4 space-y-4">
                <h4 className="text-sm font-semibold">Quantization (QLoRA)</h4>
                <p className="text-xs text-gray-600 italic">
                  <strong>The magic of QLoRA:</strong> Quantization compresses the model to use ~75% less GPU memory by storing numbers in 4-bit instead of 16-bit format. 
                  This lets you train 7B-13B models on consumer GPUs! Enable &quot;Load in 4-bit&quot; for QLoRA fine-tuning.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="load_in_4bit"
                        checked={(config.training as AdvancedTrainingConfig).quantization?.load_in_4bit ?? true}
                        onChange={(e) => updateTrainingField('quantization', {
                          ...((config.training as AdvancedTrainingConfig).quantization || {}),
                          load_in_4bit: e.target.checked,
                          load_in_8bit: false // Mutually exclusive
                        })}
                        className="w-4 h-4"
                      />
                      <label htmlFor="load_in_4bit" className="text-sm font-medium">Load in 4-bit (QLoRA)</label>
                    </div>
                    <p className="text-xs text-gray-500">
                      <strong>What it does:</strong> Loads the model in 4-bit precision instead of 16-bit<br/>
                      <strong>Memory savings:</strong> ~75% reduction (e.g., 13B model: 26GB → 6.5GB)<br/>
                      <strong>Quality:</strong> Minimal loss with NF4 quantization<br/>
                      <strong>Enable this for QLoRA!</strong> Required for training large models on consumer GPUs
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="load_in_8bit"
                        checked={(config.training as AdvancedTrainingConfig).quantization?.load_in_8bit ?? false}
                        onChange={(e) => updateTrainingField('quantization', {
                          ...((config.training as AdvancedTrainingConfig).quantization || {}),
                          load_in_8bit: e.target.checked,
                          load_in_4bit: false // Mutually exclusive
                        })}
                        className="w-4 h-4"
                      />
                      <label htmlFor="load_in_8bit" className="text-sm font-medium">Load in 8-bit</label>
                    </div>
                    <p className="text-xs text-gray-500">
                      <strong>What it does:</strong> Loads model in 8-bit (less aggressive than 4-bit)<br/>
                      <strong>Memory savings:</strong> ~50% reduction<br/>
                      <strong>Quality:</strong> Slightly better than 4-bit but uses more memory<br/>
                      <strong>When to use:</strong> If 4-bit is unstable (rare) or you have GPU memory to spare
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">4-bit Quantization Type</label>
                    <select
                      value={(config.training as AdvancedTrainingConfig).quantization?.bnb_4bit_quant_type || 'nf4'}
                      onChange={(e) => updateTrainingField('quantization', {
                        ...((config.training as AdvancedTrainingConfig).quantization || {}),
                        bnb_4bit_quant_type: e.target.value
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      disabled={!((config.training as AdvancedTrainingConfig).quantization?.load_in_4bit)}
                    >
                      <option value="nf4">NF4 - NormalFloat 4-bit (Recommended)</option>
                      <option value="fp4">FP4 - Float 4-bit</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      <strong>NF4 (recommended):</strong> Information-theoretically optimal for normally-distributed weights. Better quality than FP4.<br/>
                      <strong>FP4:</strong> Standard 4-bit floating point. Use if NF4 causes issues (very rare).<br/>
                      <strong>Technical:</strong> NF4 expects model weights follow normal distribution (they usually do)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Compute Dtype</label>
                    <select
                      value={(config.training as AdvancedTrainingConfig).quantization?.bnb_4bit_compute_dtype || 'bfloat16'}
                      onChange={(e) => updateTrainingField('quantization', {
                        ...((config.training as AdvancedTrainingConfig).quantization || {}),
                        bnb_4bit_compute_dtype: e.target.value
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="bfloat16">BFloat16 (Recommended)</option>
                      <option value="float16">Float16</option>
                      <option value="float32">Float32</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      <strong>What it is:</strong> Precision used for actual calculations (weights stored in 4-bit, but math happens in this precision)<br/>
                      <strong>BFloat16 (recommended):</strong> Best balance - same speed as FP16, better numerical stability<br/>
                      <strong>Float16:</strong> Slightly faster on older GPUs, may have stability issues<br/>
                      <strong>Float32:</strong> Slowest but most stable (use only if training is unstable)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="double_quant"
                        checked={(config.training as AdvancedTrainingConfig).quantization?.bnb_4bit_use_double_quant ?? true}
                        onChange={(e) => updateTrainingField('quantization', {
                          ...((config.training as AdvancedTrainingConfig).quantization || {}),
                          bnb_4bit_use_double_quant: e.target.checked
                        })}
                        className="w-4 h-4"
                        disabled={!((config.training as AdvancedTrainingConfig).quantization?.load_in_4bit)}
                      />
                      <label htmlFor="double_quant" className="text-sm font-medium">Use Double Quantization</label>
                    </div>
                    <p className="text-xs text-gray-500">
                      <strong>What it does:</strong> Also quantizes the quantization constants themselves (meta-quantization)<br/>
                      <strong>Memory savings:</strong> Additional ~0.4GB saved on 7B models<br/>
                      <strong>Quality impact:</strong> Negligible (less than 0.1% difference)<br/>
                      <strong>Recommended:</strong> Keep enabled for maximum memory efficiency
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Provider/Infrastructure card removed from UI - functionality preserved for future use */}

        {/* 5. Optimizer & Regularization */}
        <div className="space-y-4 border-b pb-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold">5. Optimizer & Regularization</h3>
          </div>
          <p className="text-xs text-gray-600 italic mb-4">
            Advanced optimizer settings. Default values work well for most cases - only modify if you understand optimization theory.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Optimizer</label>
              <input
                type="text"
                value={(config.training as AdvancedTrainingConfig).optim ?? 'paged_adamw_8bit'}
                onChange={(e) => updateTrainingField('optim', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
              <p className="text-xs text-gray-500">
                paged_adamw_8bit (recommended for QLoRA) - Memory efficient AdamW optimizer
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Weight Decay</label>
              <input
                type="number"
                step="0.0001"
                value={(config.training as AdvancedTrainingConfig).weight_decay ?? 0.01}
                onChange={(e) => updateTrainingField('weight_decay', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border rounded-md"
                min="0"
              />
              <p className="text-xs text-gray-500">
                Prevents overfitting by penalizing large weights. 0.01 is standard. Higher = more regularization.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Grad Norm</label>
              <input
                type="number"
                step="0.01"
                value={(config.training as AdvancedTrainingConfig).max_grad_norm ?? 0.3}
                onChange={(e) => updateTrainingField('max_grad_norm', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border rounded-md"
                min="0"
              />
              <p className="text-xs text-gray-500">
                Clips gradients to prevent training explosions. 0.3 works for QLoRA. Increase if training is too slow.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Adam Beta1</label>
              <input
                type="number"
                step="0.01"
                value={(config.training as AdvancedTrainingConfig).adam_beta1 ?? 0.9}
                onChange={(e) => updateTrainingField('adam_beta1', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border rounded-md"
                min="0"
                max="1"
              />
              <p className="text-xs text-gray-500">
                Momentum term for Adam optimizer. Default 0.9 is almost always correct.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Adam Beta2</label>
              <input
                type="number"
                step="0.001"
                value={(config.training as AdvancedTrainingConfig).adam_beta2 ?? 0.999}
                onChange={(e) => updateTrainingField('adam_beta2', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border rounded-md"
                min="0"
                max="1"
              />
              <p className="text-xs text-gray-500">
                Second momentum term for Adam. Default 0.999 is almost always correct.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Adam Epsilon</label>
              <input
                type="number"
                step="0.0000001"
                value={(config.training as AdvancedTrainingConfig).adam_epsilon ?? 1e-8}
                onChange={(e) => updateTrainingField('adam_epsilon', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border rounded-md"
                min="0"
              />
              <p className="text-xs text-gray-500">
                Numerical stability term. Prevents division by zero. Default 1e-8 is correct, never change this.
              </p>
            </div>
          </div>
        </div>

        {/* 8. Predictions Tracking (W&B-style) */}
        <div className="space-y-4 border-b pb-6">
          <PredictionsConfigPanel
            config={config.predictions || { enabled: false, sample_count: 5, sample_frequency: 'epoch' }}
            onChange={handlePredictionsChange}
            totalEpochs={config.training.num_epochs || 3}
            modelName={config.model.name}
          />
        </div>

        {/* Save/Cancel Buttons */}
        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} disabled={saving} variant="outline" className="flex-1 bg-muted text-foreground hover:bg-muted/80 border border-border">
            {saving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
          <Button onClick={onCancel} variant="outline" disabled={saving}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

console.log('[ConfigEditor] Component loaded');
