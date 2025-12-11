/**
 * Lambda Labs API Service
 * Purpose: Interact with Lambda Labs Cloud API for GPU instance deployment
 * Date: 2025-11-25
 * Updated: 2025-11-26 - Replaced SSH with cloud-init for startup scripts
 *
 * Lambda Labs API Documentation: https://docs.lambda.ai/api/cloud
 */

import type {
  LambdaDeploymentRequest,
  LambdaDeploymentResponse,
  LambdaDeploymentStatus,
  LambdaGPUType,
  DeploymentStatus,
} from './deployment.types';

// ============================================================================
// TYPES
// ============================================================================

interface LambdaInstanceResponse {
  data: {
    instance_ids: string[];
  };
}

interface LambdaInstance {
  id: string;
  name: string;
  ip: string;
  status: string; // 'booting', 'active', 'unhealthy', 'terminated'
  ssh_key_names: string[];
  region: {
    name: string;
  };
  instance_type: {
    name: string;
    price_cents_per_hour: number;
  };
}

interface LambdaInstancesResponse {
  data: LambdaInstance[];
}

interface LambdaAPIError {
  error: {
    code: string;
    message: string;
  };
}

// ============================================================================
// LAMBDA LABS API SERVICE
// ============================================================================

export class LambdaLabsService {
  private baseUrl = 'https://cloud.lambdalabs.com/api/v1';

  /**
   * Create authentication headers for Lambda Labs API
   * Lambda uses HTTP Basic Auth with API key as username
   */
  private getAuthHeaders(apiKey: string): HeadersInit {
    const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${basicAuth}`,
    };
  }

  /**
   * Execute REST API request
   */
  private async request<T>(
    endpoint: string,
    apiKey: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(apiKey),
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as LambdaAPIError;
      throw new Error(
        `Lambda Labs API error: ${response.status} - ${error.error?.message || JSON.stringify(data)}`
      );
    }

    return data as T;
  }

  /**
   * Launch a new GPU instance with cloud-init startup script
   * No SSH required - script runs automatically on boot
   */
  async createInstance(
    request: LambdaDeploymentRequest,
    apiKey: string,
    userDataScript?: string
  ): Promise<LambdaDeploymentResponse> {
    console.log('[LambdaLabsService] Launching instance...');
    console.log('[LambdaLabsService] Request:', {
      instance_type: request.instance_type,
      region: request.region,
      ssh_key_name: request.ssh_key_name,
      has_user_data: !!userDataScript
    });

    try {
      // Build launch request body
      const launchBody: Record<string, unknown> = {
        region_name: request.region,
        instance_type_name: request.instance_type,
        ssh_key_names: request.ssh_key_name ? [request.ssh_key_name] : [], // Use SSH key from request
        quantity: 1,
      };

      // Add cloud-init user_data if provided
      if (userDataScript) {
        // Lambda Labs API requires user_data to be base64 encoded
        launchBody.user_data = Buffer.from(userDataScript).toString('base64');
        console.log('[LambdaLabsService] Cloud-init script length:', userDataScript.length);
        console.log('[LambdaLabsService] Cloud-init script encoded length:', (launchBody.user_data as string).length);
      }

      // Launch instance
      const launchData = await this.request<LambdaInstanceResponse>(
        '/instance-operations/launch',
        apiKey,
        {
          method: 'POST',
          body: JSON.stringify(launchBody),
        }
      );

      const instanceId = launchData.data.instance_ids[0];
      console.log('[LambdaLabsService] Instance launched:', instanceId);

      // Get initial instance info (don't wait for active - return immediately)
      const instance = await this.getInstance(instanceId, apiKey);

      if (!instance) {
        throw new Error(`Instance ${instanceId} not found after launch`);
      }

      console.log('[LambdaLabsService] Instance initial status:', instance.status);

      // Calculate cost estimate
      const costPerHour = instance.instance_type.price_cents_per_hour / 100;
      const estimatedHours = 2; // Default estimate

      // Map Lambda instance status to deployment status
      let deploymentStatus: 'starting' | 'running' | 'failed' | 'stopped';
      switch (instance.status) {
        case 'booting':
          deploymentStatus = 'starting';
          break;
        case 'active':
          deploymentStatus = 'running';
          break;
        case 'unhealthy':
          deploymentStatus = 'failed';
          break;
        case 'terminated':
          deploymentStatus = 'stopped';
          break;
        default:
          deploymentStatus = 'starting';
      }

      const response: LambdaDeploymentResponse = {
        deployment_id: instanceId,
        instance_id: instanceId,
        instance_ip: instance.ip,
        status: deploymentStatus, // Reflects actual instance status
        instance_type: request.instance_type,
        region: request.region,
        cost: {
          estimated_cost: costPerHour * estimatedHours,
          cost_per_hour: costPerHour,
          estimated_hours: estimatedHours,
          currency: 'USD',
        },
        created_at: new Date().toISOString(),
      };

      console.log('[LambdaLabsService] Deployment initiated:', {
        id: instanceId,
        ip: instance.ip,
        status: deploymentStatus,
        cost_per_hour: costPerHour
      });

      return response;
    } catch (error) {
      console.error('[LambdaLabsService] Instance launch failed:', error);
      throw error;
    }
  }

  /**
   * Get instance details
   */
  async getInstance(
    instanceId: string,
    apiKey: string
  ): Promise<LambdaInstance | null> {
    try {
      const response = await this.request<LambdaInstancesResponse>(
        '/instances',
        apiKey
      );

      return response.data.find(instance => instance.id === instanceId) || null;
    } catch (error) {
      console.error('[LambdaLabsService] Failed to get instance:', error);
      return null;
    }
  }

  /**
   * List all instances for the user
   */
  async listInstances(apiKey: string): Promise<LambdaInstance[]> {
    try {
      const response = await this.request<LambdaInstancesResponse>(
        '/instances',
        apiKey
      );
      return response.data;
    } catch (error) {
      console.error('[LambdaLabsService] Failed to list instances:', error);
      return [];
    }
  }

  /**
   * Wait for instance to become active
   */
  private async waitForInstanceActive(
    instanceId: string,
    apiKey: string,
    maxWaitSeconds: number = 300
  ): Promise<LambdaInstance> {
    console.log('[LambdaLabsService] Waiting for instance to become active...');
    const startTime = Date.now();

    while ((Date.now() - startTime) / 1000 < maxWaitSeconds) {
      const instance = await this.getInstance(instanceId, apiKey);

      if (!instance) {
        throw new Error(`Instance ${instanceId} not found`);
      }

      console.log('[LambdaLabsService] Instance status:', instance.status);

      if (instance.status === 'active') {
        console.log('[LambdaLabsService] Instance is active!');
        return instance;
      }

      if (instance.status === 'unhealthy' || instance.status === 'terminated') {
        throw new Error(`Instance failed with status: ${instance.status}`);
      }

      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error(`Instance did not become active within ${maxWaitSeconds} seconds`);
  }

  /**
   * Terminate instance
   */
  async terminateInstance(
    instanceId: string,
    apiKey: string
  ): Promise<void> {
    console.log('[LambdaLabsService] Terminating instance:', instanceId);

    try {
      await this.request(
        '/instance-operations/terminate',
        apiKey,
        {
          method: 'POST',
          body: JSON.stringify({
            instance_ids: [instanceId],
          }),
        }
      );

      console.log('[LambdaLabsService] Instance terminated successfully');
    } catch (error) {
      console.error('[LambdaLabsService] Failed to terminate instance:', error);
      throw error;
    }
  }

  /**
   * Get instance status for monitoring
   */
  async getInstanceStatus(
    instanceId: string,
    apiKey: string
  ): Promise<LambdaDeploymentStatus | null> {
    try {
      const instance = await this.getInstance(instanceId, apiKey);

      if (!instance) {
        return null;
      }

      // Map Lambda status to our DeploymentStatus
      let status: DeploymentStatus;
      switch (instance.status) {
        case 'booting':
          status = 'starting';
          break;
        case 'active':
          status = 'running';
          break;
        case 'unhealthy':
          status = 'failed';
          break;
        case 'terminated':
          status = 'stopped';
          break;
        default:
          status = 'running';
      }

      const costPerHour = instance.instance_type.price_cents_per_hour / 100;

      return {
        deployment_id: instanceId,
        instance_id: instanceId,
        status,
        instance_ip: instance.ip,
        cost: {
          estimated_cost: 0,
          cost_per_hour: costPerHour,
          currency: 'USD',
        },
      };
    } catch (error) {
      console.error('[LambdaLabsService] Failed to get instance status:', error);
      return null;
    }
  }

  /**
   * Get available instance types with capacity information
   */
  async getInstanceTypes(apiKey: string): Promise<Array<{ name: string; description: string; price_cents_per_hour: number; regions_with_capacity: string[] }>> {
    try {
      const response = await this.request<{ data: Record<string, { instance_type: { name: string; description: string; price_cents_per_hour: number }; regions_with_capacity_available: Array<{ name: string }> }> }>(
        '/instance-types',
        apiKey
      );

      return Object.values(response.data).map(item => ({
        name: item.instance_type.name,
        description: item.instance_type.description,
        price_cents_per_hour: item.instance_type.price_cents_per_hour,
        regions_with_capacity: item.regions_with_capacity_available.map(r => r.name),
      }));
    } catch (error) {
      console.error('[LambdaLabsService] Failed to get instance types:', error);
      return [];
    }
  }

  /**
   * Check if GPU instance type is available in specified region
   * Returns availability status and alternatives if unavailable
   */
  async checkCapacity(
    instanceType: string,
    region: string,
    apiKey: string
  ): Promise<{ available: boolean; alternatives: { gpus: string[]; regions: string[] } }> {
    try {
      console.log('[LambdaLabsService] Checking capacity:', { instanceType, region });

      const types = await this.getInstanceTypes(apiKey);
      const requested = types.find(t => t.name === instanceType);

      if (!requested) {
        console.log('[LambdaLabsService] Instance type not found:', instanceType);
        return {
          available: false,
          alternatives: { gpus: [], regions: [] }
        };
      }

      const available = requested.regions_with_capacity.includes(region);
      console.log('[LambdaLabsService] Capacity check:', {
        available,
        availableRegions: requested.regions_with_capacity
      });

      // Find alternative GPUs available in the requested region
      const alternativeGpus = types
        .filter(t => t.regions_with_capacity.includes(region) && t.name !== instanceType)
        .map(t => t.name)
        .slice(0, 5); // Limit to top 5 alternatives

      // Get regions where the requested GPU is available
      const alternativeRegions = requested.regions_with_capacity;

      return {
        available,
        alternatives: {
          gpus: alternativeGpus,
          regions: alternativeRegions
        }
      };
    } catch (error) {
      console.error('[LambdaLabsService] Failed to check capacity:', error);
      // On error, assume available to allow deployment attempt
      return {
        available: true,
        alternatives: { gpus: [], regions: [] }
      };
    }
  }

  /**
   * Map GPU type to pricing (for UI display)
   */
  static getGPUPricing(gpuType: LambdaGPUType): number {
    const pricing: Record<LambdaGPUType, number> = {
      'gpu_1x_a10': 0.60,
      'gpu_1x_rtx6000': 0.50,
      'gpu_1x_a100': 1.29,
      'gpu_1x_a100_sxm4': 1.79,
      'gpu_8x_a100': 14.32,
      'gpu_1x_h100_pcie': 1.85,
      'gpu_8x_h100_sxm5': 23.92,
    };
    return pricing[gpuType] || 1.0;
  }

  /**
   * Get available regions
   */
  static getAvailableRegions(): string[] {
    return [
      'us-west-1',
      'us-west-2',
      'us-east-1',
      'us-south-1',
      'us-midwest-1',
      'europe-central-1',
      'asia-south-1',
      'me-west-1',
      'asia-northeast-1',
      'asia-northeast-2',
    ];
  }
}
