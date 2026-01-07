import crypto from 'crypto';
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

    // Generate secure job_token for metrics authentication
    const jobToken = crypto.randomBytes(32).toString('base64url');
    console.log('[LocalProvider] Generated job_token for job:', jobId);

    // Determine backend URL (server-side vs client-side)
    const backendUrl = typeof window !== 'undefined'
      ? '' // Client-side: relative URL
      : process.env.NEXT_PUBLIC_BASE_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || (process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000');

    if (typeof window === 'undefined' && backendUrl === 'http://localhost:3000' && process.env.NODE_ENV === 'production') {
      console.error('[LocalProvider] CRITICAL: NEXT_PUBLIC_BASE_URL not set in production! Database operations may fail.');
    }

    // Create job record in database with job_token
    try {
      const createJobResponse = await fetch(`${backendUrl}/api/training/local/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_id: jobId,
          user_id: options?.userId,
          model_name: modelName,
          dataset_path: datasetPath,
          status: 'pending',
          config: config,
          job_token: jobToken,
        }),
      });

      if (!createJobResponse.ok) {
        const errorData = await createJobResponse.json().catch(() => ({ error: createJobResponse.statusText }));
        throw new Error(`Failed to create job record: ${errorData.error || createJobResponse.statusText}`);
      }

      console.log('[LocalProvider] Job record created in database');
    } catch (dbError) {
      console.error('[LocalProvider] Failed to create job record:', dbError);
      throw new Error(`Database initialization failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
    }

    // Generate config using ScriptBuilder
    const trainingConfigJson = ScriptBuilder.generateTrainingConfig(modelName, datasetPath, config);

    // Check if we should dispatch directly to agent or let agent poll
    const agentUrl = options?.agentUrl || process.env.NEXT_PUBLIC_TRAINING_BACKEND_URL || '';
    const isLocalAgent = this.isLocalUrl(agentUrl);

    if (isLocalAgent) {
      // Local development: call agent directly
      console.log('[LocalProvider] Local agent detected, dispatching job directly');
      const result = await this.provider.executeTraining({
          config: trainingConfigJson,
          dataset_path: datasetPath,
          execution_id: jobId,
          name: modelName,
          user_id: options?.userId,
          access_token: options?.accessToken,
          job_token: jobToken,
      });

      if (!result.success) {
          throw new Error(result.error || 'Failed to start local training job');
      }

      return result.job_id;
    } else {
      // Remote deployment: agent will poll for the job
      console.log('[LocalProvider] Remote deployment, job queued for agent polling');
      return jobId;
    }
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

  /**
   * Check if URL points to a local agent (localhost or 127.0.0.1)
   */
  private isLocalUrl(url: string): boolean {
    if (!url) return true; // Default to local if no URL
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      return hostname === 'localhost' || hostname === '127.0.0.1';
    } catch {
      // If URL parsing fails, check for localhost patterns
      const lower = url.toLowerCase();
      return lower.includes('localhost') || lower.includes('127.0.0.1');
    }
  }
}
