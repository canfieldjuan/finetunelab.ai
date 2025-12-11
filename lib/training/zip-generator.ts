// Zip Generator Utility for Training Packages
// Creates zip files from package directories for browser download
// Date: 2025-10-22

import archiver from 'archiver';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';

console.log('[ZipGenerator] Module loaded');

export interface ZipGenerationOptions {
  sourceDir: string;       // Directory to zip
  outputPath: string;      // Where to save zip file
  compressionLevel?: number; // 0-9, default 9
}

export interface ZipGenerationResult {
  success: boolean;
  zipPath?: string;
  size?: number;
  error?: string;
}

/**
 * Create a zip file from a directory
 * Compresses all files and subdirectories into a single zip archive
 */
export async function createZipFromDirectory(
  options: ZipGenerationOptions
): Promise<ZipGenerationResult> {
  console.log('[ZipGenerator] Starting zip creation');
  console.log('[ZipGenerator] Source directory:', options.sourceDir);
  console.log('[ZipGenerator] Output path:', options.outputPath);
  console.log('[ZipGenerator] Compression level:', options.compressionLevel ?? 9);

  try {
    // Verify source directory exists
    try {
      await fs.access(options.sourceDir);
      console.log('[ZipGenerator] Source directory verified');
    } catch {
      console.error('[ZipGenerator] Source directory not found:', options.sourceDir);
      return {
        success: false,
        error: `Source directory not found: ${options.sourceDir}`
      };
    }

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(options.outputPath);
    if (outputDir) {
      await fs.mkdir(outputDir, { recursive: true });
      console.log('[ZipGenerator] Output directory ready:', outputDir);
    }

    // Create write stream for output
    const output = createWriteStream(options.outputPath);
    const archive = archiver('zip', {
      zlib: { level: options.compressionLevel ?? 9 }
    });

    // Create promise to wait for completion
    const zipPromise = new Promise<void>((resolve, reject) => {
      output.on('close', () => {
        console.log('[ZipGenerator] Zip created successfully');
        console.log('[ZipGenerator] Total bytes written:', archive.pointer());
        resolve();
      });

      output.on('end', () => {
        console.log('[ZipGenerator] Output stream ended');
      });

      archive.on('error', (err) => {
        console.error('[ZipGenerator] Archiver error:', err);
        reject(err);
      });

      output.on('error', (err) => {
        console.error('[ZipGenerator] Output stream error:', err);
        reject(err);
      });

      archive.on('warning', (warning) => {
        if (warning.code === 'ENOENT') {
          console.warn('[ZipGenerator] Warning:', warning);
        } else {
          console.error('[ZipGenerator] Archive warning:', warning);
          reject(warning);
        }
      });

      archive.on('progress', (progressData) => {
        console.log('[ZipGenerator] Progress:', {
          entriesProcessed: progressData.entries.processed,
          entriesTotal: progressData.entries.total,
          bytesProcessed: progressData.fs.processedBytes
        });
      });
    });

    // Pipe archive to output file
    archive.pipe(output);

    // Add directory contents to archive
    console.log('[ZipGenerator] Adding directory contents to archive...');
    archive.directory(options.sourceDir, false);

    // Finalize the archive (complete the zip process)
    console.log('[ZipGenerator] Finalizing archive...');
    await archive.finalize();

    // Wait for the zip to complete
    await zipPromise;

    // Get file stats
    const stats = await fs.stat(options.outputPath);
    console.log('[ZipGenerator] Zip file size:', stats.size, 'bytes');

    return {
      success: true,
      zipPath: options.outputPath,
      size: stats.size
    };

  } catch (error) {
    console.error('[ZipGenerator] Error creating zip:', error);

    // Cleanup partial zip file if it exists
    try {
      await fs.unlink(options.outputPath);
      console.log('[ZipGenerator] Cleaned up partial zip file');
    } catch (cleanupErr) {
      console.warn('[ZipGenerator] Could not cleanup partial zip:', cleanupErr);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating zip'
    };
  }
}

/**
 * Create a streaming zip archive for download
 * Returns an archiver instance that can be piped to a response
 */
export function createZipStream(sourceDir: string): archiver.Archiver {
  console.log('[ZipGenerator] Creating zip stream for directory:', sourceDir);

  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  archive.on('error', (err) => {
    console.error('[ZipGenerator] Stream error:', err);
    throw err;
  });

  archive.on('warning', (warning) => {
    if (warning.code === 'ENOENT') {
      console.warn('[ZipGenerator] Stream warning:', warning);
    } else {
      console.error('[ZipGenerator] Stream error (warning):', warning);
      throw warning;
    }
  });

  // Add directory contents
  console.log('[ZipGenerator] Adding directory to stream...');
  archive.directory(sourceDir, false);

  return archive;
}

console.log('[ZipGenerator] Module functions defined');
