/**
 * Graphiti HTTP Client
 * Communicates with Graphiti REST API service
 */

// ============================================================================
// Types
// ============================================================================

export interface GraphitiConfig {
  baseUrl: string;
  timeout: number;
}

export interface GraphitiEpisode {
  name: string;
  episode_body: string;
  source_description: string;
  reference_time: string; // ISO 8601
  group_id: string;
}

export interface GraphitiEpisodeResponse {
  episode_id: string;
  entities_created: number;
  relations_created: number;
}

export interface GraphitiSearchParams {
  query: string;
  group_ids: string[];
  num_results?: number;
}

export interface GraphitiSearchResult {
  edges: Array<{
    uuid: string;
    name: string;
    fact: string;
    source_node?: { name: string; uuid: string };
    target_node?: { name: string; uuid: string };
    source_description?: string;
    score?: number;
    created_at: string;
    expired_at?: string;
  }>;
  nodes?: Array<{
    uuid: string;
    name: string;
    labels: string[];
    summary: string;
    created_at: string;
  }>;
}

export interface GraphitiHealthResponse {
  status: string;
  version?: string;
}

// ============================================================================
// Graphiti Client
// ============================================================================

export class GraphitiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config?: Partial<GraphitiConfig>) {
    this.baseUrl = config?.baseUrl || process.env.GRAPHITI_API_URL || 'http://localhost:8001';
    // Use 5 minutes for document processing (embedding + entity extraction can be slow)
    const defaultTimeout = parseInt(process.env.GRAPHITI_TIMEOUT || '300000', 10);
    this.timeout = config?.timeout || defaultTimeout;
  }

  /**
   * Make HTTP request to Graphiti API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Graphiti API error (${response.status}): ${errorText}`
        );
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Graphiti API timeout after ${this.timeout}ms`);
        }
        throw error;
      }
      throw new Error('Unknown error communicating with Graphiti API');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if Graphiti service is healthy
   */
  async health(): Promise<GraphitiHealthResponse> {
    return this.request<GraphitiHealthResponse>('/health');
  }

  /**
   * Add an episode (document) to the knowledge graph
   */
  async addEpisode(episode: GraphitiEpisode): Promise<GraphitiEpisodeResponse> {
    return this.request<GraphitiEpisodeResponse>('/episodes', {
      method: 'POST',
      body: JSON.stringify(episode),
    });
  }

  /**
   * Search the knowledge graph
   */
  async search(params: GraphitiSearchParams): Promise<GraphitiSearchResult> {
    const queryParams = new URLSearchParams({
      query: params.query,
      group_ids: params.group_ids.join(','),
      ...(params.num_results && { num_results: params.num_results.toString() }),
    });

    return this.request<GraphitiSearchResult>(`/search?${queryParams.toString()}`);
  }

  /**
   * Get entity relationships
   */
  async getEntityEdges(
    entityName: string,
    groupIds: string[]
  ): Promise<GraphitiSearchResult> {
    const queryParams = new URLSearchParams({
      group_ids: groupIds.join(','),
    });

    return this.request<GraphitiSearchResult>(
      `/entities/${encodeURIComponent(entityName)}/edges?${queryParams.toString()}`
    );
  }

  /**
   * Delete an episode
   */
  async deleteEpisode(episodeId: string): Promise<void> {
    await this.request<void>(`/episodes/${episodeId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Test connection to Graphiti service
   */
  async testConnection(): Promise<boolean> {
    try {
      const health = await this.health();
      return health.status === 'healthy' || health.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let graphitiClientInstance: GraphitiClient | null = null;

export function getGraphitiClient(): GraphitiClient {
  if (!graphitiClientInstance) {
    graphitiClientInstance = new GraphitiClient();
  }
  return graphitiClientInstance;
}

export function resetGraphitiClient(): void {
  graphitiClientInstance = null;
}
