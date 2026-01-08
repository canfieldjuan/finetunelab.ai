import { DeploymentProvider } from './deployment-provider.interface';
import { RunPodProvider } from './providers/runpod-provider';
import { LocalProvider } from './providers/local-provider';
import { TrainingConfig } from './training-config.types';
import { DeploymentStatus, DeploymentMetrics } from './deployment.types';

export class TrainingDeploymentService {
  private providers: Map<string, DeploymentProvider> = new Map();

  constructor() {
    // Initialize providers with environment variables
    if (process.env.RUNPOD_API_KEY) {
        this.registerProvider(new RunPodProvider(process.env.RUNPOD_API_KEY));
    }
    
    if (process.env.NEXT_PUBLIC_TRAINING_SERVER_URL) {
        this.registerProvider(new LocalProvider(
            process.env.NEXT_PUBLIC_TRAINING_SERVER_URL,
            process.env.TRAINING_SERVER_API_KEY
        ));
    }
  }

  registerProvider(provider: DeploymentProvider) {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): DeploymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider ${name} not found or not configured`);
    }
    return provider;
  }

  async deployJob(
    providerName: string,
    config: TrainingConfig,
    modelName: string,
    datasetPath: string,
    options?: unknown
  ): Promise<string> {
    const provider = this.getProvider(providerName);
    return provider.deploy(config, modelName, datasetPath, options);
  }

  async getJobStatus(
    providerName: string,
    jobId: string
  ): Promise<{
    status: DeploymentStatus;
    metrics?: DeploymentMetrics;
    error?: string;
  }> {
    const provider = this.getProvider(providerName);
    return provider.getStatus(jobId);
  }

  async cancelJob(providerName: string, jobId: string): Promise<void> {
    const provider = this.getProvider(providerName);
    return provider.cancel(jobId);
  }
}

export const trainingDeploymentService = new TrainingDeploymentService();
