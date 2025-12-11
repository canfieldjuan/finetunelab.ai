/**
 * Export Storage Abstraction
 *
 * Provides unified storage handling for export files that works with:
 * - Local filesystem (development)
 * - Supabase Storage (Vercel/production)
 *
 * Usage:
 * - Set EXPORT_USE_SUPABASE_STORAGE=true to use Supabase Storage
 * - On Vercel, this is auto-detected via process.env.VERCEL
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFile, writeFile, unlink, mkdir, stat } from 'fs/promises';
import * as path from 'path';

const SUPABASE_STORAGE_BUCKET = 'exports';
const STORAGE_PREFIX = 'storage://';

export interface StorageResult {
  path: string;
  size: number;
  isSupabaseStorage: boolean;
}

/**
 * Check if we should use Supabase Storage
 */
export function useSupabaseStorage(): boolean {
  // Explicit env var takes priority
  if (process.env.EXPORT_USE_SUPABASE_STORAGE === 'true') {
    return true;
  }
  if (process.env.EXPORT_USE_SUPABASE_STORAGE === 'false') {
    return false;
  }
  // Auto-detect Vercel environment
  return !!process.env.VERCEL;
}

/**
 * Check if a path is a Supabase Storage path
 */
export function isSupabaseStoragePath(filePath: string): boolean {
  return filePath.startsWith(STORAGE_PREFIX);
}

/**
 * Get Supabase client for storage operations
 */
function getStorageClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase credentials not configured. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return createClient(url, serviceKey);
}

/**
 * Save export content to storage
 */
export async function saveExport(
  content: Buffer | string,
  filename: string,
  localBasePath: string
): Promise<StorageResult> {
  const buffer = typeof content === 'string' ? Buffer.from(content) : content;

  if (useSupabaseStorage()) {
    return saveToSupabase(buffer, filename);
  }
  return saveToFilesystem(buffer, filename, localBasePath);
}

/**
 * Save to Supabase Storage
 */
async function saveToSupabase(
  content: Buffer,
  filename: string
): Promise<StorageResult> {
  const supabase = getStorageClient();
  const storagePath = `exports/${filename}`;

  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(storagePath, content, {
      contentType: 'application/octet-stream',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
  }

  return {
    path: `${STORAGE_PREFIX}${storagePath}`,
    size: content.length,
    isSupabaseStorage: true,
  };
}

/**
 * Save to local filesystem
 */
async function saveToFilesystem(
  content: Buffer,
  filename: string,
  basePath: string
): Promise<StorageResult> {
  // Ensure directory exists
  await mkdir(basePath, { recursive: true });

  const filePath = path.join(basePath, filename);
  await writeFile(filePath, content);

  const stats = await stat(filePath);

  return {
    path: filePath,
    size: stats.size,
    isSupabaseStorage: false,
  };
}

/**
 * Get export content from storage
 */
export async function getExport(filePath: string): Promise<Buffer> {
  if (isSupabaseStoragePath(filePath)) {
    return getFromSupabase(filePath);
  }
  return getFromFilesystem(filePath);
}

/**
 * Get from Supabase Storage
 */
async function getFromSupabase(storagePath: string): Promise<Buffer> {
  const supabase = getStorageClient();
  const path = storagePath.replace(STORAGE_PREFIX, '');

  const { data, error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .download(path);

  if (error) {
    throw new Error(`Failed to download from Supabase Storage: ${error.message}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

/**
 * Get from local filesystem
 */
async function getFromFilesystem(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

/**
 * Delete export from storage
 */
export async function deleteExport(filePath: string): Promise<void> {
  if (isSupabaseStoragePath(filePath)) {
    return deleteFromSupabase(filePath);
  }
  return deleteFromFilesystem(filePath);
}

/**
 * Delete from Supabase Storage
 */
async function deleteFromSupabase(storagePath: string): Promise<void> {
  const supabase = getStorageClient();
  const path = storagePath.replace(STORAGE_PREFIX, '');

  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(`Failed to delete from Supabase Storage: ${error.message}`);
  }
}

/**
 * Delete from local filesystem
 */
async function deleteFromFilesystem(filePath: string): Promise<void> {
  await unlink(filePath);
}

/**
 * Check if export exists
 */
export async function exportExists(filePath: string): Promise<boolean> {
  try {
    if (isSupabaseStoragePath(filePath)) {
      const supabase = getStorageClient();
      const path = filePath.replace(STORAGE_PREFIX, '');
      const { data } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .list(path.split('/').slice(0, -1).join('/'), {
          search: path.split('/').pop(),
        });
      return !!(data && data.length > 0);
    }
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get storage info for logging (safe, no sensitive data)
 */
export function getStorageInfo(): string {
  if (useSupabaseStorage()) {
    return `Supabase Storage (bucket: ${SUPABASE_STORAGE_BUCKET})`;
  }
  return `Local filesystem (${process.env.EXPORT_STORAGE_PATH || '/tmp/exports'})`;
}
