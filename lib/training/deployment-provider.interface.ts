import type { TrainingConfig } from './training-config.types';
import type { DeploymentStatus, DeploymentMetrics } from './deployment.types';

export interface DeploymentProvider {
  name: string;
  
  /**
   * Deploy a training job
   * @param config The training configuration
   * @param modelName Name of the model to train
   * @param datasetPath Path to the dataset
   * @param options Provider-specific options (e.g. GPU type, API keys)
   * @returns Promise resolving to the Job ID
   */
  deploy(
    config: TrainingConfig,
    modelName: string,
    datasetPath: string,
    options?: any
  ): Promise<string>;

  /**
   * Get the status of a deployment
   * @param jobId The Job ID returned by deploy()
   */
  getStatus(jobId: string): Promise<{
    status: DeploymentStatus;
    metrics?: DeploymentMetrics;
    error?: string;
  }>;

  /**
   * Cancel a running deployment
   * @param jobId The Job ID
   */
  cancel(jobId: string): Promise<void>;
  
  /**
   * Get logs for a deployment
   * @param jobId The Job ID
   */
  getLogs(jobId: string): Promise<string[]>;
}
