// Secrets Manager Service
// CRUD operations for provider-level API keys with encryption
// Date: 2025-10-16

import { supabase as defaultSupabase } from '@/lib/supabaseClient';
import { encrypt, decrypt, createApiKeyPreview } from '@/lib/models/encryption';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ProviderSecret,
  ProviderSecretDisplay,
  CreateSecretDTO,
  UpdateSecretDTO,
} from './secrets.types';
import type { ModelProvider } from '@/lib/models/llm-model.types';

class SecretsManagerService {
  // ============================================================================
  // LIST SECRETS
  // ============================================================================

  async listSecrets(
    userId: string,
    supabaseClient?: SupabaseClient
  ): Promise<ProviderSecretDisplay[]> {
    try {
      console.log('[SecretsManager] Listing secrets for user:', userId);

      const client = supabaseClient || defaultSupabase;

      const { data, error } = await client
        .from('provider_secrets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SecretsManager] List error:', error);
        throw new Error(`Failed to list provider secrets: ${error.message}`);
      }

      const secrets: ProviderSecretDisplay[] = (data || []).map((secret: ProviderSecret) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { api_key_encrypted, user_id, ...rest } = secret;
        return {
          ...rest,
          api_key_preview: api_key_encrypted
            ? createApiKeyPreview(decrypt(api_key_encrypted))
            : '',
        };
      });

      console.log('[SecretsManager] Found', secrets.length, 'provider secrets');
      return secrets;
    } catch (error) {
      console.error('[SecretsManager] List failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // GET SECRET BY PROVIDER
  // ============================================================================

  async getSecret(
    userId: string,
    provider: ModelProvider,
    supabaseClient?: SupabaseClient
  ): Promise<ProviderSecret | null> {
    try {
      // Normalize provider name to lowercase for case-insensitive matching
      const normalizedProvider = provider.toLowerCase();
      console.log('[SecretsManager] Getting secret for provider:', normalizedProvider, 'user:', userId);

      const client = supabaseClient || defaultSupabase;
      console.log('[SecretsManager] Using client:', supabaseClient ? 'admin (bypasses RLS)' : 'default (respects RLS)');

      // DEBUG: List all secrets to verify what's in the database
      console.log('[SecretsManager] DEBUG: Listing all secrets for user to check what exists...');
      const { data: allSecrets, error: listError } = await client
        .from('provider_secrets')
        .select('id, provider, user_id')
        .eq('user_id', userId);

      if (listError) {
        console.error('[SecretsManager] DEBUG: Error listing secrets:', listError);
      } else {
        console.log('[SecretsManager] DEBUG: Found secrets:', allSecrets?.map(s => ({
          id: s.id,
          provider: s.provider,
          user_matches: s.user_id === userId
        })));
      }

      // Use ILIKE for case-insensitive matching to handle existing records with mixed case
      console.log('[SecretsManager] Querying with ILIKE for provider:', normalizedProvider);
      const { data, error } = await client
        .from('provider_secrets')
        .select('*')
        .eq('user_id', userId)
        .ilike('provider', normalizedProvider)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('[SecretsManager] No secret found for provider:', provider);
          console.log('[SecretsManager] Error details:', error);
          return null;
        }
        console.error('[SecretsManager] Get error:', error);
        throw new Error(`Failed to get provider secret: ${error.message}`);
      }

      console.log('[SecretsManager] ✓ Secret retrieved for provider:', provider, 'id:', data?.id);
      return data as ProviderSecret;
    } catch (error) {
      console.error('[SecretsManager] Get failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // CREATE SECRET
  // ============================================================================

  async createSecret(
    dto: CreateSecretDTO,
    userId: string,
    supabaseClient?: SupabaseClient
  ): Promise<ProviderSecret> {
    try {
      console.log('[SecretsManager] Creating secret for provider:', dto.provider);

      const client = supabaseClient || defaultSupabase;

      const encryptedKey = encrypt(dto.api_key);

      const secretData = {
        user_id: userId,
        provider: dto.provider,
        api_key_encrypted: encryptedKey,
        description: dto.description || null,
        metadata: dto.metadata || {},
      };

      const { data, error } = await client
        .from('provider_secrets')
        .insert(secretData)
        .select()
        .single();

      if (error) {
        console.error('[SecretsManager] Create error:', error);
        throw new Error(`Failed to create provider secret: ${error.message}`);
      }

      console.log('[SecretsManager] Secret created for provider:', dto.provider);
      return data as ProviderSecret;
    } catch (error) {
      console.error('[SecretsManager] Create failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // UPDATE SECRET
  // ============================================================================

  async updateSecret(
    userId: string,
    provider: ModelProvider,
    dto: UpdateSecretDTO,
    supabaseClient?: SupabaseClient
  ): Promise<ProviderSecret> {
    try {
      // Normalize provider name to lowercase for case-insensitive matching
      const normalizedProvider = provider.toLowerCase();
      console.log('[SecretsManager] Updating secret for provider:', normalizedProvider);

      const client = supabaseClient || defaultSupabase;

      const updates: Record<string, unknown> = {};

      if (dto.description !== undefined) {
        updates.description = dto.description;
      }

      if (dto.api_key !== undefined) {
        updates.api_key_encrypted = encrypt(dto.api_key);
      }

      if (dto.metadata !== undefined) {
        updates.metadata = dto.metadata;
      }

      // Also normalize the provider column to lowercase
      updates.provider = normalizedProvider;

      // Use ILIKE for case-insensitive matching to find existing records
      const { data, error } = await client
        .from('provider_secrets')
        .update(updates)
        .eq('user_id', userId)
        .ilike('provider', normalizedProvider)
        .select()
        .single();

      if (error) {
        console.error('[SecretsManager] Update error:', error);
        throw new Error(`Failed to update provider secret: ${error.message}`);
      }

      console.log('[SecretsManager] Secret updated for provider:', provider);
      return data as ProviderSecret;
    } catch (error) {
      console.error('[SecretsManager] Update failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // DELETE SECRET
  // ============================================================================

  async deleteSecret(
    userId: string,
    provider: ModelProvider,
    supabaseClient?: SupabaseClient
  ): Promise<void> {
    try {
      // Normalize provider name to lowercase for case-insensitive matching
      const normalizedProvider = provider.toLowerCase();
      console.log('[SecretsManager] Deleting secret for provider:', normalizedProvider);

      const client = supabaseClient || defaultSupabase;

      // Use ILIKE for case-insensitive matching
      const { error } = await client
        .from('provider_secrets')
        .delete()
        .eq('user_id', userId)
        .ilike('provider', normalizedProvider);

      if (error) {
        console.error('[SecretsManager] Delete error:', error);
        throw new Error(`Failed to delete provider secret: ${error.message}`);
      }

      console.log('[SecretsManager] Secret deleted for provider:', provider);
    } catch (error) {
      console.error('[SecretsManager] Delete failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // GET DECRYPTED API KEY (for runtime use)
  // ============================================================================

  async getDecryptedApiKey(
    userId: string,
    provider: ModelProvider,
    supabaseClient?: SupabaseClient
  ): Promise<string | null> {
    try {
      console.log('[SecretsManager] Getting decrypted key for provider:', provider);
      console.log('[SecretsManager] Client provided:', !!supabaseClient);

      const secret = await this.getSecret(userId, provider, supabaseClient);

      if (!secret || !secret.api_key_encrypted) {
        console.log('[SecretsManager] No API key found for provider:', provider);
        return null;
      }

      const decryptedKey = decrypt(secret.api_key_encrypted);
      console.log('[SecretsManager] ✓ API key decrypted for provider:', provider);

      return decryptedKey;
    } catch (error) {
      console.error('[SecretsManager] Get decrypted key failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // GET LAMBDA SSH KEY NAME (for Lambda deployments)
  // ============================================================================

  async getLambdaSshKeyName(
    userId: string,
    supabaseClient?: SupabaseClient
  ): Promise<string | null> {
    try {
      console.log('[SecretsManager] Getting Lambda SSH key name for user:', userId);

      const secret = await this.getSecret(userId, 'lambda', supabaseClient);

      if (!secret || !secret.metadata?.lambda?.ssh_key_name) {
        console.log('[SecretsManager] No Lambda SSH key name found');
        return null;
      }

      const sshKeyName = secret.metadata.lambda.ssh_key_name;
      console.log('[SecretsManager] ✓ Lambda SSH key name retrieved:', sshKeyName);

      return sshKeyName;
    } catch (error) {
      console.error('[SecretsManager] Get Lambda SSH key name failed:', error);
      throw error;
    }
  }
}

export const secretsManager = new SecretsManagerService();
