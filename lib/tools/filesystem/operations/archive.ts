import { defaultPathValidator } from '../security/pathValidator';
import { defaultPermissionChecker } from '../security/permissionCheck';
import { defaultPathSanitizer } from '../security/sanitizer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yauzl from 'yauzl';
import * as yazl from 'yazl';
import { createWriteStream } from 'fs';

interface ArchiveResult {
  source: string;
  destination: string;
  operation: string;
  size?: number;
  created?: string;
  filesExtracted?: number;
}

/**
 * Create a zip archive from a file or directory
 */
export async function createArchive(
  sourcePath: string,
  destinationPath: string
): Promise<ArchiveResult> {
  const sourceValidation = await defaultPathValidator.validatePath(sourcePath);
  if (!sourceValidation.isValid) {
    throw new Error(
      sourceValidation.error || '[FileSystem] SecurityError: Invalid source path'
    );
  }

  const destValidation = await defaultPathValidator.validatePath(destinationPath);
  if (!destValidation.isValid) {
    throw new Error(
      destValidation.error || '[FileSystem] SecurityError: Invalid destination path'
    );
  }

  if (!destinationPath.endsWith('.zip')) {
    throw new Error('[FileSystem] ValidationError: Destination must end with .zip');
  }

  const sourcePermission = await defaultPermissionChecker.canRead(
    sourceValidation.normalizedPath!
  );
  if (!sourcePermission.hasPermission) {
    throw new Error(
      sourcePermission.error || '[FileSystem] PermissionError: Cannot read source'
    );
  }

  const destPermission = await defaultPermissionChecker.canWrite(
    destValidation.normalizedPath!
  );
  if (!destPermission.hasPermission) {
    throw new Error(
      destPermission.error || '[FileSystem] PermissionError: Cannot write to destination'
    );
  }

  const sourceStats = await fs.stat(sourceValidation.normalizedPath!);
  const zipfile = new yazl.ZipFile();

  if (sourceStats.isFile()) {
    zipfile.addFile(sourceValidation.normalizedPath!, path.basename(sourcePath));
  } else if (sourceStats.isDirectory()) {
    await addDirectoryToZip(zipfile, sourceValidation.normalizedPath!, '');
  } else {
    throw new Error('[FileSystem] OperationError: Source is neither a file nor a directory');
  }

  zipfile.end();

  return new Promise((resolve, reject) => {
    const writeStream = createWriteStream(destValidation.normalizedPath!);
    
    zipfile.outputStream.pipe(writeStream);

    writeStream.on('finish', async () => {
      try {
        const stats = await fs.stat(destValidation.normalizedPath!);
        resolve({
          source: defaultPathSanitizer.sanitizePath(sourceValidation.normalizedPath!),
          destination: defaultPathSanitizer.sanitizePath(destValidation.normalizedPath!),
          operation: 'create_archive',
          size: stats.size,
          created: stats.birthtime.toISOString()
        });
      } catch (error) {
        reject(error);
      }
    });

    writeStream.on('error', reject);
    zipfile.outputStream.on('error', reject);
  });
}

/**
 * Helper function to recursively add directory contents to zip
 */
async function addDirectoryToZip(
  zipfile: yazl.ZipFile,
  dirPath: string,
  relativePath: string
): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const entryRelativePath = path.join(relativePath, entry.name);

    if (entry.isFile()) {
      zipfile.addFile(fullPath, entryRelativePath);
    } else if (entry.isDirectory()) {
      await addDirectoryToZip(zipfile, fullPath, entryRelativePath);
    }
  }
}

/**
 * Extract a zip archive with strict path validation to prevent zip slip attacks
 */
export async function extractArchive(
  sourcePath: string,
  destinationPath: string
): Promise<ArchiveResult> {
  const sourceValidation = await defaultPathValidator.validatePath(sourcePath);
  if (!sourceValidation.isValid) {
    throw new Error(
      sourceValidation.error || '[FileSystem] SecurityError: Invalid source path'
    );
  }

  const destValidation = await defaultPathValidator.validatePath(destinationPath);
  if (!destValidation.isValid) {
    throw new Error(
      destValidation.error || '[FileSystem] SecurityError: Invalid destination path'
    );
  }

  if (!sourcePath.endsWith('.zip')) {
    throw new Error('[FileSystem] ValidationError: Source must be a .zip file');
  }

  const sourcePermission = await defaultPermissionChecker.canRead(
    sourceValidation.normalizedPath!
  );
  if (!sourcePermission.hasPermission) {
    throw new Error(
      sourcePermission.error || '[FileSystem] PermissionError: Cannot read source'
    );
  }

  const destPermission = await defaultPermissionChecker.canWrite(
    destValidation.normalizedPath!
  );
  if (!destPermission.hasPermission) {
    throw new Error(
      destPermission.error || '[FileSystem] PermissionError: Cannot write to destination'
    );
  }

  const destStats = await fs.stat(destValidation.normalizedPath!).catch(() => null);
  if (!destStats || !destStats.isDirectory()) {
    throw new Error('[FileSystem] OperationError: Destination must be an existing directory');
  }

  const zipfile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(
      sourceValidation.normalizedPath!,
      { lazyEntries: true },
      (err, zf) => {
        if (err) reject(err);
        else resolve(zf!);
      }
    );
  });

  return new Promise((resolve, reject) => {
    let extractedFiles = 0;

    zipfile.readEntry();

    zipfile.on('entry', async (entry: yauzl.Entry) => {
      try {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }

        const sanitizedFileName = entry.fileName.replace(/\\/g, '/');
        
        if (sanitizedFileName.includes('..') || path.isAbsolute(sanitizedFileName)) {
          throw new Error(
            `[FileSystem] SecurityError: Zip slip detected - invalid entry: ${sanitizedFileName}`
          );
        }

        const targetPath = path.join(destValidation.normalizedPath!, sanitizedFileName);
        const normalizedTarget = path.normalize(targetPath);

        if (!normalizedTarget.startsWith(destValidation.normalizedPath!)) {
          throw new Error(
            `[FileSystem] SecurityError: Zip slip detected - entry escapes destination: ${sanitizedFileName}`
          );
        }

        const targetDir = path.dirname(normalizedTarget);
        await fs.mkdir(targetDir, { recursive: true });

        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) {
            reject(err);
            return;
          }

          const writeStream = createWriteStream(normalizedTarget);

          readStream!.on('end', () => {
            extractedFiles++;
            zipfile.readEntry();
          });

          readStream!.on('error', reject);
          writeStream.on('error', reject);

          readStream!.pipe(writeStream);
        });
      } catch (error) {
        reject(error);
      }
    });

    zipfile.on('end', () => {
      resolve({
        source: defaultPathSanitizer.sanitizePath(sourceValidation.normalizedPath!),
        destination: defaultPathSanitizer.sanitizePath(destValidation.normalizedPath!),
        operation: 'extract_archive',
        filesExtracted: extractedFiles
      });
    });

    zipfile.on('error', reject);
  });
}
