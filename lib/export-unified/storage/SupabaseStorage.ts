/**
 * Supabase Storage Provider
 * Stores exports in Supabase Storage
 * Phase 1: Foundation
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { StorageProvider, ExportFormat, StorageType } from '../interfaces';
import { FILE_EXTENSIONS } from '../config';

export class SupabaseStorage implements StorageProvider {
  private supabase: SupabaseClient;
  private bucketName: string;

  constructor(supabase: SupabaseClient, bucketName: string = 'exports') {
    this.supabase = supabase;
    this.bucketName = bucketName;
    console.log(`[SupabaseStorage] Initialized with bucket: ${bucketName}`);
  }

  /**
   * Initialize storage (create bucket if needed)
   */
  async initialize(): Promise<void> {
    try {
      // Check if bucket exists
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();

      if (listError) {
        throw new Error(`Failed to list buckets: ${listError.message}`);
      }

      const bucketExists = buckets?.some(b => b.name === this.bucketName);

      if (!bucketExists) {
        // Create bucket
        const { error: createError } = await this.supabase.storage.createBucket(this.bucketName, {
          public: false, // Private bucket - requires authentication
          fileSizeLimit: 100 * 1024 * 1024, // 100MB max file size
        });

        if (createError) {
          throw new Error(`Failed to create bucket: ${createError.message}`);
        }

        console.log(`[SupabaseStorage] Created bucket: ${this.bucketName}`);
      } else {
        console.log(`[SupabaseStorage] Bucket already exists: ${this.bucketName}`);
      }
    } catch (error) {
      console.error(`[SupabaseStorage] Failed to initialize storage:`, error);
      throw new Error(`Failed to initialize Supabase storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save export file
   */
  async saveExport(
    userId: string,
    exportId: string,
    content: string | Buffer,
    format: ExportFormat
  ): Promise<{ filePath: string; fileSize: number }> {
    console.log(`[SupabaseStorage] Saving export: ${exportId}`);

    try {
      // Generate file path
      const extension = FILE_EXTENSIONS[format] || format;
      const fileName = `${exportId}.${extension}`;
      const filePath = `${userId}/${fileName}`;

      // Convert content to Buffer if it's a string
      const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
      const fileSize = buffer.length;

      // Upload to Supabase Storage
      const { error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, buffer, {
          contentType: this.getMimeType(format),
          upsert: false, // Don't overwrite existing files
        });

      if (uploadError) {
        throw new Error(`Failed to upload: ${uploadError.message}`);
      }

      console.log(`[SupabaseStorage] Export saved: ${filePath} (${fileSize} bytes)`);

      return {
        filePath,
        fileSize,
      };
    } catch (error) {
      console.error(`[SupabaseStorage] Failed to save export:`, error);
      throw new Error(`Failed to save export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get export file
   */
  async getExport(filePath: string): Promise<Buffer> {
    console.log(`[SupabaseStorage] Retrieving export: ${filePath}`);

    try {
      // Download from Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(filePath);

      if (error) {
        throw new Error(`Failed to download: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from storage');
      }

      // Convert Blob to Buffer
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`[SupabaseStorage] Export retrieved: ${filePath} (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      console.error(`[SupabaseStorage] Failed to get export:`, error);
      throw new Error(`Failed to get export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete export file
   */
  async deleteExport(filePath: string): Promise<void> {
    console.log(`[SupabaseStorage] Deleting export: ${filePath}`);

    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        throw new Error(`Failed to delete: ${error.message}`);
      }

      console.log(`[SupabaseStorage] Export deleted: ${filePath}`);
    } catch (error) {
      console.error(`[SupabaseStorage] Failed to delete export:`, error);
      throw new Error(`Failed to delete export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if export exists
   */
  async exportExists(filePath: string): Promise<boolean> {
    try {
      // List files to check existence
      const pathParts = filePath.split('/');
      const folder = pathParts.slice(0, -1).join('/');
      const fileName = pathParts[pathParts.length - 1];

      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(folder);

      if (error) {
        return false;
      }

      return data?.some(file => file.name === fileName) ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Get storage type identifier
   */
  getStorageType(): StorageType {
    return 'supabase_storage';
  }

  /**
   * Get download URL (signed URL for private bucket)
   */
  async getDownloadUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    console.log(`[SupabaseStorage] Generating signed URL for: ${filePath}`);

    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        throw new Error(`Failed to create signed URL: ${error.message}`);
      }

      if (!data?.signedUrl) {
        throw new Error('No signed URL returned');
      }

      console.log(`[SupabaseStorage] Signed URL created (expires in ${expiresIn}s)`);
      return data.signedUrl;
    } catch (error) {
      console.error(`[SupabaseStorage] Failed to create signed URL:`, error);
      throw new Error(`Failed to create signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up expired exports
   */
  async cleanupExpired(filePaths: string[]): Promise<number> {
    console.log(`[SupabaseStorage] Cleaning up ${filePaths.length} expired exports`);

    if (filePaths.length === 0) {
      return 0;
    }

    try {
      // Batch delete (Supabase Storage supports batch operations)
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .remove(filePaths);

      if (error) {
        throw new Error(`Failed to delete files: ${error.message}`);
      }

      const deletedCount = data?.length ?? 0;
      console.log(`[SupabaseStorage] Cleanup complete: ${deletedCount} files deleted`);
      return deletedCount;
    } catch (error) {
      console.error(`[SupabaseStorage] Cleanup failed:`, error);
      throw new Error(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get total storage size for a user
   */
  async getUserStorageSize(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(userId);

      if (error) {
        console.error(`[SupabaseStorage] Failed to list user files:`, error);
        return 0;
      }

      if (!data) {
        return 0;
      }

      // Sum up file sizes
      const totalSize = data.reduce((sum, file) => sum + (file.metadata?.size ?? 0), 0);
      return totalSize;
    } catch (error) {
      console.error(`[SupabaseStorage] Failed to get user storage size:`, error);
      return 0;
    }
  }

  /**
   * Get MIME type for export format
   */
  private getMimeType(format: ExportFormat): string {
    const mimeTypes: Record<ExportFormat, string> = {
      csv: 'text/csv',
      json: 'application/json',
      jsonl: 'application/x-ndjson',
      markdown: 'text/markdown',
      txt: 'text/plain',
      html: 'text/html',
      pdf: 'application/pdf',
    };

    return mimeTypes[format] || 'application/octet-stream';
  }
}
