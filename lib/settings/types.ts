/**
 * User Settings Types
 * Date: 2025-10-24
 */

export interface UserSettings {
  id: string;
  userId: string;

  // Voice & Audio Settings
  ttsEnabled: boolean;
  ttsVoiceUri: string | null;
  ttsAutoPlay: boolean;
  ttsRate: number;
  sttEnabled: boolean;

  // Model Settings
  defaultModelId: string | null;  // Provider model ID (e.g., "claude-sonnet-4-5-20250514")
  defaultModelProvider: string | null;  // Provider name (e.g., "anthropic", "openai")

  // Embedding Settings (for GraphRAG)
  embeddingProvider: 'openai' | 'runpod' | null;  // null = use default (openai)
  embeddingBaseUrl: string | null;  // RunPod serverless endpoint URL
  embeddingModel: string | null;  // e.g., "text-embedding-3-small" or "BAAI/bge-large-en-v1.5"
  embeddingApiKey: string | null;  // Optional API key for the endpoint

  // Future settings
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface UserSettingsUpdate {
  // Voice & Audio Settings
  ttsEnabled?: boolean;
  ttsVoiceUri?: string | null;
  ttsAutoPlay?: boolean;
  ttsRate?: number;
  sttEnabled?: boolean;

  // Model Settings
  defaultModelId?: string | null;
  defaultModelProvider?: string | null;

  // Embedding Settings (for GraphRAG)
  embeddingProvider?: 'openai' | 'runpod' | null;
  embeddingBaseUrl?: string | null;
  embeddingModel?: string | null;
  embeddingApiKey?: string | null;

  // Future settings
  theme?: 'light' | 'dark' | 'system';
  fontSize?: 'small' | 'medium' | 'large';
}

export interface UserSettingsResponse {
  settings: UserSettings | null;
  error?: string;
}
