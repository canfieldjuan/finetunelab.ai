// Model Manager Service
// CRUD operations for LLM models with encryption
// Date: 2025-10-14

import { supabase as defaultSupabase, supabaseAdmin } from '@/lib/supabaseClient';
import { encrypt, decrypt, createApiKeyPreview } from './encryption';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LLMModel,
  LLMModelDisplay,
  CreateModelDTO,
  UpdateModelDTO,
  ModelConfig,
} from './llm-model.types';

class ModelManagerService {
  // ============================================================================
  // LIST MODELS
  // ============================================================================

  async listModels(userId?: string, supabaseClient?: SupabaseClient): Promise<LLMModelDisplay[]> {
    try {
      console.log('[ModelManager] Listing models for user:', userId || 'anonymous');

      // Use authenticated client if provided, otherwise default (for backwards compatibility)
      const client = supabaseClient || defaultSupabase;

      let query = client
        .from('llm_models')
        .select('*')
        .eq('enabled', true)
        .order('created_at', { ascending: false });

      if (userId) {
        // When using authenticated client, RLS will automatically filter by auth.uid()
        // We just need to include global models
        query = query.or(`is_global.eq.true,user_id.eq.${userId}`);
      } else {
        query = query.eq('is_global', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ModelManager] List error:', error);
        throw new Error(`Failed to list models: ${error.message}`);
      }

      const models: LLMModelDisplay[] = (data || []).map((model: LLMModel) => {
        const { api_key_encrypted, ...rest } = model;
        return {
          ...rest,
          has_api_key: !!api_key_encrypted,
          api_key_preview: api_key_encrypted
            ? createApiKeyPreview(decrypt(api_key_encrypted))
            : undefined,
        };
      });

      console.log('[ModelManager] Found', models.length, 'models');
      return models;
    } catch (error) {
      console.error('[ModelManager] List failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // GET MODEL BY ID
  // ============================================================================

  async getModel(modelId: string, supabaseClient?: SupabaseClient): Promise<LLMModelDisplay | null> {
    try {
      console.log('[ModelManager] Getting model:', modelId);

      // Use authenticated client if provided, otherwise default
      const client = supabaseClient || defaultSupabase;

      const { data, error } = await client
        .from('llm_models')
        .select('*')
        .eq('id', modelId)
        .single();

      // Handle "not found" case gracefully (PGRST116 = no rows returned)
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('[ModelManager] Model not found:', modelId);
          return null;
        }
        console.error('[ModelManager] Get error:', error);
        throw new Error(`Failed to get model: ${error.message}`);
      }

      if (!data) {
        console.log('[ModelManager] Model not found:', modelId);
        return null;
      }

      const { api_key_encrypted, ...rest } = data;

      const model: LLMModelDisplay = {
        ...rest,
        has_api_key: !!api_key_encrypted,
        api_key_preview: api_key_encrypted
          ? createApiKeyPreview(decrypt(api_key_encrypted))
          : undefined,
      };

      console.log('[ModelManager] Model retrieved:', model.name);
      return model;
    } catch (error) {
      console.error('[ModelManager] Get failed:', error);
      throw error;
    }
  }
  // ============================================================================
  // CREATE MODEL
  // ============================================================================

  async createModel(
    dto: CreateModelDTO,
    userId?: string,
    supabaseClient?: SupabaseClient
  ): Promise<LLMModel> {
    try {
      console.log('[ModelManager] Creating model:', dto.name);

      const client = supabaseClient || defaultSupabase;

      const encryptedKey = dto.api_key ? encrypt(dto.api_key) : null;

      const modelData = {
        user_id: userId || null,
        name: dto.name,
        description: dto.description || null,
        provider: dto.provider,
        base_url: dto.base_url,
        model_id: dto.model_id,
        auth_type: dto.auth_type,
        api_key_encrypted: encryptedKey,
        auth_headers: dto.auth_headers || {},
        supports_streaming: dto.supports_streaming ?? true,
        supports_functions: dto.supports_functions ?? true,
        supports_vision: dto.supports_vision ?? false,
        context_length: dto.context_length ?? 4096,
        max_output_tokens: dto.max_output_tokens ?? 2000,
        price_per_input_token: dto.price_per_input_token || null,
        price_per_output_token: dto.price_per_output_token || null,
        default_temperature: dto.default_temperature ?? 0.7,
        default_top_p: dto.default_top_p ?? 1.0,
        enabled: dto.enabled ?? true,
        is_global: userId ? false : true,
        is_default: dto.is_default ?? false,
      };

      const { data, error } = await client
        .from('llm_models')
        .insert(modelData)
        .select()
        .single();

      if (error) {
        console.error('[ModelManager] Create error:', error);
        // Map Supabase/Postgres duplicate key error to a friendlier message
        type PostgrestError = { code?: string; message?: string };
        const e = error as PostgrestError;
        if (e.code === '23505' && (e.message || '').includes('llm_models_user_id_name_key')) {
          throw new Error('DUPLICATE_MODEL_NAME');
        }
        throw new Error(`Failed to create model: ${error.message}`);
      }

      console.log('[ModelManager] Model created:', data.id);
      return data as LLMModel;
    } catch (error) {
      console.error('[ModelManager] Create failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // UPDATE MODEL
  // ============================================================================

  async updateModel(
    modelId: string,
    dto: UpdateModelDTO,
    supabaseClient?: SupabaseClient
  ): Promise<LLMModel> {
    try {
      console.log('[ModelManager] Updating model:', modelId);

      // Use authenticated client if provided, otherwise default
      const client = supabaseClient || defaultSupabase;

      const updates: Record<string, unknown> = {};

      if (dto.name !== undefined) updates.name = dto.name;
      if (dto.description !== undefined) updates.description = dto.description;
      if (dto.base_url !== undefined) updates.base_url = dto.base_url;
      if (dto.model_id !== undefined) updates.model_id = dto.model_id;
      if (dto.auth_type !== undefined) updates.auth_type = dto.auth_type;
      if (dto.auth_headers !== undefined) updates.auth_headers = dto.auth_headers;
      if (dto.supports_streaming !== undefined) {
        updates.supports_streaming = dto.supports_streaming;
      }
      if (dto.supports_functions !== undefined) {
        updates.supports_functions = dto.supports_functions;
      }
      if (dto.supports_vision !== undefined) {
        updates.supports_vision = dto.supports_vision;
      }
      if (dto.context_length !== undefined) {
        updates.context_length = dto.context_length;
      }
      if (dto.max_output_tokens !== undefined) {
        updates.max_output_tokens = dto.max_output_tokens;
      }
      if (dto.price_per_input_token !== undefined) {
        updates.price_per_input_token = dto.price_per_input_token;
      }
      if (dto.price_per_output_token !== undefined) {
        updates.price_per_output_token = dto.price_per_output_token;
      }
      if (dto.default_temperature !== undefined) {
        updates.default_temperature = dto.default_temperature;
      }
      if (dto.default_top_p !== undefined) {
        updates.default_top_p = dto.default_top_p;
      }
      if (dto.enabled !== undefined) updates.enabled = dto.enabled;
      if (dto.is_default !== undefined) updates.is_default = dto.is_default;

      if (dto.api_key !== undefined) {
        updates.api_key_encrypted = dto.api_key ? encrypt(dto.api_key) : null;
      }

      const { data, error } = await client
        .from('llm_models')
        .update(updates)
        .eq('id', modelId)
        .select()
        .single();

      if (error) {
        console.error('[ModelManager] Update error:', error);
        throw new Error(`Failed to update model: ${error.message}`);
      }

      console.log('[ModelManager] Model updated:', data.id);
      return data as LLMModel;
    } catch (error) {
      console.error('[ModelManager] Update failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // DELETE MODEL
  // ============================================================================

  async deleteModel(modelId: string, supabaseClient?: SupabaseClient): Promise<void> {
    try {
      console.log('[ModelManager] Deleting model:', modelId);

      // Use authenticated client if provided, otherwise default
      const client = supabaseClient || defaultSupabase;

      const { error } = await client
        .from('llm_models')
        .delete()
        .eq('id', modelId);

      if (error) {
        console.error('[ModelManager] Delete error:', error);
        throw new Error(`Failed to delete model: ${error.message}`);
      }

      console.log('[ModelManager] Model deleted:', modelId);
    } catch (error) {
      console.error('[ModelManager] Delete failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // GET MODEL CONFIG (with decrypted API key for runtime use)
  // Supports provider secret fallback: if model has no API key, looks up provider secret
  // ============================================================================

  async getModelConfig(modelId: string, userId?: string, client?: SupabaseClient): Promise<ModelConfig | null> {
    try {
      console.log('[ModelManager] Getting config for model:', modelId, 'userId:', userId || 'not provided');

      // Validate UUID format; if not a UUID, attempt alias resolution by name/model_id/served_model_name
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUUID = uuidRegex.test(modelId);

      // Use provided client (preferred), admin client, or default client as fallback
      // Passing a client from the caller ensures proper access to user-specific models
      const supabaseClient = client || supabaseAdmin || defaultSupabase;

      let data: any | null = null;
      let error: any | null = null;

      if (isUUID) {
        ({ data, error } = await supabaseClient
          .from('llm_models')
          .select('*')
          .eq('id', modelId)
          .single());
      } else {
        console.log('[ModelManager] Alias resolution for model:', modelId);
        // Try matching by name, model_id, or served_model_name on enabled/global models
        const { data: aliasList, error: aliasErr } = await supabaseClient
          .from('llm_models')
          .select('*')
          .eq('enabled', true)
          .or(`is_global.eq.true`) // prioritize global models for aliases
          .or(`name.eq.${modelId},model_id.eq.${modelId},served_model_name.eq.${modelId}`);

        if (aliasErr) {
          error = aliasErr;
        } else if (aliasList && aliasList.length > 0) {
          if (aliasList.length > 1) {
            console.warn('[ModelManager] ⚠️ Multiple models matched alias:', modelId);
            console.warn('[ModelManager] Using first match:', aliasList[0].name, '(ID:', aliasList[0].id, ')');
          }
          data = aliasList[0];
          console.log('[ModelManager] Alias matched model:', data.name, 'provider:', data.provider);
        } else {
          console.log('[ModelManager] No alias match found for:', modelId);
          return null;
        }
      }

      // Handle "not found" case gracefully (PGRST116 = no rows returned)
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('[ModelManager] Model not found:', modelId);
          return null;
        }
        // Handle UUID validation errors from PostgreSQL (22P02 = invalid_text_representation)
        if (error.code === '22P02') {
          console.log('[ModelManager] Invalid UUID format (PostgreSQL validation), returning null:', modelId);
          return null;
        }
        console.error('[ModelManager] Get config error:', error);
        throw new Error(`Failed to get model config: ${error.message}`);
      }

      if (!data) {
        console.log('[ModelManager] Model not found:', modelId);
        return null;
      }

      console.log('[ModelManager] Model loaded:', data.name, 'provider:', data.provider, 'has_api_key:', !!data.api_key_encrypted);

      // API key resolution with fallback logic
      let apiKey: string | undefined;

      // Local providers that don't require authentication
      // Note: RunPod vLLM pods (proxy.runpod.net) don't need auth, but RunPod Serverless (api.runpod.ai) does
      const localProviders = ['vllm', 'ollama', 'lmstudio', 'llamacpp'];
      const isRunPodVLLMPod = data.provider.toLowerCase() === 'runpod' && 
                              data.base_url.includes('proxy.runpod.net');
      const isLocalProvider = localProviders.includes(data.provider.toLowerCase()) || isRunPodVLLMPod;

      // Priority 1: Use model's own API key if present
      if (data.api_key_encrypted) {
        apiKey = decrypt(data.api_key_encrypted);
        console.log('[ModelManager] ✓ Using model-specific API key (stored in llm_models table)');
        console.log('[ModelManager] ✓ Model ID:', data.id, 'Model Name:', data.name);
        console.log('[ModelManager] ✓ API key preview:', apiKey.substring(0, 10) + '...');
      }
      // Priority 2: Look up provider secret if userId provided (skip for local providers)
      else if (userId && !isLocalProvider) {
        console.log('[ModelManager] No model-specific key, looking up provider secret for:', data.provider, 'userId:', userId);
        try {
          const { secretsManager } = await import('@/lib/secrets/secrets-manager.service');
          // Pass the admin client to bypass RLS for server-side secret lookup
          const providerKey = await secretsManager.getDecryptedApiKey(userId, data.provider, supabaseClient);
          if (providerKey) {
            apiKey = providerKey;
            console.log('[ModelManager] ✓ Using provider secret for:', data.provider, '(length:', providerKey.length, 'chars)');
          } else {
            console.warn('[ModelManager] ✗ No provider secret found for provider:', data.provider);
            console.warn('[ModelManager] ✗ This will cause a 401 authentication error!');
            console.warn('[ModelManager] ✗ Please add your', data.provider, 'API key in Settings > API Keys');
          }
        } catch (error) {
          console.error('[ModelManager] ✗ Failed to lookup provider secret for:', data.provider);
          console.error('[ModelManager] ✗ Error:', error);
          // Continue without API key - caller will handle the error
        }
      } else if (isLocalProvider) {
        console.log('[ModelManager] ✓ Local provider detected:', data.provider, '- no authentication required');
      } else {
        console.warn('[ModelManager] ✗ No userId provided (userId:', userId, ') and model has no API key');
        console.warn('[ModelManager] ✗ This will cause a 401 authentication error!');
      }

      const config: ModelConfig = {
        id: data.id,
        name: data.name,
        provider: data.provider,
        base_url: data.base_url,
        model_id: data.model_id,
        served_model_name: data.served_model_name || null, // vLLM/Ollama served name
        auth_type: data.auth_type,
        api_key: apiKey,
        auth_headers: data.auth_headers || {},
        supports_streaming: data.supports_streaming,
        supports_functions: data.supports_functions,
        supports_vision: data.supports_vision,
        context_length: data.context_length,
        max_output_tokens: data.max_output_tokens,
        default_temperature: data.default_temperature,
        default_top_p: data.default_top_p,
      };

      console.log('[ModelManager] Config retrieved for:', config.name);
      return config;
    } catch (error) {
      console.error('[ModelManager] Get config failed:', error);
      throw error;
    }
  }
}

export const modelManager = new ModelManagerService();
