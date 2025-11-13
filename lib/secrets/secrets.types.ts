// Provider Secrets Types
// Type definitions for centralized provider API key management
// Date: 2025-10-16

import type { ModelProvider } from '@/lib/models/llm-model.types';

// ============================================================================
// DATABASE RECORD (with encrypted API key)
// ============================================================================

export interface ProviderSecret {
  id: string;
  user_id: string;
  provider: ModelProvider;
  api_key_encrypted: string;
  description: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DISPLAY TYPE (for UI - no encrypted key, only preview)
// ============================================================================

export interface ProviderSecretDisplay {
  id: string;
  provider: ModelProvider;
  api_key_preview: string;  // Masked preview like "sk-proj...xyz"
  description: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CREATE DTO
// ============================================================================

export interface CreateSecretDTO {
  provider: ModelProvider;
  api_key: string;  // Plain text - will be encrypted before storage
  description?: string;
}

// ============================================================================
// UPDATE DTO
// ============================================================================

export interface UpdateSecretDTO {
  api_key?: string;  // Plain text - will be encrypted before storage
  description?: string;
}
