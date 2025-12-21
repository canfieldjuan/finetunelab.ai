/**
 * RunPod Serverless API Service
 * Purpose: Interact with RunPod Serverless API for inference endpoint deployment
 * Date: 2025-11-12
 * Updated: 2025-11-26 - Switched from non-existent REST API to GraphQL API
 *
 * RunPod Serverless API Documentation: https://docs.runpod.io/serverless/endpoints/overview
 * RunPod GraphQL API: https://docs.runpod.io/docs/graphql-api
 *
 * NOTE: RunPod uses GraphQL for ALL API operations (pods, endpoints, templates)
 * - Training pods: podFindAndDeployOnDemand mutation
 * - Serverless endpoints: saveEndpoint mutation
 */

import type {
  RunPodServerlessGPU,
  RunPodServerlessDeploymentRequest,
  RunPodServerlessDeploymentResponse,
  RunPodServerlessDeploymentStatus,
  InferenceStatus,
  InferenceCost,
  InferenceMetrics,
} from './deployment.types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * RunPod GraphQL response wrapper
 */
interface RunPodGraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    path?: string[];
  }>;
}

/**
 * RunPod saveEndpoint mutation response
 */
interface SaveEndpointResponse {
  saveEndpoint: {
    id: string;
    name: string;
    gpuIds: string;
    idleTimeout: number;
    templateId: string;
    workersMax: number;
    workersMin: number;
  };
}

/**
 * RunPod getEndpoint query response
 */
interface GetEndpointResponse {
  myself: {
    endpoints: Array<{
      id: string;
      name: string;
      gpuIds: string;
      idleTimeout: number;
      templateId: string;
      workersMax: number;
      workersMin: number;
      workersStandby?: number;
    }>;
  };
}

/**
 * RunPod deleteEndpoint mutation response
 */
interface DeleteEndpointResponse {
  deleteEndpoint: null;
}

/**
 * RunPod saveTemplate mutation response
 */
interface SaveTemplateResponse {
  saveTemplate: {
    id: string;
    name: string;
    imageName: string;
    isServerless: boolean;
    containerDiskInGb: number;
    volumeInGb: number;
    env: Array<{ key: string; value: string }>;
  };
}

/**
 * RunPod pod deployment response (for vLLM pods)
 */
interface PodDeployResponse {
  podFindAndDeployOnDemand: {
    id: string;
    name: string;
    imageName: string;
    desiredStatus: string;
    machine?: {
      gpuTypeId?: string;
      costPerHr?: number;
    };
  };
}

/**
 * RunPod pod query response
 */
interface PodQueryResponse {
  pod: {
    id: string;
    name: string;
    desiredStatus: string;
    runtime?: {
      uptimeInSeconds?: number;
      ports?: Array<{
        ip: string;
        isIpPublic: boolean;
        privatePort: number;
        publicPort: number;
        type: string;
      }>;
    };
    machine?: {
      gpuTypeId?: string;
      costPerHr?: number;
    };
  };
}

/**
 * vLLM Pod deployment request
 */
export interface VLLMPodDeploymentRequest {
  deployment_name: string;
  model_id: string;              // HuggingFace model ID (e.g., 'meta-llama/Llama-2-7b-chat-hf')
  gpu_type?: RunPodServerlessGPU;
  gpu_count?: number;
  hf_token?: string;             // For gated models
  max_model_len?: number;        // Max context length
  quantization?: 'awq' | 'gptq' | 'squeezellm' | 'fp8' | null;
  tensor_parallel_size?: number; // For multi-GPU
  budget_limit?: number;
  volume_size_gb?: number;
  // Network volume support
  use_network_volume?: boolean;
  data_center_id?: string;       // e.g., 'US-EAST-1', required if use_network_volume is true
  network_volume_id?: string;  // To attach an existing volume
}

// ============================================================================
// RUNPOD SERVERLESS API SERVICE
// ============================================================================

export class RunPodServerlessService {
  private graphqlUrl = 'https://api.runpod.io/graphql';

  /**
   * Create authentication headers for RunPod API
   */
  private getAuthHeaders(apiKey: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  /**
   * Execute GraphQL query/mutation
   */
  private async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
    apiKey: string
  ): Promise<T> {
    console.log('[RunPodServerlessService] GraphQL request to:', this.graphqlUrl);

    const response = await fetch(this.graphqlUrl, {
      method: 'POST',
      headers: this.getAuthHeaders(apiKey),
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RunPod API error: ${response.status} - ${errorText}`);
    }

    const result: RunPodGraphQLResponse<T> = await response.json();

    if (result.errors && result.errors.length > 0) {
      throw new Error(`RunPod GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
    }

    if (!result.data) {
      throw new Error('RunPod API returned no data');
    }

    return result.data;
  }

  private restUrl_v1 = 'https://rest.runpod.io/v1';

  /**
   * Execute REST API request
   */
  private async _restRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
    apiKey: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    console.log(`[RunPodServerlessService] REST request: ${method} ${this.restUrl_v1}${endpoint}`);

    const response = await fetch(`${this.restUrl_v1}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RunPod REST API error: ${response.status} - ${errorText}`);
    }

    if (response.status === 204) {
      return null as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Find a network volume by its name.
   */
  async getNetworkVolumeByName(
    name: string,
    apiKey: string
  ): Promise<{ id: string; name: string; size: number } | null> {
    console.log(`[RunPodServerlessService] Searching for network volume with name: ${name}`);
    try {
      const volumes = await this._restRequest<Array<{ id: string; name: string; size: number }>>(
        '/networkvolumes',
        'GET',
        apiKey
      );

      const volume = volumes.find(v => v.name === name);

      if (volume) {
        console.log(`[RunPodServerlessService] Found network volume:`, volume);
        return volume;
      } else {
        console.log(`[RunPodServerlessService] No network volume found with name: ${name}`);
        return null;
      }
    } catch (error) {
      console.error(`[RunPodServerlessService] Error getting network volumes:`, error);
      return null;
    }
  }

  /**
   * Create a new network volume.
   */
  async createNetworkVolume(
    name: string,
    size: number,
    dataCenterId: string,
    apiKey: string
  ): Promise<{ id: string; name: string; size: number }> {
    console.log(`[RunPodServerlessService] Creating network volume: ${name} (${size}GB) in ${dataCenterId}`);
    try {
      const newVolume = await this._restRequest<{ id: string; name: string; size: number }>(
        '/networkvolumes',
        'POST',
        apiKey,
        {
          name,
          size,
          dataCenterId,
        }
      );
      console.log(`[RunPodServerlessService] Network volume created successfully:`, newVolume);
      return newVolume;
    } catch (error) {
      console.error(`[RunPodServerlessService] Error creating network volume:`, error);
      throw error;
    }
  }

  /**
   * Delete a network volume by its ID.
   */
  async deleteNetworkVolume(
    volumeId: string,
    apiKey: string
  ): Promise<void> {
    console.log(`[RunPodServerlessService] Deleting network volume: ${volumeId}`);
    try {
      await this._restRequest<null>(
        `/networkvolumes/${volumeId}`,
        'DELETE',
        apiKey
      );
      console.log(`[RunPodServerlessService] Network volume ${volumeId} deleted successfully.`);
    } catch (error) {
      console.error(`[RunPodServerlessService] Error deleting network volume ${volumeId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // vLLM POD DEPLOYMENT (Recommended for inference)
  // ============================================================================

  /**
   * Deploy a vLLM inference pod on RunPod
   *
   * This is the RECOMMENDED way to deploy models for inference:
   * - Uses official vLLM Docker image optimized for inference
   * - OpenAI-compatible API endpoint (port 8000)
   * - Supports quantization (AWQ, GPTQ, etc.)
   * - Multi-GPU tensor parallelism
   * - Pay per hour (not per request)
   *
   * @param request - vLLM deployment configuration
   * @param apiKey - RunPod API key
   * @returns Pod deployment response with endpoint URL
   */
  async deployVLLMPod(
    request: VLLMPodDeploymentRequest,
    apiKey: string
  ): Promise<RunPodServerlessDeploymentResponse> {
    console.log('[RunPodServerlessService] Deploying vLLM pod...');

    try {
      const gpuTypeId = this.mapGPUTypeForPod(request.gpu_type);
      const gpuCount = request.gpu_count || 1;

      // Build vLLM serve command arguments
      const vllmArgs: string[] = ['--host', '0.0.0.0', '--port', '8000'];
      const maxModelLen = request.max_model_len || 32768;
      vllmArgs.push('--max-model-len', maxModelLen.toString());
      vllmArgs.push('--enable-auto-tool-choice');
      vllmArgs.push('--tool-call-parser', 'hermes');
      if (request.quantization) vllmArgs.push('--quantization', request.quantization);
      if (request.tensor_parallel_size && request.tensor_parallel_size > 1) {
        vllmArgs.push('--tensor-parallel-size', request.tensor_parallel_size.toString());
      } else if (gpuCount > 1) {
        vllmArgs.push('--tensor-parallel-size', gpuCount.toString());
      }

      // Environment variables
      const envVars: Array<{ key: string; value: string }> = [];
      if (request.hf_token) {
        envVars.push({ key: 'HF_TOKEN', value: request.hf_token });
        envVars.push({ key: 'HUGGING_FACE_HUB_TOKEN', value: request.hf_token });
      }

      const mutation = `
        mutation CreatePod($input: PodFindAndDeployOnDemandInput!) {
          podFindAndDeployOnDemand(input: $input) { id name imageName desiredStatus machine { gpuTypeId costPerHr } }
        }
      `;

      const podName = `vllm-${request.deployment_name}-${Date.now().toString(36)}`;
      const volumeMountPath = '/models';
      let networkVolumeIdToAttach: string | undefined = undefined;
      
      if (request.use_network_volume) {
        console.log('[RunPodServerlessService] Network volume deployment requested.');
        const volumeName = `vol-${request.model_id.replace(/\//g, '--')}`;
        const existingVolume = await this.getNetworkVolumeByName(volumeName, apiKey);

        if (existingVolume) {
          console.log(`[RunPodServerlessService] Found existing network volume: ${existingVolume.id}. Attaching it.`);
          networkVolumeIdToAttach = existingVolume.id;
        } else {
          console.log(`[RunPodServerlessService] Network volume not found, starting one-time setup process.`);
          const dataCenterId = request.data_center_id || 'US-CA-2';
          const volumeSize = request.volume_size_gb || 50;
          
          // 1. Create Volume
          const newVolume = await this.createNetworkVolume(volumeName, volumeSize, dataCenterId, apiKey);

          try {
            // 2. Launch Downloader Pod
            const downloaderPod = await this._launchDownloaderPod(newVolume.id, request.model_id, request.hf_token, apiKey);

            // 3. Wait for downloader to finish
            await this._pollUntilPodTerminated(downloaderPod.id, apiKey);
            
            // 4. Terminate downloader pod
            await this.terminatePod(downloaderPod.id, apiKey);
            
            console.log(`[RunPodServerlessService] Volume ${newVolume.id} is populated with model ${request.model_id}.`);
            networkVolumeIdToAttach = newVolume.id;

          } catch (downloadError) {
            console.error(`[RunPodServerlessService] Downloader pod process failed. Cleaning up volume ${newVolume.id}.`, downloadError);
            await this.deleteNetworkVolume(newVolume.id, apiKey);
            throw new Error(`Failed to download model to network volume: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
          }
        }
      }

      const variables = {
        input: {
          cloudType: 'SECURE',
          gpuTypeId,
          gpuCount,
          name: podName,
          imageName: 'vllm/vllm-openai:latest',
          volumeInGb: request.volume_size_gb || 50,
          containerDiskInGb: 20,
          env: envVars,
          ports: '8000/http',
          dockerArgs: `vllm serve --model ${request.model_id} ${vllmArgs.join(' ')}`,
          volumeMountPath: '/root/.cache',
        },
      };

      if (networkVolumeIdToAttach) {
        console.log(`[RunPodServerlessService] Attaching volume ${networkVolumeIdToAttach} to the pod.`);
        (variables.input as any).networkVolumeId = networkVolumeIdToAttach;
        variables.input.volumeMountPath = volumeMountPath;
        const modelFolderName = request.model_id.split('/').pop();
        variables.input.dockerArgs = `vllm serve --model ${volumeMountPath}/${modelFolderName} ${vllmArgs.join(' ')}`;
      }
      
      console.log('[RunPodServerlessService] Creating vLLM pod:', {
        name: podName,
        model: request.model_id,
        gpu: `${gpuCount}x ${gpuTypeId}`,
        dockerArgs: variables.input.dockerArgs,
        volumeAttached: !!networkVolumeIdToAttach,
      });

      const startTime = Date.now();
      const data = await this.graphql<PodDeployResponse>(mutation, variables, apiKey);
      const duration = Date.now() - startTime;
      console.log(`[RunPodServerlessService] GraphQL mutation for vLLM pod creation took ${duration}ms`);

      const pod = data.podFindAndDeployOnDemand;
      console.log('[RunPodServerlessService] vLLM pod created:', pod.id);

      this.pollUntilActive(pod.id, apiKey, true).catch(err => {
        console.error(`[RunPodServerlessService] Background polling failed for pod ${pod.id}:`, err);
      });

      const costPerHour = pod.machine?.costPerHr || 0;
      const cost: InferenceCost = {
        cost_per_request: 0,
        budget_limit: request.budget_limit || 0,
        current_spend: 0,
        request_count: 0,
        estimated_daily_cost: costPerHour * 24,
      };

      return {
        deployment_id: pod.id,
        endpoint_id: pod.id,
        endpoint_url: `https://${pod.id}-8000.proxy.runpod.net/v1`,
        status: 'deploying',
        network_volume_id: networkVolumeIdToAttach,
        gpu_type: request.gpu_type || 'NVIDIA RTX A4000',
        model_type: 'merged-model',
        base_model: request.model_id,
        cost,
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[RunPodServerlessService] vLLM pod deployment failed:', error);
      throw error;
    }
  }

  /**
   * Get vLLM pod status and endpoint URL
   */
  async getVLLMPodStatus(
    podId: string,
    apiKey: string
  ): Promise<RunPodServerlessDeploymentStatus> {
    console.log('[RunPodServerlessService] Getting vLLM pod status:', podId);

    try {
      const query = `
        query GetPod($podId: String!) {
          pod(input: { podId: $podId }) {
            id
            name
            desiredStatus
            runtime {
              uptimeInSeconds
              ports {
                ip
                isIpPublic
                privatePort
                publicPort
                type
              }
            }
            machine {
              gpuTypeId
              costPerHr
            }
          }
        }
      `;

      const data = await this.graphql<PodQueryResponse>(
        query,
        { podId },
        apiKey
      );

      const pod = data.pod;

      // Map pod status
      let status: InferenceStatus;
      switch (pod.desiredStatus) {
        case 'RUNNING':
          status = 'active';
          break;
        case 'CREATED':
        case 'PENDING':
          status = 'deploying';
          break;
        case 'EXITED':
        case 'TERMINATED':
          status = 'stopped';
          break;
        default:
          status = 'deploying';
      }

      // Get the public endpoint URL
      let endpointUrl = `https://${podId}-8000.proxy.runpod.net/v1`;

      // If pod has public IP, use that
      const httpPort = pod.runtime?.ports?.find(p => p.privatePort === 8000 && p.isIpPublic);
      if (httpPort) {
        endpointUrl = `http://${httpPort.ip}:${httpPort.publicPort}/v1`;
      }

      const costPerHour = pod.machine?.costPerHr || 0;
      const uptimeHours = (pod.runtime?.uptimeInSeconds || 0) / 3600;

      const cost: InferenceCost = {
        cost_per_request: 0,
        budget_limit: 0,
        current_spend: costPerHour * uptimeHours,
        request_count: 0,
        estimated_daily_cost: costPerHour * 24,
      };

      return {
        deployment_id: podId,
        endpoint_id: podId,
        endpoint_url: endpointUrl,
        status,
        cost,
        last_checked_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[RunPodServerlessService] Get vLLM pod status failed:', error);
      throw error;
    }
  }

  /**
   * Terminate a pod.
   */
  async terminatePod(
    podId: string,
    apiKey: string
  ): Promise<void> {
    console.log('[RunPodServerlessService] Terminating pod:', podId);

    try {
      const mutation = `
        mutation TerminatePod($podId: String!) {
          podTerminate(input: { podId: $podId })
        }
      `;

      await this.graphql<{ podTerminate: void }>(
        mutation,
        { podId },
        apiKey
      );

      console.log('[RunPodServerlessService] Pod terminated:', podId);
    } catch (error) {
      console.error(`[RunPodServerlessService] Failed to terminate pod ${podId}:`, error);
      throw error;
    }
  }

  /**
   * Poll for active status of a pod or endpoint and log the time taken.
   */
  async pollUntilActive(
    deploymentId: string,
    apiKey: string,
    isPod: boolean
  ): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds
    const maxWaitTime = 15 * 60 * 1000; // 15 minutes

    console.log(`[RunPodServerlessService] Polling for active status of ${isPod ? 'pod' : 'endpoint'}: ${deploymentId}`);

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = isPod
          ? await this.getVLLMPodStatus(deploymentId, apiKey)
          : await this.getEndpointStatus(deploymentId, apiKey);

        if (status.status === 'active') {
          const duration = Date.now() - startTime;
          console.log(`[RunPodServerlessService] ${isPod ? 'Pod' : 'Endpoint'} ${deploymentId} is active after ${duration}ms.`);
          return;
        } else {
            console.log(`[RunPodServerlessService] Current status for ${deploymentId}: ${status.status}. Waiting...`);
        }
      } catch (error) {
        console.error(`[RunPodServerlessService] Error polling status for ${deploymentId}:`, error);
        // Continue polling even if one check fails
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    const duration = Date.now() - startTime;
    console.error(`[RunPodServerlessService] TIMEOUT: ${isPod ? 'Pod' : 'Endpoint'} ${deploymentId} did not become active within ${maxWaitTime}ms. Last status check after ${duration}ms.`);
  }

  /**
   * Launch a temporary pod to download a model to a network volume.
   */
  private async _launchDownloaderPod(
    volumeId: string,
    modelId: string,
    hfToken: string | undefined,
    apiKey: string,
  ): Promise<PodDeployResponse['podFindAndDeployOnDemand']> {
    console.log(`[RunPodServerlessService] Launching downloader pod for model ${modelId} on volume ${volumeId}`);

    const modelFolderName = modelId.split('/').pop();
    const volumeMountPath = '/models';
    
    // Command to install huggingface_hub and download the model.
    // --local-dir-use-symlinks False is important to ensure the actual files are on the volume.
    const downloadCommand = `
        pip install huggingface-hub && \
        huggingface-cli login --token ${hfToken || ''} && \
        huggingface-cli download ${modelId} --local-dir ${volumeMountPath}/${modelFolderName} --local-dir-use-symlinks False
    `.trim().replace(/\s+/g, ' ');

    const mutation = `
        mutation CreatePod($input: PodFindAndDeployOnDemandInput!) {
          podFindAndDeployOnDemand(input: $input) { id name imageName desiredStatus }
        }
      `;

    const variables = {
        input: {
            cloudType: 'SECURE',
            gpuCount: 0,
            vcpuCount: 2,
            memoryInGb: 4,
            name: `downloader-${modelId.replace(/\//g, '--')}-${Date.now().toString(36)}`,
            imageName: 'python:3.10-slim',
            networkVolumeId: volumeId,
            volumeMountPath: volumeMountPath,
            // The pod will execute this command and then exit.
            dockerArgs: `bash -c "${downloadCommand}"`,
        },
    };

    console.log('[RunPodServerlessService] Downloader pod variables:', {
      ...variables.input,
      dockerArgs: downloadCommand, // Log clean command
    });

    const data = await this.graphql<PodDeployResponse>(mutation, variables, apiKey);
    console.log('[RunPodServerlessService] Downloader pod created:', data.podFindAndDeployOnDemand.id);
    return data.podFindAndDeployOnDemand;
  }

  /**
   * Poll a pod's status until it is terminated/exited.
   */
  private async _pollUntilPodTerminated(
    podId: string,
    apiKey: string,
  ): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds
    const maxWaitTime = 30 * 60 * 1000; // 30 minutes for large models

    console.log(`[RunPodServerlessService] Polling for termination of pod: ${podId}`);

    while (Date.now() - startTime < maxWaitTime) {
        try {
            const podState = await this.getVLLMPodStatus(podId, apiKey);
            // getVLLMPodStatus maps EXITED and TERMINATED to 'stopped'
            if (podState.status === 'stopped') {
                const duration = Date.now() - startTime;
                console.log(`[RunPodServerlessService] Pod ${podId} terminated after ${duration}ms.`);
                return;
            } else {
                console.log(`[RunPodServerlessService] Pod ${podId} status: ${podState.status}. Waiting for termination...`);
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('pod not found')) {
                 console.log(`[RunPodServerlessService] Pod ${podId} not found, assuming terminated.`);
                 return;
            }
            console.error(`[RunPodServerlessService] Error polling status for pod ${podId}:`, error);
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Pod ${podId} did not terminate within ${maxWaitTime / 1000}s.`);
  }

  /**
   * Map GPU type to RunPod GPU ID for pod deployment
   * Returns full GPU names as required by podFindAndDeployOnDemand
   */
  private mapGPUTypeForPod(gpuType?: RunPodServerlessGPU | string): string {
    const gpuMap: Record<string, string> = {
      'NVIDIA RTX A4000': 'NVIDIA RTX A4000',
      'NVIDIA RTX A5000': 'NVIDIA RTX A5000',
      'NVIDIA RTX A6000': 'NVIDIA RTX A6000',
      'NVIDIA A40': 'NVIDIA A40',
      'NVIDIA A100 40GB': 'NVIDIA A100 80GB PCIe',
      'NVIDIA A100 80GB': 'NVIDIA A100-SXM4-80GB',
      'NVIDIA H100': 'NVIDIA H100 PCIe',
      // Also handle short IDs from UI
      'RTX_A4000': 'NVIDIA RTX A4000',
      'RTX_A5000': 'NVIDIA RTX A5000',
      'RTX_A6000': 'NVIDIA RTX A6000',
      'A100_PCIE': 'NVIDIA A100 80GB PCIe',
      'A100_SXM': 'NVIDIA A100-SXM4-80GB',
      'H100_PCIE': 'NVIDIA H100 PCIe',
    };

    return gpuMap[gpuType || 'NVIDIA RTX A4000'] || 'NVIDIA RTX A4000';
  }

  // ============================================================================
  // SERVERLESS ENDPOINT DEPLOYMENT (Alternative)
  // ============================================================================

  /**
   * Create a serverless template for inference
   * Templates define the Docker image and environment for serverless workers
   *
   * @see https://docs.runpod.io/sdks/graphql/manage-pod-templates
   */
  async createTemplate(
    request: RunPodServerlessDeploymentRequest,
    apiKey: string
  ): Promise<string> {
    console.log('[RunPodServerlessService] Creating serverless template...');

    const templateName = `inference-${request.deployment_name}-${Date.now()}`;

    // Build environment variables array for RunPod worker-vllm (serverless)
    // Reference: https://github.com/runpod-workers/worker-vllm
    console.log('[RunPodServerlessService] Configuring environment variables for worker-vllm');

    const envVars: Array<{ key: string; value: string }> = [
      { key: 'MODEL_NAME', value: request.model_storage_url },
      { key: 'TRUST_REMOTE_CODE', value: 'true' },
      { key: 'MODEL_REVISION', value: 'main' },
      { key: 'BASE_PATH', value: '/runpod-volume' },
    ];

    console.log('[RunPodServerlessService] Base environment variables configured:', {
      model: request.model_storage_url,
      envVarsCount: envVars.length,
    });

    // Add HuggingFace token if provided (for gated models)
    if (request.environment_variables?.HUGGINGFACE_TOKEN) {
      envVars.push({ key: 'HF_TOKEN', value: request.environment_variables.HUGGINGFACE_TOKEN });
      console.log('[RunPodServerlessService] HF_TOKEN configured for gated model access');
    } else {
      console.log('[RunPodServerlessService] No HF_TOKEN provided - public models only');
    }

    // Add any other custom environment variables
    if (request.environment_variables) {
      const customVars = Object.entries(request.environment_variables)
        .filter(([key]) => key !== 'HUGGINGFACE_TOKEN');

      if (customVars.length > 0) {
        console.log('[RunPodServerlessService] Adding custom environment variables:', customVars.length);
        for (const [key, value] of customVars) {
          envVars.push({ key, value });
          const displayValue = String(value).length > 20 ? `${String(value).substring(0, 20)}...` : value;
          console.log(`[RunPodServerlessService] - ${key}: ${displayValue}`);
        }
      }
    }

    const mutation = `
      mutation SaveTemplate($input: SaveTemplateInput!) {
        saveTemplate(input: $input) {
          id
          name
          imageName
          isServerless
          containerDiskInGb
          volumeInGb
          env { key value }
        }
      }
    `;

    const defaultImage = 'runpod/worker-v1-vllm:v2.8.0stable-cuda12.1.0';
    const containerDiskGb = 30;
    const volumeSizeGb = 100;

    const variables = {
      input: {
        name: templateName,
        imageName: request.docker_image || defaultImage,
        isServerless: true,
        containerDiskInGb: containerDiskGb,
        volumeInGb: volumeSizeGb,
        dockerArgs: '',
        env: envVars,
      },
    };

    console.log('[RunPodServerlessService] Template configuration:', {
      name: templateName,
      image: variables.input.imageName,
      isServerless: true,
      containerDisk: `${containerDiskGb}GB`,
      volume: `${volumeSizeGb}GB`,
      envVarsCount: envVars.length,
    });

    try {
      const data = await this.graphql<SaveTemplateResponse>(
        mutation,
        variables,
        apiKey
      );

      console.log('[RunPodServerlessService] Template created successfully');
      console.log('[RunPodServerlessService] Template ID:', data.saveTemplate.id);
      console.log('[RunPodServerlessService] Template Name:', data.saveTemplate.name);

      return data.saveTemplate.id;
    } catch (error) {
      console.error('[RunPodServerlessService] Template creation failed:', error);
      console.error('[RunPodServerlessService] Template config:', {
        name: templateName,
        image: variables.input.imageName,
      });
      throw error;
    }
  }

  /**
   * Create a new serverless inference endpoint
   *
   * Flow:
   * 1. If no template_id provided, create a template first using saveTemplate
   * 2. Create endpoint using saveEndpoint with the template ID
   *
   * @see https://docs.runpod.io/sdks/graphql/manage-pod-templates
   */
  async createEndpoint(
    request: RunPodServerlessDeploymentRequest,
    apiKey: string
  ): Promise<RunPodServerlessDeploymentResponse> {
    console.log('[RunPodServerlessService] Creating serverless endpoint via GraphQL...');

    try {
      // Step 1: Get or create template
      let templateId = request.template_id;

      if (!templateId) {
        console.log('[RunPodServerlessService] No template_id provided, creating template...');
        templateId = await this.createTemplate(request, apiKey);
      }

      // Step 2: Map GPU type to RunPod GPU ID
      const gpuIds = this.mapGPUType(request.gpu_type);

      // Step 3: Create endpoint with template
      const mutation = `
        mutation SaveEndpoint($input: EndpointInput!) {
          saveEndpoint(input: $input) {
            id
            name
            gpuIds
            idleTimeout
            templateId
            workersMax
            workersMin
          }
        }
      `;

      const endpointName = request.deployment_name || `inference-${Date.now()}`;
      const variables = {
        input: {
          name: endpointName,
          gpuIds: gpuIds,
          idleTimeout: request.idle_timeout_seconds ?? 5,
          templateId: templateId,
          // Default to 1 max worker to stay within typical quota limits (5 total)
          workersMax: request.max_workers ?? 1,
          workersMin: request.min_workers ?? 0,
        },
      };

      console.log('[RunPodServerlessService] Creating endpoint with:', {
        name: endpointName,
        gpuIds,
        templateId,
        workers: `${variables.input.workersMin}-${variables.input.workersMax}`,
      });

      const startTime = Date.now();
      const data = await this.graphql<SaveEndpointResponse>(
        mutation,
        variables,
        apiKey
      );
      const duration = Date.now() - startTime;
      console.log(`[RunPodServerlessService] GraphQL mutation for endpoint creation took ${duration}ms`);

      const endpoint = data.saveEndpoint;
      console.log('[RunPodServerlessService] Endpoint created successfully');
      console.log('[RunPodServerlessService] Endpoint ID:', endpoint.id);
      console.log('[RunPodServerlessService] Endpoint Name:', endpoint.name);

      // Start polling for active status without blocking the response
      this.pollUntilActive(endpoint.id, apiKey, false).catch(err => {
        console.error(`[RunPodServerlessService] Background polling failed for endpoint ${endpoint.id}:`, err);
      });

      // Calculate cost structure
      const costPerRequest = this.estimateCostPerRequest(request.gpu_type);

      const cost: InferenceCost = {
        cost_per_request: costPerRequest,
        budget_limit: request.budget_limit,
        current_spend: 0,
        request_count: 0,
        estimated_daily_cost: 0,
      };

      const runSyncUrl = `https://api.runpod.ai/v2/${endpoint.id}/runsync`;
      const runAsyncUrl = `https://api.runpod.ai/v2/${endpoint.id}/run`;

      console.log('[RunPodServerlessService] Endpoint URLs configured:');
      console.log('[RunPodServerlessService] - Sync (recommended):', runSyncUrl);
      console.log('[RunPodServerlessService] - Async/Stream:', runAsyncUrl);

      const deploymentResponse: RunPodServerlessDeploymentResponse = {
        deployment_id: endpoint.id,
        endpoint_id: endpoint.id,
        endpoint_url: runSyncUrl,
        status: 'deploying',
        gpu_type: request.gpu_type || 'NVIDIA RTX A4000',
        model_type: request.model_type,
        base_model: request.base_model,
        cost,
        created_at: new Date().toISOString(),
      };

      console.log('[RunPodServerlessService] Deployment response prepared');
      return deploymentResponse;
    } catch (error) {
      console.error('[RunPodServerlessService] Create endpoint failed:', error);
      throw error;
    }
  }

  /**
   * Get serverless endpoint status
   * Uses GraphQL query to get endpoint details
   */
  async getEndpointStatus(
    endpointId: string,
    apiKey: string
  ): Promise<RunPodServerlessDeploymentStatus> {
    console.log('[RunPodServerlessService] Getting endpoint status:', endpointId);

    try {
      const query = `
        query GetMyEndpoints {
          myself {
            endpoints {
              id
              name
              gpuIds
              idleTimeout
              templateId
              workersMax
              workersMin
              workersStandby
            }
          }
        }
      `;

      const data = await this.graphql<GetEndpointResponse>(
        query,
        {},
        apiKey
      );

      // Find the specific endpoint
      const endpoint = data.myself.endpoints.find(e => e.id === endpointId);

      if (!endpoint) {
        throw new Error(`Endpoint ${endpointId} not found`);
      }

      // Endpoints are considered active if they exist and have workers configured
      const status: InferenceStatus = 'active';

      // Note: RunPod GraphQL doesn't provide request statistics
      // Those would need to be tracked separately or fetched via different means
      const metrics: InferenceMetrics | undefined = undefined;

      const costPerRequest = this.estimateCostPerRequest('NVIDIA RTX A4000', 2);

      const cost: InferenceCost = {
        cost_per_request: costPerRequest,
        budget_limit: 0,
        current_spend: 0,
        request_count: 0,
      };

      const deploymentStatus: RunPodServerlessDeploymentStatus = {
        deployment_id: endpointId,
        endpoint_id: endpointId,
        endpoint_url: `https://api.runpod.ai/v2/${endpointId}/run`,
        status,
        metrics,
        cost,
        last_checked_at: new Date().toISOString(),
      };

      console.log('[RunPodServerlessService] Endpoint found:', endpoint.name);

      return deploymentStatus;
    } catch (error) {
      console.error('[RunPodServerlessService] Get status failed:', error);
      throw error;
    }
  }

  /**
   * Stop/terminate a serverless endpoint
   * Uses GraphQL deleteEndpoint mutation
   */
  async stopEndpoint(
    endpointId: string,
    apiKey: string
  ): Promise<void> {
    console.log('[RunPodServerlessService] Stopping endpoint:', endpointId);

    try {
      const mutation = `
        mutation DeleteEndpoint($id: String!) {
          deleteEndpoint(id: $id)
        }
      `;

      await this.graphql<DeleteEndpointResponse>(
        mutation,
        { id: endpointId },
        apiKey
      );

      console.log('[RunPodServerlessService] Endpoint deleted');
    } catch (error) {
      console.error('[RunPodServerlessService] Stop endpoint failed:', error);
      throw error;
    }
  }

  /**
   * Get GPU cost per second for RunPod Serverless
   *
   * Pricing updated: November 2024
   * Source: https://www.runpod.io/serverless-gpu
   */
  private getGPUCostPerSecond(gpuType?: RunPodServerlessGPU): number {
    // RunPod Serverless pricing ($/second) - Nov 2024
    const costMap: Record<RunPodServerlessGPU, number> = {
      'NVIDIA RTX A4000': 0.00012,    // $0.00012/sec
      'NVIDIA RTX A5000': 0.00015,    // $0.00015/sec
      'NVIDIA RTX A6000': 0.00026,    // $0.00026/sec
      'NVIDIA A40': 0.00030,          // $0.00030/sec
      'NVIDIA A100 40GB': 0.00044,    // $0.00044/sec
      'NVIDIA A100 80GB': 0.00069,    // $0.00069/sec
      'NVIDIA H100': 0.00145,         // $0.00145/sec
    };

    return costMap[gpuType || 'NVIDIA RTX A4000'] || 0.00012;
  }

  /**
   * Estimate cost per request based on GPU type and request duration
   *
   * RunPod Serverless charges: (compute_seconds × $/sec) + base_request_fee
   *
   * @param gpuType - GPU type to use
   * @param requestDurationSeconds - Expected request duration (default: 2 seconds for typical inference)
   * @returns Estimated cost per request in USD
   */
  estimateCostPerRequest(gpuType?: RunPodServerlessGPU, requestDurationSeconds: number = 2): number {
    const costPerSecond = this.getGPUCostPerSecond(gpuType);
    const baseRequestFee = 0.0001; // RunPod's per-request fee

    const computeCost = requestDurationSeconds * costPerSecond;
    const totalCost = computeCost + baseRequestFee;

    return totalCost;
  }

  /**
   * Estimate total cost for a deployment
   *
   * @param expectedRequests - Number of requests expected
   * @param gpuType - GPU type to use
   * @param avgRequestDurationSeconds - Average request duration (default: 2 seconds)
   */
  estimateTotalCost(
    expectedRequests: number,
    gpuType?: RunPodServerlessGPU,
    avgRequestDurationSeconds: number = 2
  ): {
    cost_per_request: number;
    total_requests: number;
    estimated_total_cost: number;
    avg_request_duration_seconds: number;
  } {
    const costPerRequest = this.estimateCostPerRequest(gpuType, avgRequestDurationSeconds);
    const totalCost = expectedRequests * costPerRequest;

    console.log(
      `[RunPodServerlessService] Cost estimate: ${expectedRequests} requests × $${costPerRequest.toFixed(4)} (${avgRequestDurationSeconds}s) = $${totalCost.toFixed(2)}`
    );

    return {
      cost_per_request: costPerRequest,
      total_requests: expectedRequests,
      estimated_total_cost: totalCost,
      avg_request_duration_seconds: avgRequestDurationSeconds,
    };
  }

  /**
   * Map GPU type to RunPod GPU ID
   *
   * NOTE: These IDs may need to be updated based on RunPod's current GPU offerings
   */
  private mapGPUType(gpuType?: RunPodServerlessGPU): string {
    const gpuMap: Record<RunPodServerlessGPU, string> = {
      'NVIDIA RTX A4000': 'AMPERE_16',
      'NVIDIA RTX A5000': 'AMPERE_24',
      'NVIDIA RTX A6000': 'AMPERE_48',
      'NVIDIA A40': 'AMPERE_48',
      'NVIDIA A100 40GB': 'AMPERE_40',
      'NVIDIA A100 80GB': 'AMPERE_80',
      'NVIDIA H100': 'ADA_48',
    };

    return gpuMap[gpuType || 'NVIDIA RTX A4000'] || 'AMPERE_16';
  }

  /**
   * Map RunPod endpoint status to inference status
   */
  private mapEndpointStatus(endpointStatus?: string): InferenceStatus {
    if (!endpointStatus) {
      return 'deploying';
    }

    const statusMap: Record<string, InferenceStatus> = {
      'RUNNING': 'active',
      'ACTIVE': 'active',
      'INITIALIZING': 'deploying',
      'DEPLOYING': 'deploying',
      'SCALING': 'scaling',
      'STOPPED': 'stopped',
      'FAILED': 'failed',
      'ERROR': 'error',
    };

    return statusMap[endpointStatus.toUpperCase()] || 'deploying';
  }

  /**
   * Check if deployment is over budget
   */
  isOverBudget(currentSpend: number, budgetLimit: number): boolean {
    return currentSpend >= budgetLimit;
  }

  /**
   * Calculate budget utilization percentage
   */
  getBudgetUtilization(currentSpend: number, budgetLimit: number): number {
    if (budgetLimit === 0) return 0;
    return (currentSpend / budgetLimit) * 100;
  }

  /**
   * Get budget alert threshold status
   */
  getBudgetAlertStatus(currentSpend: number, budgetLimit: number): {
    threshold_50: boolean;
    threshold_80: boolean;
    budget_exceeded: boolean;
  } {
    const utilization = this.getBudgetUtilization(currentSpend, budgetLimit);

    return {
      threshold_50: utilization >= 50,
      threshold_80: utilization >= 80,
      budget_exceeded: utilization >= 100,
    };
  }
}

// Export singleton instance
export const runpodServerlessService = new RunPodServerlessService();
