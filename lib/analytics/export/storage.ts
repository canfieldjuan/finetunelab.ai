/**
 * Analytics Export Storage Service
 * Handles file operations for analytics exports
 * Phase 3: Backend API Endpoints
 * Date: October 25, 2025
 */

import { promises as fs } from 'fs';
import path from 'path';

const EXPORT_DIR = path.join(process.cwd(), 'storage', 'analytics-exports');

/**
 * Ensure export directory exists
 */
export async function ensureExportDirectory(): Promise<void> {
  console.log('[Storage] Ensuring export directory exists');
  
  try {
    await fs.mkdir(EXPORT_DIR, { recursive: true });
    console.log('[Storage] Export directory ready:', EXPORT_DIR);
  } catch (error) {
    console.error('[Storage] Failed to create directory:', error);
    throw new Error('Failed to create export directory');
  }
}

/**
 * Write export file to storage
 */
export async function writeExportFile(
  exportId: string,
  format: string,
  content: string
): Promise<{ filePath: string; fileSize: number }> {
  console.log('[Storage] Writing export file:', exportId, format);
  
  await ensureExportDirectory();
  
  const fileName = `${exportId}.${format}`;
  const filePath = path.join(EXPORT_DIR, fileName);
  
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    const stats = await fs.stat(filePath);
    
    console.log('[Storage] File written:', filePath, 'Size:', stats.size);
    return { filePath: fileName, fileSize: stats.size };
  } catch (error) {
    console.error('[Storage] Write error:', error);
    throw new Error('Failed to write export file');
  }
}

/**
 * Read export file from storage
 */
export async function readExportFile(fileName: string): Promise<Buffer> {
  console.log('[Storage] Reading export file:', fileName);
  
  const filePath = path.join(EXPORT_DIR, fileName);
  
  try {
    const buffer = await fs.readFile(filePath);
    console.log('[Storage] File read:', filePath, 'Size:', buffer.length);
    return buffer;
  } catch (error) {
    console.error('[Storage] Read error:', error);
    throw new Error('Export file not found');
  }
}

/**
 * Delete export file from storage
 */
export async function deleteExportFile(fileName: string): Promise<void> {
  console.log('[Storage] Deleting export file:', fileName);
  
  const filePath = path.join(EXPORT_DIR, fileName);
  
  try {
    await fs.unlink(filePath);
    console.log('[Storage] File deleted:', filePath);
  } catch (error) {
    console.error('[Storage] Delete error:', error);
  }
}

/**
 * Get export file info
 */
export async function getExportFileInfo(fileName: string): Promise<{
  size: number;
  created: Date;
  modified: Date;
} | null> {
  console.log('[Storage] Getting file info:', fileName);
  
  const filePath = path.join(EXPORT_DIR, fileName);
  
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
    };
  } catch (error) {
    console.error('[Storage] File info error:', error);
    return null;
  }
}

/**
 * Delete expired exports from storage
 */
export async function deleteExpiredExports(
  expiredFileNames: string[]
): Promise<number> {
  console.log('[Storage] Deleting', expiredFileNames.length, 'expired files');
  
  let deletedCount = 0;
  
  for (const fileName of expiredFileNames) {
    try {
      await deleteExportFile(fileName);
      deletedCount++;
    } catch (error) {
      console.error('[Storage] Failed to delete:', fileName, error);
    }
  }
  
  console.log('[Storage] Deleted', deletedCount, 'expired files');
  return deletedCount;
}
