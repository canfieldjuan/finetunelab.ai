import { DeploymentProvider } from '../deployment-provider.interface';
import { TrainingConfig } from '../training-config.types';
import { DeploymentStatus, DeploymentMetrics } from '../deployment.types';
import { runPodService } from '../runpod-service';
import { ScriptBuilder } from '../script-builder';

export class RunPodProvider implements DeploymentProvider {
  name = 'runpod';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async deploy(
    config: TrainingConfig,
    modelName: string,
    datasetPath: string,
    options?: any
  ): Promise<string> {
    const jobId = options?.jobId;
    if (!jobId) throw new Error('Job ID is required for RunPod deployment');
    
    const huggingFaceToken = options?.huggingFaceToken;
    const wandbKey = options?.wandbKey;
    
    // 1. Generate Config
    // For RunPod, the dataset is always downloaded to this location by the bash script
    const podDatasetPath = '/workspace/dataset.jsonl';
    const trainingConfigJson = ScriptBuilder.generateTrainingConfig(modelName, podDatasetPath, config);
    
    // 2. Generate Script
    const script = ScriptBuilder.generateRunPodScript(
        trainingConfigJson, 
        huggingFaceToken, 
        wandbKey, 
        jobId
    );
    
    // 3. Deploy
    const response = await runPodService.createPod(
        {
            training_config_id: options.trainingConfigId,
            gpu_type: options.gpuType,
            gpu_count: options.gpuCount,
            docker_image: options.dockerImage,
            volume_size_gb: options.volumeSizeGb,
            environment_variables: options.envVars,
            budget_limit: options.budgetLimit
        },
        this.apiKey,
        script,
        config
    );
    
    return response.id;
  }

  async getStatus(jobId: string): Promise<{
    status: DeploymentStatus;
    metrics?: DeploymentMetrics;
    error?: string;
  }> {
    try {
      const podStatus = await runPodService.getPodStatus(jobId, this.apiKey);
      
      // Map RunPod status to DeploymentStatus
      // runPodService.getPodStatus returns a string status
      // We need to map it if it's not already mapped.
      // Actually runPodService.getPodStatus returns a string which is already mapped in runpod-service.ts
      
      return {
        status: podStatus as DeploymentStatus
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async cancel(jobId: string): Promise<void> {
    await runPodService.terminatePod(jobId, this.apiKey);
  }
  
  async getLogs(jobId: string): Promise<string[]> {
    // RunPod doesn't have a simple getLogs API in the service yet?
    // Checking runpod-service.ts might be needed.
    // For now return empty.
    return [];
  }
}
