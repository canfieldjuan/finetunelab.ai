/**
 * @swagger
 * /api/training/dataset:
 *   post:
 *     summary: Upload training dataset
 *     description: |
 *       Upload and validate a training dataset for fine-tuning.
 *
 *       Datasets are automatically validated and normalized to a standard format.
 *       Supported formats include ChatML, ShareGPT, JSONL, DPO, and RLHF.
 *
 *       The system will:
 *       - Detect the dataset format automatically
 *       - Normalize to standard JSONL format
 *       - Compress with gzip for efficient storage
 *       - Validate data quality (input/output lengths, structure)
 *
 *       **Use Cases:**
 *       - Upload training data for fine-tuning jobs
 *       - Validate dataset format before training
 *       - Reuse datasets across multiple training runs
 *
 *       **Supported Formats:**
 *       - `chatml` - ChatML conversation format
 *       - `sharegpt` - ShareGPT conversation format
 *       - `jsonl` - JSON Lines format
 *       - `dpo` - Direct Preference Optimization pairs
 *       - `rlhf` - RLHF preference data
 *     tags:
 *       - Training
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - name
 *               - format
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Training dataset file
 *               name:
 *                 type: string
 *                 description: Dataset name
 *                 example: "Customer Support Conversations"
 *               description:
 *                 type: string
 *                 description: Optional dataset description
 *                 example: "10K customer support interactions from Q4 2024"
 *               format:
 *                 type: string
 *                 enum: [chatml, sharegpt, jsonl, dpo, rlhf]
 *                 description: Dataset format
 *                 example: "chatml"
 *               config_id:
 *                 type: string
 *                 description: Optional training config to associate with
 *                 example: "cfg_abc123"
 *     responses:
 *       200:
 *         description: Dataset uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dataset:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "ds_xyz789"
 *                     name:
 *                       type: string
 *                     format:
 *                       type: string
 *                     total_examples:
 *                       type: integer
 *                       example: 1000
 *                     avg_input_length:
 *                       type: number
 *                       example: 245.5
 *                     avg_output_length:
 *                       type: number
 *                       example: 128.3
 *                     file_size_bytes:
 *                       type: integer
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         original_format:
 *                           type: string
 *                         normalized:
 *                           type: boolean
 *                         compressed:
 *                           type: boolean
 *       400:
 *         description: Invalid dataset or missing fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   get:
 *     summary: List training datasets
 *     description: |
 *       Retrieve all uploaded datasets for the authenticated user.
 *
 *       **Use Cases:**
 *       - List available datasets for training
 *       - Select dataset for a training job
 *       - Review dataset statistics
 *     tags:
 *       - Training
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datasets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 datasets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       format:
 *                         type: string
 *                       total_examples:
 *                         type: integer
 *                       file_size_bytes:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { datasetValidator } from '@/lib/training/dataset-validator';
import { normalizedToJsonl } from '@/lib/training/format-normalizer';
import { estimateTrainingCost } from '@/lib/training/dataset-cost-estimator';
import type { DatasetFormat, EnhancedDatasetStats } from '@/lib/training/dataset.types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large uploads

export async function POST(request: NextRequest) {
  console.log('[DatasetAPI] POST: Uploading dataset');

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[DatasetAPI] Auth failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | null;
    const format = formData.get('format') as DatasetFormat;
    const configId = formData.get('config_id') as string | null;

    if (!file || !name || !format) {
      console.error('[DatasetAPI] Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log('[DatasetAPI] Validating dataset:', name);
    console.log('[DatasetAPI] User-specified format:', format);

    // NEW: Use validation with normalization
    let validation;
    try {
      validation = await datasetValidator.validateWithNormalization(file);
    } catch (validationError) {
      console.error('[DatasetAPI] Validation threw error:', validationError);
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationError instanceof Error ? validationError.message : 'Unknown validation error'
        },
        { status: 400 }
      );
    }
    
    if (!validation.valid) {
      console.error('[DatasetAPI] Validation failed:', validation.errors);
      return NextResponse.json(
        { error: 'Invalid dataset', details: validation.errors },
        { status: 400 }
      );
    }

    console.log('[DatasetAPI] Valid dataset, detected format:', validation.detectedFormat);
    console.log('[DatasetAPI] Normalized examples:', validation.normalized?.stats.convertedCount);

    // Convert normalized data to JSONL for storage
    let normalizedJsonl;
    try {
      normalizedJsonl = normalizedToJsonl(validation.normalized!.data);
      console.log('[DatasetAPI] JSONL conversion successful, length:', normalizedJsonl.length);
    } catch (jsonlError) {
      console.error('[DatasetAPI] JSONL conversion failed:', jsonlError);
      return NextResponse.json(
        { 
          error: 'Failed to convert to JSONL',
          details: jsonlError instanceof Error ? jsonlError.message : 'Unknown conversion error'
        },
        { status: 500 }
      );
    }
    
    // Compress the JSONL data using gzip
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(normalizedJsonl);
    
    // Use compression stream (available in Node.js and modern browsers)
    const compressionStream = new CompressionStream('gzip');
    const writer = compressionStream.writable.getWriter();
    writer.write(encodedData);
    writer.close();
    
    const compressedData = await new Response(compressionStream.readable).arrayBuffer();
    const normalizedBlob = new Blob([compressedData], { type: 'application/gzip' });

    console.log('[DatasetAPI] Original size:', encodedData.length, 'bytes');
    console.log('[DatasetAPI] Compressed size:', normalizedBlob.size, 'bytes');
    console.log('[DatasetAPI] Compression ratio:', (100 - (normalizedBlob.size / encodedData.length * 100)).toFixed(1) + '%');
    console.log('[DatasetAPI] Uploading compressed dataset');

    const datasetId = crypto.randomUUID();
    const storagePath = `${user.id}/private/${datasetId}.jsonl.gz`;

    // Use resumable upload for files > 50MB (Supabase API limit)
    // Supabase uses TUS protocol for resumable uploads
    let uploadError;

    if (normalizedBlob.size > 50 * 1024 * 1024) {
      console.log('[DatasetAPI] Large file detected, using TUS resumable upload');

      try {
        // Use Supabase's TUS resumable upload endpoint
        const tusEndpoint = `${supabaseUrl}/storage/v1/upload/resumable`;
        const arrayBuffer = await normalizedBlob.arrayBuffer();
        const fileSize = arrayBuffer.byteLength;

        // Encode metadata for TUS protocol (key base64value format)
        const metadataEntries = [
          `bucketName ${btoa('training-datasets')}`,
          `objectName ${btoa(storagePath)}`,
          `contentType ${btoa('application/gzip')}`,
          `cacheControl ${btoa('3600')}`
        ];
        const uploadMetadata = metadataEntries.join(',');

        console.log('[DatasetAPI] Creating TUS upload session for', fileSize, 'bytes');

        // Create upload session using TUS protocol
        const createResponse = await fetch(tusEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Tus-Resumable': '1.0.0',
            'Upload-Length': fileSize.toString(),
            'Upload-Metadata': uploadMetadata,
            'x-upsert': 'true'
          }
          // NO body for TUS create request
        });

        if (!createResponse.ok) {
          const errorBody = await createResponse.text();
          console.error('[DatasetAPI] TUS create response:', {
            status: createResponse.status,
            statusText: createResponse.statusText,
            body: errorBody,
            headers: Object.fromEntries(createResponse.headers.entries())
          });
          throw new Error(`TUS create failed: ${createResponse.statusText} - ${errorBody}`);
        }

        const uploadUrl = createResponse.headers.get('location');
        if (!uploadUrl) {
          throw new Error('No upload URL returned from TUS create');
        }

        console.log('[DatasetAPI] TUS upload session created:', uploadUrl);

        // Upload file data in chunks for better reliability and progress tracking
        const chunkSize = 6 * 1024 * 1024; // 6MB chunks (safe for most networks)
        const totalSize = arrayBuffer.byteLength;
        const totalChunks = Math.ceil(totalSize / chunkSize);
        let uploadedBytes = 0;

        console.log(`[DatasetAPI] Uploading ${totalSize} bytes in ${totalChunks} chunks`);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * chunkSize;
          const end = Math.min(start + chunkSize, totalSize);
          const chunk = arrayBuffer.slice(start, end);

          console.log(`[DatasetAPI] Uploading chunk ${chunkIndex + 1}/${totalChunks} (${start}-${end} bytes, offset: ${uploadedBytes})`);

          const uploadResponse = await fetch(uploadUrl, {
            method: 'PATCH',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/offset+octet-stream',
              'Upload-Offset': uploadedBytes.toString(),
              'Tus-Resumable': '1.0.0'
            },
            body: chunk
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`TUS chunk ${chunkIndex + 1} upload failed: ${uploadResponse.statusText} - ${errorText}`);
          }

          uploadedBytes += chunk.byteLength;
          console.log(`[DatasetAPI] Chunk ${chunkIndex + 1}/${totalChunks} completed. Total uploaded: ${uploadedBytes}/${totalSize} bytes`);
        }

        console.log('[DatasetAPI] TUS chunked upload completed successfully');
      } catch (tusError) {
        console.error('[DatasetAPI] TUS upload error:', tusError);
        uploadError = tusError;
      }
    } else {
      // Small file: use standard upload
      console.log('[DatasetAPI] Standard upload');
      const { error } = await supabase.storage
        .from('training-datasets')
        .upload(storagePath, normalizedBlob);

      uploadError = error;
    }

    if (uploadError) {
      console.error('[DatasetAPI] Upload error:', uploadError);
      return NextResponse.json({
        error: 'Upload failed',
        details: uploadError instanceof Error ? uploadError.message : String(uploadError)
      }, { status: 500 });
    }

    console.log('[DatasetAPI] Normalized dataset uploaded');

    // Calculate estimated token count for cost estimation
    // Using avg_output_length as proxy for tokens (approximate)
    const estimatedTotalTokens = validation.stats!.total_examples *
      (validation.stats!.avg_input_length + validation.stats!.avg_output_length);

    // Generate cost estimates for different providers
    const costEstimates = {
      runpod: estimateTrainingCost(estimatedTotalTokens, 3, 'runpod', { gpuType: 'RTX 4090' }),
      local: estimateTrainingCost(estimatedTotalTokens, 3, 'local'),
      openai: estimateTrainingCost(estimatedTotalTokens, 3, 'openai', { model: 'gpt-3.5-turbo' })
    };

    const { data, error } = await supabase
      .from('training_datasets')
      .insert({
        id: datasetId,
        user_id: user.id,
        config_id: configId,
        name,
        description,
        format, // Keep user-specified format for UI display
        file_size_bytes: normalizedBlob.size,
        total_examples: validation.stats!.total_examples,
        avg_input_length: validation.stats!.avg_input_length,
        avg_output_length: validation.stats!.avg_output_length,
        storage_path: storagePath,
        // Store detection metadata with cost estimates
        metadata: {
          original_format: validation.detectedFormat,
          normalized: true,
          compressed: true,
          compression_type: 'gzip',
          original_size_bytes: encodedData.length,
          normalization_date: new Date().toISOString(),
          errors: validation.errors || [],
          estimated_total_tokens: estimatedTotalTokens,
          cost_estimates: {
            runpod: costEstimates.runpod.estimatedCost,
            local: costEstimates.local.estimatedCost,
            openai: costEstimates.openai.estimatedCost
          }
        }
      })
      .select()
      .single();

    if (error) {
      console.error('[DatasetAPI] Database error:', error);
      await supabase.storage.from('training-datasets').remove([storagePath]);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[DatasetAPI] Dataset created:', data.id);
    console.log('[DatasetAPI] Original format:', validation.detectedFormat);
    console.log('[DatasetAPI] Stored format: normalized JSONL');
    console.log('[DatasetAPI] Estimated tokens:', estimatedTotalTokens);

    return NextResponse.json({
      dataset: data,
      cost_estimates: costEstimates,
      estimated_tokens: estimatedTotalTokens
    });
  } catch (error) {
    console.error('[DatasetAPI] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[DatasetAPI] Error details:', {
      message: errorMessage,
      stack: errorStack,
      type: typeof error,
      error: error
    });
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  console.log('[DatasetAPI] GET: Fetching datasets');

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('training_datasets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DatasetAPI] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[DatasetAPI] Found', data.length, 'datasets');
    return NextResponse.json({ datasets: data });
  } catch (error) {
    console.error('[DatasetAPI] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
