import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Fireworks.ai Deployment API Service
 * Purpose: Interact with Fireworks.ai API for model deployment and management.
 */

// Placeholder for Fireworks-specific types. These will be fully defined in a later step.
export interface FireworksDeploymentRequest {
  deployment_name: string;
  model_path: string; // Path to the local model files
  hf_token?: string;
  model_id: string; // HuggingFace model ID for reference, e.g., "meta-llama/Llama-2-7b-chat-hf"
  base_model?: string; // The base model used for fine-tuning
  acceleratorType?: string;
  region?: string;
  precision?: string;
}

export interface FireworksDeploymentResponse {
  deployment_id: string;
  model_id: string;
  endpoint_url: string;
  status: string;
}

export interface FireworksDeploymentStatusResponse {
  id: string;
  state: 'PENDING' | 'DEPLOYING' | 'READY' | 'FAILED' | 'TERMINATED';
  status: {
    code: string;
    message: string;
  };
  model: string; // Full model ID, e.g., accounts/{account_id}/models/{model_id}
  endpoint: {
    url: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Service class for handling Fireworks.ai deployments.
 */
export class FireworksDeploymentService {

  private restApiBaseUrl = 'https://api.fireworks.ai/v1';
  // TODO: Determine how to get the actual ACCOUNT_ID. For now, hardcode or extract from context.
  // Assuming 'my-account' is a placeholder or can be derived from the API key's scope.
  private accountId: string = 'canfieldjuan24-wel7l';

  constructor() {}

  /**
   * Helper for making authenticated REST API requests to Fireworks.ai.
   */
  private async _fireworksRestRequest<T>(
    endpointOrUrl: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    apiKey?: string,
    body?: Record<string, unknown> | FormData | Buffer,
    contentType?: string
  ): Promise<T> {
    const url = endpointOrUrl.startsWith('http') ? endpointOrUrl : `${this.restApiBaseUrl}${endpointOrUrl}`;
    console.log(`[FireworksService] REST Request: ${method} ${url}`);

    const headers: HeadersInit = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (contentType) {
      headers['Content-Type'] = contentType;
    } else if (body && !(body instanceof FormData) && !(body instanceof Buffer)) {
      headers['Content-Type'] = 'application/json';
    }

    const options: RequestInit = {
      method,
      headers,
      body: (body instanceof FormData || body instanceof Buffer) ? (body as any) : JSON.stringify(body),
    };

    if (body instanceof Buffer) {
      options.headers = { ...headers, 'Content-Type': 'application/octet-stream' };
    }


    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fireworks.ai API error: ${response.status} - ${errorText}`);
    }
    
    if (response.status === 204) {
      return null as T;
    }

    const responseText = await response.text();
    return responseText ? JSON.parse(responseText) as T : null as T;
  }

  /**
   * Deploys a fine-tuned model to Fireworks.ai.
   * This method will orchestrate the multi-step process of uploading model files
   * and then creating a deployment from them.
   * @param request The deployment request details.  
   * @param apiKey The Fireworks.ai API key.
   * @returns A promise that resolves with the deployment information.
   */
  async deployModel(request: FireworksDeploymentRequest, apiKey: string): Promise<FireworksDeploymentResponse> {
    console.log('[FireworksService] Starting deployment for model:', request.deployment_name);
    
    try {
      // Step 1: Create a Model Object
      // This registers the model's metadata with Fireworks.ai.
      console.log(`[FireworksService] Step 1: Creating model object for ${request.model_id}...`);
      const createModelEndpoint = `/accounts/${this.accountId}/models`;
      const createModelPayload = {
        modelId: request.model_id.replace(/\//g, '--').replace(/\./g, '_'), // Sanitize model_id for Fireworks.ai
        model: {
          kind: "CUSTOM_MODEL",
          customModel: {
            modelType: "HF_TRANSFORMER", // Assuming Hugging Face Transformer format
            baseModel: request.base_model || request.model_id, // Use base_model if provided, otherwise model_id
            files: [] // This will be populated after files are uploaded
          }
        }
      };
      
      const createModelResponse = await this._fireworksRestRequest<{ model: { modelId: string } }>(
        createModelEndpoint,
        'POST',
        apiKey,
        createModelPayload
      );
      const fireworksModelId = createModelResponse.model.modelId;
      console.log(`[FireworksService] Model object created with ID: ${fireworksModelId}`);

      // 2. Get Signed Upload URLs
      console.log(`[FireworksService] Step 2: Getting signed upload URLs for model ${fireworksModelId}...`);
      const filesInModelPath = await fs.readdir(request.model_path);
      const fileNames = filesInModelPath.filter(name => !name.startsWith('.')); // Exclude hidden files
      
      const getUploadUrlsEndpoint = `/accounts/${this.accountId}/models/${fireworksModelId}/upload-urls`;
      const getUploadUrlsPayload = { fileNames };
      const signedUrlsResponse = await this._fireworksRestRequest<{ signedUrls: { [key: string]: string } }>(
        getUploadUrlsEndpoint,
        'POST',
        apiKey,
        getUploadUrlsPayload
      );
      const signedUrls = signedUrlsResponse.signedUrls;
      console.log(`[FireworksService] Received signed upload URLs for ${Object.keys(signedUrls).length} files.`);

      // 3. Upload Files
      console.log(`[FireworksService] Step 3: Uploading model files to signed URLs...`);
      for (const fileName of fileNames) {
        const signedUrl = signedUrls[fileName];
        if (!signedUrl) {
          console.warn(`[FireworksService] No signed URL found for file: ${fileName}. Skipping.`);
          continue;
        }

        const localFilePath = path.join(request.model_path, fileName);
        const fileContent = await fs.readFile(localFilePath);

        console.log(`[FireworksService] Uploading ${fileName} (${fileContent.length} bytes) to ${signedUrl}...`);
        await this._fireworksRestRequest(
          signedUrl,
          'PUT',
          undefined, // API key is not strictly needed for pre-signed PUT URLs
          fileContent,
          'application/octet-stream' // Set content type for binary data
        );
        console.log(`[FireworksService] Successfully uploaded ${fileName}.`);
      }
      console.log('[FireworksService] All model files uploaded successfully.');

      // 4. Validate the Upload
      console.log(`[FireworksService] Step 4: Validating model upload for ${fireworksModelId}...`);
      const validateEndpoint = `/accounts/${this.accountId}/models/${fireworksModelId}/validate`;
      await this._fireworksRestRequest(
        validateEndpoint,
        'POST',
        apiKey
      );
            console.log(`[FireworksService] Model ${fireworksModelId} upload validated successfully.`);
      
            // 5. Create Deployment
      console.log(`[FireworksService] Step 5: Creating deployment for model ${fireworksModelId}...`);
      const createDeploymentEndpoint = `/accounts/${this.accountId}/deployments`;
      const createDeploymentPayload = {
        baseModel: `accounts/${this.accountId}/models/${fireworksModelId}`, // Reference the uploaded model
        displayName: request.deployment_name,
        description: `Deployment for fine-tuned model: ${request.model_id}`,
        minReplicaCount: 0, 
        maxReplicaCount: 1, 
        acceleratorCount: 1,
        acceleratorType: request.acceleratorType || "NVIDIA_A100_80GB",
        precision: request.precision || "FP16",
        region: request.region || "US_IOWA_1",
        deploymentShape: "performance-optimized"
      };

      const deploymentCreationResponse = await this._fireworksRestRequest<{ id: string; model: string; status: string; endpoint: { url: string } }>(
        createDeploymentEndpoint,
        'POST',
        apiKey,
        createDeploymentPayload
      );
            const fireworksDeploymentId = deploymentCreationResponse.id;
            console.log(`[FireworksService] Deployment created with ID: ${fireworksDeploymentId}`);
      
            // Poll until deployment is ready
            const finalStatus = await this._pollUntilDeploymentReady(fireworksDeploymentId, apiKey);
      
            return {
              deployment_id: fireworksDeploymentId,
              model_id: deploymentCreationResponse.model,
              endpoint_url: deploymentCreationResponse.endpoint.url,
              status: finalStatus,
            };
      
          } catch (error) {
            console.error('[FireworksService] deployModel failed:', error);
            throw error;
          }
        }
      
        /**
         * Gets the status of a specific deployment.
         * @param deploymentId The ID of the deployment to check.
         * @param apiKey The Fireworks.ai API key.
         * @returns A promise that resolves with the status information.
         */
        async getDeploymentStatus(deploymentId: string, apiKey: string): Promise<FireworksDeploymentStatusResponse> {
          console.log('[FireworksService] Getting status for deployment:', deploymentId);
          const getStatusEndpoint = `/accounts/${this.accountId}/deployments/${deploymentId}`;
          const response = await this._fireworksRestRequest<FireworksDeploymentStatusResponse>(
            getStatusEndpoint,
            'GET',
            apiKey
          );
          return response;
        }
      
        /**
         * Polls a Fireworks.ai deployment until it becomes READY or FAILED.
         * @param deploymentId The ID of the deployment to poll.
         * @param apiKey The Fireworks.ai API key.
         * @returns The final status of the deployment ('active' or 'failed').
         */
        private async _pollUntilDeploymentReady(deploymentId: string, apiKey: string): Promise<string> {
          const startTime = Date.now();
          const pollInterval = 10000; // Poll every 10 seconds
          const maxWaitTime = 20 * 60 * 1000; // Max 20 minutes for deployment
      
          console.log(`[FireworksService] Polling for deployment ${deploymentId} to become ready...`);
      
          while (Date.now() - startTime < maxWaitTime) {
            try {
              const statusResponse = await this.getDeploymentStatus(deploymentId, apiKey);
              console.log(`[FireworksService] Deployment ${deploymentId} current state: ${statusResponse.state}`);
      
              if (statusResponse.state === 'READY') {
                console.log(`[FireworksService] Deployment ${deploymentId} is READY after ${Date.now() - startTime}ms.`);
                return 'active';
              } else if (statusResponse.state === 'FAILED') {
                console.error(`[FireworksService] Deployment ${deploymentId} FAILED after ${Date.now() - startTime}ms. Reason: ${statusResponse.status.message}`);
                return 'failed';
              }
            } catch (error) {
              console.error(`[FireworksService] Error polling deployment ${deploymentId}:`, error);
              // Continue polling even if an error occurs, assuming it's transient
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
      
          throw new Error(`Deployment ${deploymentId} did not become READY within ${maxWaitTime / 1000}s.`);
        }
      
        /**
         * Deletes a deployment from Fireworks.ai.
         * @param deploymentId The ID of the deployment to delete.
         * @param apiKey The Fireworks.ai API key.
         */
        async deleteDeployment(deploymentId: string, apiKey: string): Promise<void> {
          console.log('[FireworksService] Deleting deployment:', deploymentId);
          const deleteDeploymentEndpoint = `/accounts/${this.accountId}/deployments/${deploymentId}`;
          await this._fireworksRestRequest(
            deleteDeploymentEndpoint,
            'DELETE',
            apiKey
          );
          console.log(`[FireworksService] Deployment ${deploymentId} deleted successfully.`);
        }
      }
      
      export const fireworksDeploymentService = new FireworksDeploymentService();
