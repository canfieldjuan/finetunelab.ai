import { DeploymentProvider } from '../deployment-provider.interface';
import { TrainingConfig } from '../training-config.types';
import { DeploymentStatus, DeploymentMetrics, RunPodGPUType } from '../deployment.types';
import { runPodService } from '../runpod-service';
import { ScriptBuilder } from '../script-builder';

interface RunPodDeployOptions {
  jobId: string;
  huggingFaceToken?: string;
  wandbKey?: string;
  trainingConfigId: string;
  gpuType?: RunPodGPUType;
  gpuCount?: number;
  dockerImage?: string;
  volumeSizeGb?: number;
  envVars?: Record<string, string>;
  budgetLimit?: number;
}

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
    options?: RunPodDeployOptions
  ): Promise<string> {
    if (!options?.jobId) throw new Error('Job ID is required for RunPod deployment');

    const jobId = options.jobId;
    const huggingFaceToken = options.huggingFaceToken || '';
    const wandbKey = options.wandbKey;
    
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

    return response.pod_id;
  }

  async getStatus(jobId: string): Promise<{
    status: DeploymentStatus;
    metrics?: DeploymentMetrics;
    error?: string;
  }> {
    try {
      const podStatus = await runPodService.getPodStatus(jobId, this.apiKey);

      // getPodStatus returns RunPodDeploymentStatus which has .status property
      return {
        status: podStatus.status,
        metrics: podStatus.metrics,
        error: podStatus.error_message
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async cancel(jobId: string): Promise<void> {
    await runPodService.stopPod(jobId, this.apiKey);
  }

  async getLogs(jobId: string): Promise<string[]> {
    // RunPod doesn't provide a direct logs API via GraphQL
    // Logs are available in the RunPod web console or via SSH
    const consoleUrl = `https://www.runpod.io/console/pods/${jobId}`;

    return [
      '⚠️  RunPod Log Access Information',
      '─────────────────────────────────────────────────────────',
      '',
      'RunPod does not provide a programmatic logs API.',
      'You can access logs through:',
      '',
      `1. Web Console: ${consoleUrl}`,
      '   - Click on the pod',
      '   - Navigate to the "Logs" tab',
      '   - View real-time training output',
      '',
      '2. SSH Access (for advanced users):',
      '   - Use RunPod SSH button in console',
      '   - Access logs at: /workspace/training_output.log',
      '',
      'The training script outputs progress to the RunPod console automatically.',
      ''
    ];
  }
}
