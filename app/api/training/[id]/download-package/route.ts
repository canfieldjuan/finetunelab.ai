// Download Local Training Package API
// POST /api/training/{id}/download-package - Generate and return local training package
// Date: 2025-10-22

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateLocalPackage } from '@/lib/training/local-package-generator';
import { createZipFromDirectory } from '@/lib/training/zip-generator';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';

export const runtime = 'nodejs';

console.log('[DownloadPackageAPI] Route loaded');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  console.log('[DownloadPackageAPI] POST: Generating local package for:', resolvedParams.id);

  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[DownloadPackageAPI] No authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[DownloadPackageAPI] Auth failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[DownloadPackageAPI] User authenticated:', user.id);

    const configId = resolvedParams.id;

    // Fetch training config
    console.log('[DownloadPackageAPI] Fetching training config:', configId);
    const { data: config, error: configError } = await supabase
      .from('training_configs')
      .select('*')
      .eq('id', configId)
      .eq('user_id', user.id)
      .single();

    if (configError || !config) {
      console.error('[DownloadPackageAPI] Config not found:', configError);
      return NextResponse.json(
        { error: 'Training config not found' },
        { status: 404 }
      );
    }

    console.log('[DownloadPackageAPI] Config loaded:', config.name);
    console.log('[DownloadPackageAPI] PREDICTIONS CHECK - Database config:', {
      hasPredictions: !!config.config_json?.predictions,
      predictionsEnabled: config.config_json?.predictions?.enabled,
      predictionsConfig: config.config_json?.predictions
    });

    // Fetch attached datasets via junction table
    console.log('[DownloadPackageAPI] Fetching datasets via junction table for config:', configId);
    const { data: configDatasets, error: datasetsError } = await supabase
      .from('training_config_datasets')
      .select(`
        dataset_id,
        training_datasets (*)
      `)
      .eq('config_id', configId);

    if (datasetsError) {
      console.error('[DownloadPackageAPI] Error fetching datasets:', datasetsError);
    }

    // Extract datasets from junction table
    type ConfigDatasetRow = {
      dataset_id: string;
      training_datasets: TrainingDatasetRecord | null;
    };

    const datasets = ((configDatasets || []) as unknown as ConfigDatasetRow[])
      .map((cd) => cd.training_datasets)
      .filter((d): d is TrainingDatasetRecord => d !== null);

    // Download datasets from Supabase Storage to temp directory
    const tmpDir = tmpdir();
    const datasetTempDir = path.join(tmpDir, 'finetune-lab-datasets', configId);
    const datasetPaths: string[] = [];

    if (datasets && datasets.length > 0) {
      console.log(`[DownloadPackageAPI] Found ${datasets.length} datasets, downloading from Supabase Storage...`);

      await fs.mkdir(datasetTempDir, { recursive: true });

      for (const dataset of datasets) {
        // Skip datasets without storage path
        if (!dataset.storage_path) {
          console.warn(`[DownloadPackageAPI] Skipping dataset ${dataset.id} - no storage path`);
          continue;
        }

        console.log(`[DownloadPackageAPI] Downloading dataset: ${dataset.storage_path}`);

        // Download from Supabase Storage
        const { data: fileData, error: downloadError} = await supabase.storage
          .from('training-datasets')
          .download(dataset.storage_path);

        if (downloadError || !fileData) {
          console.error('[DownloadPackageAPI] Failed to download dataset:', downloadError);
          continue;
        }

        // Save to temp file
        const tempFilePath = path.join(datasetTempDir, `${dataset.id}.jsonl`);
        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.writeFile(tempFilePath, buffer);

        console.log(`[DownloadPackageAPI] Dataset saved to: ${tempFilePath}`);
        datasetPaths.push(tempFilePath);
      }
    } else {
      console.log('[DownloadPackageAPI] No datasets attached to config');
    }

    console.log('[DownloadPackageAPI] Downloaded dataset paths:', datasetPaths);

    // Generate package in temp directory
    const packageOutputDir = path.join(tmpDir, 'finetune-lab-packages');

    console.log('[DownloadPackageAPI] Generating package...');
    console.log('[DownloadPackageAPI] Using normalized config for backend');
    const result = await generateLocalPackage({
      configId: config.id,
      configName: config.name,
      configJson: config.config_json,
      datasetPaths,
      outputDir: packageOutputDir,
      normalizeForBackend: true,
    });

    if (!result.success || !result.packagePath) {
      console.error('[DownloadPackageAPI] Package generation failed:', result.error);
      return NextResponse.json(
        { error: result.error || 'Failed to generate package' },
        { status: 500 }
      );
    }

    console.log('[DownloadPackageAPI] Package generated successfully:', result.packagePath);

    // Create zip file from package directory
    console.log('[DownloadPackageAPI] Creating zip file...');
    const zipFileName = `finetune-lab-${config.name.replace(/\s+/g, '-').toLowerCase()}.zip`;
    const zipDir = path.join(tmpDir, 'finetune-lab-zips');
    const zipPath = path.join(zipDir, zipFileName);

    await fs.mkdir(zipDir, { recursive: true });
    console.log('[DownloadPackageAPI] Zip directory ready:', zipDir);

    // Generate zip from package directory
    const zipResult = await createZipFromDirectory({
      sourceDir: result.packagePath,
      outputPath: zipPath,
      compressionLevel: parseInt(process.env.TRAINING_PACKAGE_COMPRESSION_LEVEL || '9', 10)
    });

    if (!zipResult.success || !zipResult.zipPath) {
      console.error('[DownloadPackageAPI] Zip creation failed:', zipResult.error);
      return NextResponse.json(
        { error: zipResult.error || 'Failed to create zip file' },
        { status: 500 }
      );
    }

    console.log('[DownloadPackageAPI] Zip created successfully:', zipResult.zipPath);
    console.log('[DownloadPackageAPI] Zip size:', zipResult.size, 'bytes');

    // Read zip file into buffer
    console.log('[DownloadPackageAPI] Reading zip file...');
    const zipBuffer = await fs.readFile(zipResult.zipPath);
    console.log('[DownloadPackageAPI] Zip file read into buffer, size:', zipBuffer.length);

    // Cleanup temporary files
    console.log('[DownloadPackageAPI] Cleaning up temporary files...');
    try {
      await fs.rm(result.packagePath, { recursive: true, force: true });
      console.log('[DownloadPackageAPI] Removed package directory:', result.packagePath);
    } catch (cleanupErr) {
      console.warn('[DownloadPackageAPI] Failed to cleanup package directory:', cleanupErr);
    }

    try {
      await fs.rm(zipResult.zipPath, { force: true });
      console.log('[DownloadPackageAPI] Removed zip file:', zipResult.zipPath);
    } catch (cleanupErr) {
      console.warn('[DownloadPackageAPI] Failed to cleanup zip file:', cleanupErr);
    }

    try {
      await fs.rm(datasetTempDir, { recursive: true, force: true });
      console.log('[DownloadPackageAPI] Removed dataset temp directory:', datasetTempDir);
    } catch (cleanupErr) {
      console.warn('[DownloadPackageAPI] Failed to cleanup dataset directory:', cleanupErr);
    }

    console.log('[DownloadPackageAPI] Cleanup complete');

    // Return zip file as download
    console.log('[DownloadPackageAPI] Returning zip file for download:', zipFileName);
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('[DownloadPackageAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate package' },
      { status: 500 }
    );
  }
}

console.log('[DownloadPackageAPI] Route handlers defined');
