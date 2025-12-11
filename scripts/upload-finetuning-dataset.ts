#!/usr/bin/env tsx
/**
 * Upload Finetuning Expert SFT Dataset
 *
 * Programmatically uploads the finetuning expert dataset to the database
 * Usage: npx tsx scripts/upload-finetuning-dataset.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { datasetValidator } from '../lib/training/dataset-validator';
import { normalizedToJsonl } from '../lib/training/format-normalizer';
import pako from 'pako';

const DATASET_PATH = path.join(__dirname, '../output/finetuning_expert_sft_with_reasoning.jsonl');
const DATASET_NAME = 'Finetuning Expert SFT with Reasoning';
const DATASET_DESCRIPTION = 'Comprehensive finetuning workflows with step-by-step reasoning. Covers sentiment analysis, NER, QA, summarization, code generation, NL2SQL, debugging, data cleaning, and production pipelines.';
const DATASET_FORMAT = 'chatml';

async function main() {
  console.log('[Upload] Starting finetuning expert dataset upload');
  console.log('[Upload] Dataset path:', DATASET_PATH);

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Need service key for direct upload

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get user ID (you'll need to replace this with actual user ID)
  const USER_ID = process.env.UPLOAD_USER_ID;
  if (!USER_ID) {
    console.error('[Upload] ERROR: UPLOAD_USER_ID environment variable required');
    console.error('[Upload] Set it to your user ID from auth.users table');
    console.error('[Upload] Example: export UPLOAD_USER_ID=abc-123-def-456');
    process.exit(1);
  }

  // Read file
  console.log('[Upload] Reading dataset file...');
  const fileContent = await fs.readFile(DATASET_PATH, 'utf-8');
  const fileBuffer = Buffer.from(fileContent);
  const file = new File([fileBuffer], path.basename(DATASET_PATH), { type: 'application/jsonl' });

  // Validate and normalize
  console.log('[Upload] Validating dataset...');
  const validation = await datasetValidator.validateWithNormalization(file);

  if (!validation.valid) {
    console.error('[Upload] Validation failed:', validation.errors);
    process.exit(1);
  }

  console.log('[Upload] ✓ Dataset valid');
  console.log('[Upload] Detected format:', validation.detectedFormat);
  console.log('[Upload] Total examples:', validation.stats?.total_examples);
  console.log('[Upload] Avg input length:', validation.stats?.avg_input_length?.toFixed(1));
  console.log('[Upload] Avg output length:', validation.stats?.avg_output_length?.toFixed(1));

  // Convert to JSONL
  console.log('[Upload] Converting to normalized JSONL...');
  const normalizedJsonl = normalizedToJsonl(validation.normalized!.data);

  // Compress with gzip
  console.log('[Upload] Compressing with gzip...');
  const encodedData = Buffer.from(normalizedJsonl, 'utf-8');
  const compressedData = pako.gzip(encodedData);
  const compressedBlob = new Blob([compressedData], { type: 'application/gzip' });

  const compressionRatio = (100 - (compressedBlob.size / encodedData.length * 100)).toFixed(1);
  console.log('[Upload] Original size:', encodedData.length, 'bytes');
  console.log('[Upload] Compressed size:', compressedBlob.size, 'bytes');
  console.log('[Upload] Compression ratio:', compressionRatio + '%');

  // Generate IDs
  const datasetId = crypto.randomUUID();
  const storagePath = `${USER_ID}/private/${datasetId}.jsonl.gz`;

  // Upload to storage
  console.log('[Upload] Uploading to Supabase storage...');
  console.log('[Upload] Storage path:', storagePath);

  const { error: uploadError } = await supabase.storage
    .from('training-datasets')
    .upload(storagePath, compressedBlob, {
      contentType: 'application/gzip',
      upsert: false
    });

  if (uploadError) {
    console.error('[Upload] Storage upload failed:', uploadError);
    process.exit(1);
  }

  console.log('[Upload] ✓ File uploaded to storage');

  // Insert database record
  console.log('[Upload] Creating database record...');

  const { data, error: dbError } = await supabase
    .from('training_datasets')
    .insert({
      id: datasetId,
      user_id: USER_ID,
      config_id: null,
      name: DATASET_NAME,
      description: DATASET_DESCRIPTION,
      format: DATASET_FORMAT,
      file_size_bytes: compressedBlob.size,
      total_examples: validation.stats!.total_examples,
      avg_input_length: validation.stats!.avg_input_length,
      avg_output_length: validation.stats!.avg_output_length,
      storage_path: storagePath,
      metadata: {
        original_format: validation.detectedFormat,
        normalized: true,
        compressed: true,
        compression_type: 'gzip',
        original_size_bytes: encodedData.length,
        normalization_date: new Date().toISOString(),
        errors: validation.errors || [],
        source: 'manual_script_upload',
        content_type: 'finetuning_workflows_with_reasoning'
      }
    })
    .select()
    .single();

  if (dbError) {
    console.error('[Upload] Database insert failed:', dbError);
    // Clean up storage
    await supabase.storage.from('training-datasets').remove([storagePath]);
    process.exit(1);
  }

  console.log('[Upload] ✓ Database record created');
  console.log('[Upload] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[Upload] SUCCESS! Dataset uploaded');
  console.log('[Upload] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[Upload] Dataset ID:', data.id);
  console.log('[Upload] Name:', data.name);
  console.log('[Upload] Examples:', data.total_examples);
  console.log('[Upload] Format:', data.format);
  console.log('[Upload] Size:', (data.file_size_bytes / 1024).toFixed(2), 'KB');
  console.log('[Upload] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[Upload] You can now use this dataset in training configs!');
}

main().catch((error) => {
  console.error('[Upload] Fatal error:', error);
  process.exit(1);
});
