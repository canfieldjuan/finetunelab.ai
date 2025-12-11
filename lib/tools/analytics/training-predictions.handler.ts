/**
 * Training Predictions Tool Handler
 *
 * Provides access to model predictions generated during training.
 * Operations:
 * - get_predictions: Get predictions for a job with filters
 * - get_predictions_by_epoch: Predictions from specific epoch
 * - compare_epochs: Compare predictions across epochs
 * - list_available_epochs: Which epochs have predictions
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface TrainingPredictionsArgs {
  operation: 'get_predictions' | 'get_predictions_by_epoch' | 'compare_epochs' | 'list_available_epochs';
  jobId: string;
  epoch?: number;
  epochs?: number[];
  limit?: number;
  offset?: number;
}

export async function executeTrainingPredictions(
  args: Record<string, unknown>,
  userId: string,
  authHeader?: string,
  authClient?: any
): Promise<any> {
  console.log('[TrainingPredictions] Executing:', args.operation);

  const { operation, jobId, epoch, epochs, limit, offset } = args as unknown as TrainingPredictionsArgs;

  if (!jobId) {
    return { error: 'jobId is required for all training prediction operations' };
  }

  try {
    switch (operation) {
      case 'get_predictions':
        return await getPredictions(jobId, userId, authHeader!, limit, offset);

      case 'get_predictions_by_epoch':
        if (epoch === undefined) {
          return { error: 'epoch parameter is required for get_predictions_by_epoch' };
        }
        return await getPredictionsByEpoch(jobId, epoch, userId, authHeader!, limit, offset);

      case 'compare_epochs':
        if (!epochs || epochs.length === 0) {
          return { error: 'epochs array is required for compare_epochs' };
        }
        return await compareEpochs(jobId, epochs, userId, authHeader!);

      case 'list_available_epochs':
        return await listAvailableEpochs(jobId, userId, authHeader!);

      default:
        return { error: `Unknown operation: ${operation}` };
    }
  } catch (error) {
    console.error('[TrainingPredictions] Error:', error);
    return {
      error: error instanceof Error ? error.message : 'Training predictions operation failed'
    };
  }
}

/**
 * Get predictions for a training job
 */
async function getPredictions(
  jobId: string,
  userId: string,
  authHeader: string,
  limit: number = 50,
  offset: number = 0
): Promise<any> {
  console.log('[TrainingPredictions] Getting predictions for job:', jobId);

  try {
    // Call the existing predictions API endpoint
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/training/predictions/${jobId}?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TrainingPredictions] API error:', response.status, errorText);
      return {
        error: `Failed to get predictions: ${response.status}`,
        details: errorText.slice(0, 200),
      };
    }

    const data = await response.json();
    console.log('[TrainingPredictions] Retrieved', data.predictions?.length || 0, 'predictions');

    return {
      success: true,
      job_id: data.job_id,
      predictions: data.predictions || [],
      total_count: data.total_count || 0,
      epoch_count: data.epoch_count || 0,
      limit,
      offset,
    };
  } catch (error) {
    console.error('[TrainingPredictions] getPredictions error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get predictions'
    };
  }
}

/**
 * Get predictions from a specific epoch
 */
async function getPredictionsByEpoch(
  jobId: string,
  epoch: number,
  userId: string,
  authHeader: string,
  limit: number = 50,
  offset: number = 0
): Promise<any> {
  console.log('[TrainingPredictions] Getting predictions for job:', jobId, 'epoch:', epoch);

  try {
    // Call the API with epoch filter
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/training/predictions/${jobId}?epoch=${epoch}&limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TrainingPredictions] API error:', response.status, errorText);
      return {
        error: `Failed to get predictions for epoch ${epoch}: ${response.status}`,
        details: errorText.slice(0, 200),
      };
    }

    const data = await response.json();
    console.log('[TrainingPredictions] Retrieved', data.predictions?.length || 0, 'predictions for epoch', epoch);

    return {
      success: true,
      job_id: data.job_id,
      epoch: epoch,
      predictions: data.predictions || [],
      total_count: data.total_count || 0,
      limit,
      offset,
    };
  } catch (error) {
    console.error('[TrainingPredictions] getPredictionsByEpoch error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get predictions by epoch'
    };
  }
}

/**
 * Compare predictions across multiple epochs
 */
async function compareEpochs(
  jobId: string,
  epochs: number[],
  userId: string,
  authHeader: string
): Promise<any> {
  console.log('[TrainingPredictions] Comparing epochs:', epochs, 'for job:', jobId);

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return { error: 'Server configuration error' };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify job ownership
    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobError || !job) {
      return { error: 'Job not found or access denied' };
    }

    // Get predictions for each epoch
    const epochData: Record<number, any[]> = {};

    for (const epoch of epochs) {
      const { data: predictions, error } = await supabase
        .from('training_predictions')
        .select('*')
        .eq('job_id', jobId)
        .eq('epoch', epoch)
        .order('sample_index', { ascending: true });

      if (error) {
        console.error('[TrainingPredictions] Error fetching epoch', epoch, ':', error);
        epochData[epoch] = [];
      } else {
        epochData[epoch] = predictions || [];
      }
    }

    console.log('[TrainingPredictions] Comparison data:', Object.keys(epochData).length, 'epochs');

    // Calculate comparison statistics
    const comparison = {
      job_id: jobId,
      epochs: epochs.sort((a, b) => a - b),
      epoch_data: epochData,
      statistics: {} as Record<number, any>,
    };

    // Add statistics for each epoch
    for (const epoch of epochs) {
      const predictions = epochData[epoch];
      comparison.statistics[epoch] = {
        total_predictions: predictions.length,
        samples_with_predictions: predictions.filter(p => p.prediction && p.prediction.trim().length > 0).length,
        average_prediction_length: predictions.length > 0
          ? predictions.reduce((sum, p) => sum + (p.prediction?.length || 0), 0) / predictions.length
          : 0,
      };
    }

    return {
      success: true,
      comparison,
    };
  } catch (error) {
    console.error('[TrainingPredictions] compareEpochs error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to compare epochs'
    };
  }
}

/**
 * List which epochs have predictions available
 */
async function listAvailableEpochs(
  jobId: string,
  userId: string,
  authHeader: string
): Promise<any> {
  console.log('[TrainingPredictions] Listing available epochs for job:', jobId);

  try {
    // Call the epochs API endpoint
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/training/predictions/${jobId}/epochs`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TrainingPredictions] API error:', response.status, errorText);
      return {
        error: `Failed to list epochs: ${response.status}`,
        details: errorText.slice(0, 200),
      };
    }

    const data = await response.json();
    console.log('[TrainingPredictions] Found', data.epochs?.length || 0, 'epochs');

    return {
      success: true,
      job_id: data.job_id,
      epochs: data.epochs || [],
      epoch_count: data.epoch_count || 0,
    };
  } catch (error) {
    console.error('[TrainingPredictions] listAvailableEpochs error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to list available epochs'
    };
  }
}
