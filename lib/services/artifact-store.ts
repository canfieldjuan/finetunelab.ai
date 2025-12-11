/**
 * Artifact Storage Service
 *
 * Manages storage and retrieval of DAG job artifacts (models, datasets, etc.)
 * Supports local file system with future S3/cloud storage support
 *
 * Phase: Phase 1 - Artifact Management
 * Date: 2025-10-28
 */

import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type ArtifactType =
  | 'model'
  | 'dataset'
  | 'metrics'
  | 'config'
  | 'logs'
  | 'checkpoint';

export type StorageBackend = 'local' | 's3' | 'supabase_storage';

export interface Artifact {
  id: string;
  executionId: string;
  jobId: string;
  artifactType: ArtifactType;
  storagePath: string;
  storageBackend: StorageBackend;
  sizeBytes?: number;
  checksum?: string;
  metadata?: Record<string, unknown>;
  pinned?: boolean;
  expiresAt?: Date;
  createdAt: Date;
}

export interface RegisterArtifactRequest {
  executionId: string;
  jobId: string;
  artifactType: ArtifactType;
  filePath: string;
  storageBackend?: StorageBackend;
  metadata?: Record<string, unknown>;
  pinned?: boolean;
  retentionDays?: number;
}

// ============================================================================
// Artifact Store Service
// ============================================================================

export class ArtifactStore {
  private supabase: SupabaseClient;
  private baseStoragePath: string;
  private storageBucket: string = 'dag-artifacts';

  constructor(supabaseUrl?: string, supabaseKey?: string, baseStoragePath?: string) {
    this.supabase = createClient();
    this.baseStoragePath = baseStoragePath || path.join(process.cwd(), 'lib', 'training', 'artifacts');

    console.log('[ArtifactStore] Initialized with base path:', this.baseStoragePath);
    console.log('[ArtifactStore] Using Supabase Storage bucket:', this.storageBucket);
  }

  /**
   * Compute SHA-256 checksum of a file
   */
  private async computeChecksum(filePath: string): Promise<string> {
    console.log('[ArtifactStore] Computing checksum for:', filePath);

    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);

    const checksum = hashSum.digest('hex');
    console.log('[ArtifactStore] Checksum computed:', checksum.substring(0, 16) + '...');

    return checksum;
  }

  /**
   * Get file size in bytes
   */
  private async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  /**
   * Upload file to Supabase Storage
   * Returns the storage path in the bucket
   */
  private async uploadToSupabaseStorage(
    localFilePath: string,
    executionId: string,
    jobId: string,
    artifactType: ArtifactType
  ): Promise<string> {
    console.log('[ArtifactStore] Uploading to Supabase Storage:', localFilePath);

    // Generate unique storage path
    const timestamp = Date.now();
    const filename = path.basename(localFilePath);
    const storagePath = `${executionId}/${jobId}/${artifactType}/${timestamp}-${filename}`;

    // Read file buffer
    const fileBuffer = await fs.readFile(localFilePath);

    // Upload to Supabase Storage
    const { data, error } = await this.supabase.storage
      .from(this.storageBucket)
      .upload(storagePath, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      console.error('[ArtifactStore] Upload error:', error);
      throw new Error(`Failed to upload artifact: ${error.message}`);
    }

    console.log('[ArtifactStore] Upload successful:', data.path);
    return data.path;
  }

  /**
   * Download file from Supabase Storage
   * Returns file buffer
   */
  private async downloadFromSupabaseStorage(storagePath: string): Promise<Buffer> {
    console.log('[ArtifactStore] Downloading from Supabase Storage:', storagePath);

    const { data, error } = await this.supabase.storage
      .from(this.storageBucket)
      .download(storagePath);

    if (error) {
      console.error('[ArtifactStore] Download error:', error);
      throw new Error(`Failed to download artifact: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from Supabase Storage');
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('[ArtifactStore] Download successful. Size:', buffer.length, 'bytes');
    return buffer;
  }

  /**
   * Register an artifact in the database
   */
  async registerArtifact(request: RegisterArtifactRequest): Promise<Artifact> {
    console.log('[ArtifactStore] Registering artifact:', {
      executionId: request.executionId,
      jobId: request.jobId,
      type: request.artifactType,
      file: request.filePath,
    });

    try {
      // Verify file exists
      await fs.access(request.filePath);
    } catch {
      const msg = `File not found: ${request.filePath}`;
      console.error('[ArtifactStore] Error:', msg);
      throw new Error(msg);
    }

    // Compute metadata before upload
    const [checksum, sizeBytes] = await Promise.all([
      this.computeChecksum(request.filePath),
      this.getFileSize(request.filePath),
    ]);

    console.log('[ArtifactStore] File metadata:', { sizeBytes, checksumPrefix: checksum.substring(0, 16) });

    // Upload to Supabase Storage (always for new artifacts)
    const storagePath = await this.uploadToSupabaseStorage(
      request.filePath,
      request.executionId,
      request.jobId,
      request.artifactType
    );

    // Calculate expiration date (default 30 days)
    const retentionDays = request.retentionDays || 30;
    const expiresAt = request.pinned ? null : new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    console.log('[ArtifactStore] Storage path:', storagePath, 'Expires:', expiresAt);

    // Insert into database
    const { data, error } = await this.supabase
      .from('dag_artifacts')
      .insert({
        execution_id: request.executionId,
        job_id: request.jobId,
        artifact_type: request.artifactType,
        storage_path: storagePath,
        storage_backend: 'supabase_storage',
        size_bytes: sizeBytes,
        checksum,
        metadata: request.metadata || {},
        pinned: request.pinned || false,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      console.error('[ArtifactStore] Database insert error:', error);
      throw new Error(`Failed to register artifact: ${error.message}`);
    }

    console.log('[ArtifactStore] Artifact registered successfully. ID:', data.id);

    return {
      id: data.id,
      executionId: data.execution_id,
      jobId: data.job_id,
      artifactType: data.artifact_type as ArtifactType,
      storagePath: data.storage_path,
      storageBackend: data.storage_backend as StorageBackend,
      sizeBytes: data.size_bytes,
      checksum: data.checksum,
      metadata: data.metadata,
      pinned: data.pinned,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Get all artifacts for a DAG execution
   */
  async getArtifacts(executionId: string): Promise<Artifact[]> {
    console.log('[ArtifactStore] Fetching artifacts for execution:', executionId);

    const { data, error } = await this.supabase
      .from('dag_artifacts')
      .select('*')
      .eq('execution_id', executionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[ArtifactStore] Query error:', error);
      throw new Error(`Failed to fetch artifacts: ${error.message}`);
    }

    console.log('[ArtifactStore] Found', data?.length || 0, 'artifacts');

    return (data || []).map(item => ({
      id: item.id,
      executionId: item.execution_id,
      jobId: item.job_id,
      artifactType: item.artifact_type as ArtifactType,
      storagePath: item.storage_path,
      storageBackend: item.storage_backend as StorageBackend,
      sizeBytes: item.size_bytes,
      checksum: item.checksum,
      metadata: item.metadata,
      pinned: item.pinned,
      expiresAt: item.expires_at ? new Date(item.expires_at) : undefined,
      createdAt: new Date(item.created_at),
    }));
  }

  /**
   * Download artifact content from storage
   * Returns file buffer that can be saved to disk
   */
  async downloadArtifact(artifactId: string): Promise<Buffer> {
    console.log('[ArtifactStore] Downloading artifact:', artifactId);

    // Fetch artifact metadata
    const { data, error } = await this.supabase
      .from('dag_artifacts')
      .select('*')
      .eq('id', artifactId)
      .single();

    if (error || !data) {
      const msg = `Artifact not found: ${artifactId}`;
      console.error('[ArtifactStore] Error:', msg);
      throw new Error(msg);
    }

    console.log('[ArtifactStore] Found artifact:', {
      type: data.artifact_type,
      backend: data.storage_backend,
      path: data.storage_path,
    });

    // Download from appropriate backend
    if (data.storage_backend === 'supabase_storage') {
      return await this.downloadFromSupabaseStorage(data.storage_path);
    } else {
      throw new Error(`Unsupported storage backend: ${data.storage_backend}`);
    }
  }

  /**
   * Register all files in a directory as artifacts
   * Useful for bulk registration of training outputs
   */
  async registerDirectory(
    executionId: string,
    jobId: string,
    directoryPath: string,
    artifactType: ArtifactType,
    metadata?: Record<string, unknown>
  ): Promise<Artifact[]> {
    console.log('[ArtifactStore] Registering directory:', directoryPath);

    const files = await fs.readdir(directoryPath, { recursive: true, withFileTypes: true });
    const artifacts: Artifact[] = [];

    for (const file of files) {
      if (file.isFile()) {
        const filePath = path.join(file.path || directoryPath, file.name);
        console.log('[ArtifactStore] Registering file:', filePath);

        try {
          const artifact = await this.registerArtifact({
            executionId,
            jobId,
            artifactType,
            filePath,
            metadata: { ...metadata, filename: file.name },
          });
          artifacts.push(artifact);
        } catch (error) {
          console.error('[ArtifactStore] Failed to register file:', filePath, error);
        }
      }
    }

    console.log('[ArtifactStore] Registered', artifacts.length, 'files from directory');
    return artifacts;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: ArtifactStore | null = null;

export function getArtifactStore(): ArtifactStore {
  if (!instance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for ArtifactStore');
    }

    instance = new ArtifactStore(supabaseUrl, supabaseKey);
  }

  return instance;
}

export default ArtifactStore;

