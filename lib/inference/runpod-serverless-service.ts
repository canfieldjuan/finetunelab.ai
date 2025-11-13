/**
 * RunPod Serverless API Service
 * Purpose: Interact with RunPod Serverless API for inference endpoint deployment
 * Date: 2025-11-12
 *
 * RunPod Serverless API Documentation: https://docs.runpod.io/serverless/endpoints/overview
 *
 * NOTE: This is different from /lib/training/runpod-service.ts
 * - Training uses GraphQL API for Pod deployment (always-on instances)
 * - This uses REST API for Serverless endpoints (pay-per-request, auto-scaling)
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
 * RunPod Serverless API response for endpoint creation
 */
interface RunPodEndpointCreateResponse {
  id: string;
  name: string;
  template_id?: string;
  network_volume_id?: string;
  locations?: string[];
  workers?: {
    min: number;
    max: number;
  };
  gpu_ids?: string[];
  idle_timeout?: number;
  endpoint_url?: string;
}

/**
 * RunPod Serverless API response for endpoint status
 */
interface RunPodEndpointStatusResponse {
  id: string;
  name: string;
  status?: string;
  endpoint_url?: string;
  workers?: {
    min: number;
    max: number;
    current: number;
  };
  statistics?: {
    total_requests?: number;
    successful_requests?: number;
    failed_requests?: number;
    avg_latency_ms?: number;
  };
  gpu_ids?: string[];
  idle_timeout?: number;
}

/**
 * RunPod Serverless API error response
 */
interface RunPodErrorResponse {
  error?: string;
  message?: string;
  details?: string;
}

// ============================================================================
// RUNPOD SERVERLESS API SERVICE
// ============================================================================

export class RunPodServerlessService {
  private restApiUrl = 'https://api.runpod.io/v2';

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
   * Execute REST API request
   */
  private async request<T>(
    method: string,
    endpoint: string,
    apiKey: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.restApiUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: this.getAuthHeaders(apiKey),
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    console.log(`[RunPodServerlessService] ${method} ${url}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `RunPod API error: ${response.status}`;

      try {
        const errorJson: RunPodErrorResponse = JSON.parse(errorText);
        errorMessage += ` - ${errorJson.error || errorJson.message || errorText}`;
      } catch {
        errorMessage += ` - ${errorText}`;
      }

      throw new Error(errorMessage);
    }

    return await response.json();
  }

  /**
   * Create a new serverless inference endpoint
   */
  async createEndpoint(
    request: RunPodServerlessDeploymentRequest,
    apiKey: string
  ): Promise<RunPodServerlessDeploymentResponse> {
    console.log('[RunPodServerlessService] Creating serverless endpoint...');

    try {
      // Map GPU type to RunPod GPU ID
      const gpuTypeId = this.mapGPUType(request.gpu_type);

      // Prepare endpoint configuration
      const createRequest = {
        name: request.deployment_name,
        gpu_ids: [gpuTypeId],
        workers: {
          min: request.min_workers ?? 0,  // Default: scale to zero
          max: request.max_workers ?? 3,   // Default: max 3 workers
        },
        idle_timeout: request.idle_timeout_seconds ?? 5,  // Default: 5 seconds
        template: {
          // Model configuration
          image_name: request.docker_image || 'runpod/pytorch:2.0.1-py3.10-cuda11.8.0-devel',
          env: {
            MODEL_URL: request.model_storage_url,
            BASE_MODEL: request.base_model,
            MODEL_TYPE: request.model_type,
            ...(request.environment_variables || {}),
          },
          // Auto-scaling configuration
          max_concurrency_per_worker: request.max_concurrency ?? 1,
        },
      };

      // Create endpoint via RunPod API
      const response = await this.request<RunPodEndpointCreateResponse>(
        'POST',
        '/endpoints',
        apiKey,
        createRequest
      );

      console.log('[RunPodServerlessService] Endpoint created:', response.id);

      // Calculate cost structure
      const costPerRequest = this.estimateCostPerRequest(request.gpu_type);

      const cost: InferenceCost = {
        cost_per_request: costPerRequest,
        budget_limit: request.budget_limit,
        current_spend: 0,
        request_count: 0,
        estimated_daily_cost: 0, // Will be calculated based on actual usage
      };

      const deploymentResponse: RunPodServerlessDeploymentResponse = {
        deployment_id: response.id,
        endpoint_id: response.id,
        endpoint_url: response.endpoint_url || `https://api.runpod.ai/v2/${response.id}/run`,
        status: 'deploying',
        gpu_type: request.gpu_type || 'NVIDIA RTX A4000',
        model_type: request.model_type,
        base_model: request.base_model,
        cost,
        created_at: new Date().toISOString(),
      };

      return deploymentResponse;
    } catch (error) {
      console.error('[RunPodServerlessService] Create endpoint failed:', error);
      throw error;
    }
  }

  /**
   * Get serverless endpoint status
   */
  async getEndpointStatus(
    endpointId: string,
    apiKey: string
  ): Promise<RunPodServerlessDeploymentStatus> {
    console.log('[RunPodServerlessService] Getting endpoint status:', endpointId);

    try {
      const response = await this.request<RunPodEndpointStatusResponse>(
        'GET',
        `/endpoints/${endpointId}`,
        apiKey
      );

      // Map RunPod status to our inference status
      const status: InferenceStatus = this.mapEndpointStatus(response.status);

      // Build metrics from statistics
      const metrics: InferenceMetrics | undefined = response.statistics ? {
        total_requests: response.statistics.total_requests,
        successful_requests: response.statistics.successful_requests,
        failed_requests: response.statistics.failed_requests,
        avg_latency_ms: response.statistics.avg_latency_ms,
      } : undefined;

      // Calculate cost based on request count
      const costPerRequest = 0.001; // Will be refined based on actual pricing
      const requestCount = response.statistics?.total_requests || 0;
      const currentSpend = requestCount * costPerRequest;

      const cost: InferenceCost = {
        cost_per_request: costPerRequest,
        budget_limit: 0, // Retrieved from database
        current_spend: currentSpend,
        request_count: requestCount,
      };

      const deploymentStatus: RunPodServerlessDeploymentStatus = {
        deployment_id: endpointId,
        endpoint_id: endpointId,
        endpoint_url: response.endpoint_url || `https://api.runpod.ai/v2/${endpointId}/run`,
        status,
        metrics,
        cost,
        last_checked_at: new Date().toISOString(),
      };

      console.log('[RunPodServerlessService] Status:', status);

      return deploymentStatus;
    } catch (error) {
      console.error('[RunPodServerlessService] Get status failed:', error);
      throw error;
    }
  }

  /**
   * Stop/terminate a serverless endpoint
   */
  async stopEndpoint(
    endpointId: string,
    apiKey: string
  ): Promise<void> {
    console.log('[RunPodServerlessService] Stopping endpoint:', endpointId);

    try {
      await this.request(
        'DELETE',
        `/endpoints/${endpointId}`,
        apiKey
      );

      console.log('[RunPodServerlessService] Endpoint stopped');
    } catch (error) {
      console.error('[RunPodServerlessService] Stop endpoint failed:', error);
      throw error;
    }
  }

  /**
   * Estimate cost per request based on GPU type
   *
   * NOTE: These are estimated costs. Actual costs should be retrieved from RunPod pricing API
   * or updated based on current RunPod pricing at https://www.runpod.io/serverless-gpu
   */
  estimateCostPerRequest(gpuType?: RunPodServerlessGPU): number {
    // Estimated costs per request (in USD)
    // Based on typical inference workloads (~1-2 seconds per request)
    const costMap: Record<RunPodServerlessGPU, number> = {
      'NVIDIA RTX A4000': 0.0004,   // ~$0.0004 per request
      'NVIDIA RTX A5000': 0.0006,   // ~$0.0006 per request
      'NVIDIA RTX A6000': 0.0009,   // ~$0.0009 per request
      'NVIDIA A40': 0.0010,         // ~$0.0010 per request
      'NVIDIA A100 40GB': 0.0015,   // ~$0.0015 per request
      'NVIDIA A100 80GB': 0.0020,   // ~$0.0020 per request
      'NVIDIA H100': 0.0035,        // ~$0.0035 per request
    };

    return costMap[gpuType || 'NVIDIA RTX A4000'] || 0.0004;
  }

  /**
   * Estimate total cost for a deployment
   */
  estimateTotalCost(
    expectedRequests: number,
    gpuType?: RunPodServerlessGPU
  ): {
    cost_per_request: number;
    total_requests: number;
    estimated_total_cost: number;
  } {
    const costPerRequest = this.estimateCostPerRequest(gpuType);
    const totalCost = expectedRequests * costPerRequest;

    console.log(
      `[RunPodServerlessService] Cost estimate: ${expectedRequests} requests × $${costPerRequest} = $${totalCost.toFixed(2)}`
    );

    return {
      cost_per_request: costPerRequest,
      total_requests: expectedRequests,
      estimated_total_cost: totalCost,
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
