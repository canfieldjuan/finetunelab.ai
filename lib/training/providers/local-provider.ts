import { DeploymentProvider } from '../deployment-provider.interface';
import { TrainingConfig } from '../training-config.types';
import { DeploymentStatus, DeploymentMetrics } from '../deployment.types';
import { LocalTrainingProvider } from '../../services/training-providers/local.provider';
import { ScriptBuilder } from '../script-builder';

export class LocalProvider implements DeploymentProvider {
  name = 'local';
  private provider: LocalTrainingProvider;

  constructor(baseUrl: string, apiKey?: string) {
    this.provider = new LocalTrainingProvider({
        type: 'local',
        base_url: baseUrl,
        api_key: apiKey,
        timeout_ms: 5000
    });
  }

  async deploy(
    config: TrainingConfig,
    modelName: string,
    datasetPath: string,
    options?: any
  ): Promise<string> {
    const jobId = options?.jobId;
    if (!jobId) throw new Error('Job ID is required for Local deployment');

    // Generate config using ScriptBuilder
    const trainingConfigJson = ScriptBuilder.generateTrainingConfig(modelName, datasetPath, config);

    const result = await this.provider.executeTraining({
        config: trainingConfigJson,
        dataset_path: datasetPath,
        execution_id: jobId,
        name: modelName,
        user_id: options?.userId,
        access_token: options?.accessToken
    });

    if (!result.success) {
        throw new Error(result.error || 'Failed to start local training job');
    }
    
    return result.job_id;
  }

  async getStatus(jobId: string): Promise<{
    status: DeploymentStatus;
    metrics?: DeploymentMetrics;
    error?: string;
  }> {
    const statusData = await this.provider.getStatus(jobId);
    
    if (!statusData) {
        return { status: 'failed', error: 'Job not found' };
    }

    // Map status
    let status: DeploymentStatus = 'queued';
    switch (statusData.status) {
        case 'running': status = 'training'; break;
        case 'pending': status = 'starting'; break;
        case 'paused': status = 'stopped'; break;
        default: status = statusData.status as DeploymentStatus;
    }

    return {
        status,
        metrics: {
            epoch: statusData.current_epoch,
            step: statusData.current_step,
            loss: statusData.loss,
            learning_rate: statusData.learning_rate,
            progress_percentage: statusData.progress
        },
        error: statusData.error
    };
  }

  async cancel(jobId: string): Promise<void> {
    await this.provider.cancelJob(jobId);
  }

  async getLogs(jobId: string): Promise<string[]> {
    return this.provider.getLogs(jobId, 1000); // Get last 1000 lines
  }
}
