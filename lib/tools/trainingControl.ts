// Training Control Tool for Analytics Assistant
// Purpose: Enable LLM to control training jobs using saved configurations
// Date: 2025-11-03
// Operations: list_configs, get_config, list_datasets, attach_dataset, start_training

import type { ToolDefinition, ToolExecutionResult } from './types';
import type { TrainingConfigRecord } from '@/lib/training/training-config.types';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';

export interface TrainingControlParams {
  operation: 'list_configs' | 'get_config' | 'list_datasets' | 'attach_dataset' | 'start_training';
  config_id?: string;
  dataset_id?: string;
  target?: 'local' | 'kaggle' | 'hf-spaces' | 'runpod';
}

interface ValidationError {
  field: string;
  message: string;
}

function validateUUID(value: string | undefined, fieldName: string): ValidationError | null {
  if (!value) {
    return { field: fieldName, message: `${fieldName} is required` };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return { field: fieldName, message: `${fieldName} must be a valid UUID` };
  }

  return null;
}

// Training request body types
type LocalTrainingRequest = {
  public_id: string;
  method: string;
  provider: 'local';
};

type DeployTrainingRequest = {
  config_id: string;
};

type TrainingRequestBody = LocalTrainingRequest | DeployTrainingRequest;

function validateTarget(target: string | undefined): ValidationError | null {
  const validTargets = ['local', 'kaggle', 'hf-spaces', 'runpod'];
  if (target && !validTargets.includes(target)) {
    return {
      field: 'target',
      message: `Invalid target. Must be one of: ${validTargets.join(', ')}`
    };
  }
  return null;
}

async function listConfigs(userId: string): Promise<ToolExecutionResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        error: 'Supabase configuration missing'
      };
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/training_configs?user_id=eq.${userId}&order=created_at.desc`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch configs: ${response.statusText}`
      };
    }

    const configs = await response.json();

    return {
      success: true,
      result: {
        configs: configs.map((config: TrainingConfigRecord) => ({
          id: config.id,
          name: config.name,
          description: config.description,
          template_type: config.template_type,
          created_at: config.created_at,
          updated_at: config.updated_at
        })),
        total: configs.length
      }
    };
  } catch (error) {
    console.error('[TrainingControl] list_configs error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error listing configs'
    };
  }
}

async function getConfig(userId: string, configId: string): Promise<ToolExecutionResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        error: 'Supabase configuration missing'
      };
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/training_configs?id=eq.${configId}&user_id=eq.${userId}`,
      {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch config: ${response.statusText}`
      };
    }

    const configs = await response.json();

    if (!configs || configs.length === 0) {
      return {
        success: false,
        error: 'Configuration not found or access denied'
      };
    }

    const config = configs[0];

    return {
      success: true,
      result: {
        id: config.id,
        name: config.name,
        description: config.description,
        template_type: config.template_type,
        config_json: config.config_json,
        created_at: config.created_at,
        updated_at: config.updated_at
      }
    };
  } catch (error) {
    console.error('[TrainingControl] get_config error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error getting config'
    };
  }
}

async function listDatasets(userId: string): Promise<ToolExecutionResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        error: 'Supabase configuration missing'
      };
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/training_datasets?user_id=eq.${userId}&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch datasets: ${response.statusText}`
      };
    }

    const datasets = await response.json();

    return {
      success: true,
      result: {
        datasets: datasets.map((dataset: TrainingDatasetRecord) => ({
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          format: dataset.format,
          file_size_bytes: dataset.file_size_bytes,
          total_examples: dataset.total_examples,
          created_at: dataset.created_at
        })),
        total: datasets.length
      }
    };
  } catch (error) {
    console.error('[TrainingControl] list_datasets error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error listing datasets'
    };
  }
}

async function attachDataset(
  userId: string,
  configId: string,
  datasetId: string
): Promise<ToolExecutionResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        error: 'Supabase configuration missing'
      };
    }

    const verifyConfigResponse = await fetch(
      `${supabaseUrl}/rest/v1/training_configs?id=eq.${configId}&user_id=eq.${userId}`,
      {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      }
    );

    if (!verifyConfigResponse.ok || (await verifyConfigResponse.json()).length === 0) {
      return {
        success: false,
        error: 'Configuration not found or access denied'
      };
    }

    const verifyDatasetResponse = await fetch(
      `${supabaseUrl}/rest/v1/training_datasets?id=eq.${datasetId}&user_id=eq.${userId}`,
      {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      }
    );

    if (!verifyDatasetResponse.ok || (await verifyDatasetResponse.json()).length === 0) {
      return {
        success: false,
        error: 'Dataset not found or access denied'
      };
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/training_config_datasets`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          config_id: configId,
          dataset_id: datasetId,
          user_id: userId
        })
      }
    );

    if (!response.ok) {
      if (response.status === 409) {
        return {
          success: true,
          result: { message: 'Dataset already attached to this configuration' }
        };
      }
      return {
        success: false,
        error: `Failed to attach dataset: ${response.statusText}`
      };
    }

    return {
      success: true,
      result: { message: 'Dataset attached successfully' }
    };
  } catch (error) {
    console.error('[TrainingControl] attach_dataset error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error attaching dataset'
    };
  }
}

async function startTraining(
  userId: string,
  configId: string,
  target: string = 'local'
): Promise<ToolExecutionResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        error: 'Supabase configuration missing'
      };
    }

    const configResponse = await fetch(
      `${supabaseUrl}/rest/v1/training_configs?id=eq.${configId}&user_id=eq.${userId}`,
      {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      }
    );

    if (!configResponse.ok) {
      return {
        success: false,
        error: `Failed to fetch config: ${configResponse.statusText}`
      };
    }

    const configs = await configResponse.json();
    if (!configs || configs.length === 0) {
      return {
        success: false,
        error: 'Configuration not found or access denied'
      };
    }

    const config = configs[0];

    const datasetsResponse = await fetch(
      `${supabaseUrl}/rest/v1/training_config_datasets?config_id=eq.${configId}&user_id=eq.${userId}`,
      {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      }
    );

    if (!datasetsResponse.ok) {
      return {
        success: false,
        error: 'Failed to check attached datasets'
      };
    }

    const attachedDatasets = await datasetsResponse.json();
    if (!attachedDatasets || attachedDatasets.length === 0) {
      return {
        success: false,
        error: 'No datasets attached to this configuration. Please attach at least one dataset before starting training.'
      };
    }

    let targetEndpoint: string;
    let requestBody: TrainingRequestBody;

    const trainingMethod = config.config_json?.training?.method || 'sft';

    switch (target) {
      case 'local':
        targetEndpoint = `${supabaseUrl.replace('/rest/v1', '')}/api/training/execute`;
        requestBody = {
          public_id: config.public_id || config.id,
          method: trainingMethod,
          provider: 'local'
        };
        break;

      case 'kaggle':
        targetEndpoint = `${supabaseUrl.replace('/rest/v1', '')}/api/training/deploy/kaggle`;
        requestBody = {
          config_id: configId
        };
        break;

      case 'hf-spaces':
        targetEndpoint = `${supabaseUrl.replace('/rest/v1', '')}/api/training/deploy/hf-spaces`;
        requestBody = {
          config_id: configId
        };
        break;

      case 'runpod':
        targetEndpoint = `${supabaseUrl.replace('/rest/v1', '')}/api/training/deploy/runpod`;
        requestBody = {
          config_id: configId
        };
        break;

      default:
        return {
          success: false,
          error: `Invalid target: ${target}`
        };
    }

    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Training start failed: ${response.statusText}. ${errorText}`
      };
    }

    const result = await response.json();

    return {
      success: true,
      result: {
        message: 'Training started successfully',
        target: target,
        config_name: config.name,
        job_id: result.job_id || result.execution_id,
        execution_id: result.execution_id,
        status: result.status || 'running',
        monitoring_url: result.monitoring_url || `/training/monitor/${result.job_id || result.execution_id}`
      }
    };
  } catch (error) {
    console.error('[TrainingControl] start_training error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error starting training'
    };
  }
}

export const trainingControlTool: ToolDefinition = {
  name: 'training_control',
  description: 'Control training jobs: list configurations, attach datasets, and start training',
  version: '1.0.0',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Training operation to perform',
        enum: ['list_configs', 'get_config', 'list_datasets', 'attach_dataset', 'start_training']
      },
      config_id: {
        type: 'string',
        description: 'Configuration ID (required for get_config, attach_dataset, start_training)'
      },
      dataset_id: {
        type: 'string',
        description: 'Dataset ID (required for attach_dataset)'
      },
      target: {
        type: 'string',
        description: 'Training target platform (for start_training, default: local)',
        enum: ['local', 'kaggle', 'hf-spaces', 'runpod']
      }
    },
    required: ['operation']
  },
  config: {
    enabled: true,
    timeout_ms: 30000
  },

  async execute(
    params: Record<string, unknown>,
    conversationId?: string,
    userId?: string
  ): Promise<ToolExecutionResult> {
    console.log('[TrainingControl] execute called with operation:', params.operation);

    if (!userId) {
      return {
        success: false,
        error: 'User authentication required'
      };
    }

    const typedParams = params as unknown as TrainingControlParams;
    const { operation, config_id, dataset_id, target } = typedParams;

    if (!operation) {
      return {
        success: false,
        error: 'operation parameter is required'
      };
    }

    try {
      switch (operation) {
        case 'list_configs':
          return await listConfigs(userId);

        case 'get_config': {
          const configIdError = validateUUID(config_id, 'config_id');
          if (configIdError) {
            return {
              success: false,
              error: configIdError.message
            };
          }
          return await getConfig(userId, config_id!);
        }

        case 'list_datasets':
          return await listDatasets(userId);

        case 'attach_dataset': {
          const configIdError = validateUUID(config_id, 'config_id');
          if (configIdError) {
            return {
              success: false,
              error: configIdError.message
            };
          }
          const datasetIdError = validateUUID(dataset_id, 'dataset_id');
          if (datasetIdError) {
            return {
              success: false,
              error: datasetIdError.message
            };
          }
          return await attachDataset(userId, config_id!, dataset_id!);
        }

        case 'start_training': {
          const configIdError = validateUUID(config_id, 'config_id');
          if (configIdError) {
            return {
              success: false,
              error: configIdError.message
            };
          }
          const targetError = validateTarget(target);
          if (targetError) {
            return {
              success: false,
              error: targetError.message
            };
          }
          return await startTraining(userId, config_id!, target || 'local');
        }

        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`
          };
      }
    } catch (error) {
      console.error('[TrainingControl] Execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during operation'
      };
    }
  }
};
