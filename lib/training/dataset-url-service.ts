/**
 * Dataset URL Service
 * Purpose: Generate time-limited download URLs for training datasets
 * Date: 2025-11-24
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

export interface DatasetDownloadUrl {
  url: string;
  token: string;
  expires_at: string;
}

export class DatasetUrlService {
  /**
   * Generate temporary download URL for dataset
   * 
   * @param datasetPath - Local file path to dataset
   * @param userId - User ID for ownership validation
   * @param supabase - Supabase client instance
   * @param expiryHours - Token expiry in hours (default: 2)
   * @returns Download URL with token
   */
  async generateDownloadUrl(
    datasetPath: string,
    userId: string,
    supabase: SupabaseClient,
    expiryHours: number = 2
  ): Promise<DatasetDownloadUrl> {
    console.log('[DatasetUrlService] Generating Supabase signed URL for:', datasetPath);

    // Calculate expiry time in seconds (Supabase uses seconds, max 2 hours = 7200s)
    const expirySeconds = Math.min(expiryHours * 3600, 7200);
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    // Generate signed URL directly from Supabase Storage
    // This bypasses the need for local API and works from anywhere (including RunPod)
    const { data, error } = await supabase.storage
      .from('training-datasets') // Your bucket name
      .createSignedUrl(datasetPath, expirySeconds);

    if (error || !data) {
      console.error('[DatasetUrlService] Failed to create signed URL:', error);
      throw new Error(`Failed to create signed URL: ${error?.message || 'No data returned'}`);
    }

    console.log('[DatasetUrlService] ✓ Signed URL created from Supabase Storage');
    console.log('[DatasetUrlService] Expires:', expiresAt.toISOString());
    console.log('[DatasetUrlService] URL preview:', data.signedUrl.substring(0, 60) + '...');

    return {
      url: data.signedUrl,
      token: 'supabase-signed', // Not needed anymore but kept for compatibility
      expires_at: expiresAt.toISOString(),
    };
  }

  /**
   * Revoke download token (mark as used)
   */
  async revokeToken(
    token: string,
    supabase: SupabaseClient
  ): Promise<void> {
    console.log('[DatasetUrlService] Revoking token:', token.substring(0, 10));

    const { error } = await supabase
      .from('dataset_download_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    if (error) {
      console.error('[DatasetUrlService] Failed to revoke token:', error);
      throw new Error(`Failed to revoke token: ${error.message}`);
    }
  }

  /**
   * Clean up expired tokens for user
   */
  async cleanupExpiredTokens(
    userId: string,
    supabase: SupabaseClient
  ): Promise<number> {
    console.log('[DatasetUrlService] Cleaning up expired tokens for user:', userId);

    const { data, error } = await supabase
      .from('dataset_download_tokens')
      .delete()
      .eq('user_id', userId)
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) {
      console.error('[DatasetUrlService] Cleanup failed:', error);
      return 0;
    }

    const deletedCount = data?.length || 0;
    console.log('[DatasetUrlService] Cleaned up', deletedCount, 'expired tokens');
    
    return deletedCount;
  }
}

// Export singleton instance
export const datasetUrlService = new DatasetUrlService();
