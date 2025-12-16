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

export interface EmbedderConfig {
  provider: 'openai' | 'runpod';
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}

export interface GraphitiEpisode {
  name: string;
  episode_body: string;
  source_description: string;
  reference_time: string; // ISO 8601
  group_id: string;
}

export interface GraphitiEpisodeWithSchema extends GraphitiEpisode {
  use_schema?: boolean;
  schema_name?: 'ai_models';
}

export interface GraphitiEpisodeResponse {
  episode_id: string;
  entities_created: number;
  relations_created: number;
}

export interface GraphitiBulkEpisodeRequest {
  episodes: GraphitiEpisode[];
  group_id: string;
  is_historical?: boolean;
  data_source_type?: string;
}

export interface GraphitiBulkEpisodeResponse {
  total_episodes: number;
  processed_episodes: number;
  episode_ids: string[];
  total_entities: number;
  total_relations: number;
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
  private embedderConfig?: EmbedderConfig;

  constructor(config?: Partial<GraphitiConfig>) {
    // Client-side needs NEXT_PUBLIC_ prefix, server-side works without
    this.baseUrl = config?.baseUrl ||
                   process.env.NEXT_PUBLIC_GRAPHITI_API_URL ||
                   process.env.GRAPHITI_API_URL ||
                   'http://localhost:8001';
    // Use 5 minutes for document processing (embedding + entity extraction can be slow)
    // 60 minutes default for large document processing (1848 Q&As can take a while)
    const defaultTimeout = parseInt(process.env.GRAPHITI_TIMEOUT || '3600000', 10);
    this.timeout = config?.timeout || defaultTimeout;
  }

  /**
   * Set embedder configuration for subsequent requests
   */
  setEmbedderConfig(config: EmbedderConfig | undefined): void {
    this.embedderConfig = config;
    console.log('[GraphitiClient] Embedder config set:', config ? {
      provider: config.provider,
      baseUrl: config.baseUrl?.substring(0, 50),
      model: config.model,
    } : 'undefined');
  }

  /**
   * Get current embedder configuration
   */
  getEmbedderConfig(): EmbedderConfig | undefined {
    return this.embedderConfig;
  }

  /**
   * Build headers including embedder config if set
   */
  private buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };

    if (this.embedderConfig) {
      headers['X-Embedder-Provider'] = this.embedderConfig.provider;
      if (this.embedderConfig.baseUrl) {
        headers['X-Embedder-Base-Url'] = this.embedderConfig.baseUrl;
      }
      if (this.embedderConfig.model) {
        headers['X-Embedder-Model'] = this.embedderConfig.model;
      }
      if (this.embedderConfig.apiKey) {
        headers['X-Embedder-Api-Key'] = this.embedderConfig.apiKey;
      }
    }

    return headers;
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
        headers: this.buildHeaders(options.headers as Record<string, string>),
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
   * Add an episode with schema-enforced relationship extraction
   */
  async addEpisodeWithSchema(episode: GraphitiEpisodeWithSchema): Promise<{
    success: boolean;
    episode_uuid: string;
    new_nodes: number;
    new_edges: number;
    updated_nodes: number;
    schema_used: string | null;
  }> {
    return this.request('/episodes', {
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

    const url = `/search?${queryParams.toString()}`;
    console.log('[GraphitiClient] Search URL:', `${this.baseUrl}${url}`);

    const result = await this.request<GraphitiSearchResult>(url);

    console.log('[GraphitiClient] Raw response edges:', result.edges?.length || 0);

    return result;
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
   * Add multiple episodes in bulk (much faster than sequential)
   */
  async addEpisodesBulk(request: GraphitiBulkEpisodeRequest): Promise<GraphitiBulkEpisodeResponse> {
    return this.request<GraphitiBulkEpisodeResponse>('/episodes/bulk', {
      method: 'POST',
      body: JSON.stringify(request),
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
