// Dataset Prompt Extractor
// Purpose: Extract prompts from training datasets stored in Supabase
// Date: 2025-10-30

import { createClient } from '@supabase/supabase-js';
import type { DatasetFormat } from '@/lib/training/dataset.types';
import {
  parseChatML,
  parseShareGPT,
  parseAlpaca,
  parseOpenOrca,
  parseDPO,
  parseRLHF,
  parseJSONL,
  parseUnnaturalInstructions
} from './format-parsers';

export interface DatasetExtractionResult {
  prompts: string[];
  total: number;
  datasetName: string;
  format: DatasetFormat;
  errors?: string[];
}

export type DatasetExtractionAuth =
  | { mode: 'session'; sessionToken: string }
  | { mode: 'service' };

/**
 * Extract prompts from a training dataset
 *
 * @param datasetId - ID of the dataset in training_datasets table
 * @param maxPrompts - Maximum number of prompts to extract
 * @param userId - User ID for access verification
 * @param auth - Auth mode for Supabase (session or service role)
 * @returns Extraction result with prompts array
 */
export async function extractPromptsFromDataset(
  datasetId: string,
  maxPrompts: number,
  userId: string,
  auth: DatasetExtractionAuth
): Promise<DatasetExtractionResult> {
  console.log('[DatasetExtractor] Starting extraction:', {
    datasetId,
    maxPrompts,
    userId
  });

  const errors: string[] = [];

  try {
    // Initialize Supabase clients
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      throw new Error('Supabase environment variables not configured');
    }

    if (auth.mode === 'session') {
      if (!supabaseAnonKey) {
        throw new Error('Supabase environment variables not configured');
      }
    } else {
      if (!supabaseServiceKey) {
        throw new Error('Supabase environment variables not configured');
      }
    }

    const supabase =
      auth.mode === 'session'
        ? createClient(supabaseUrl, supabaseAnonKey!, {
            global: {
              headers: {
                Authorization: auth.sessionToken.startsWith('Bearer ')
                  ? auth.sessionToken
                  : `Bearer ${auth.sessionToken}`,
              },
            },
          })
        : createClient(supabaseUrl, supabaseServiceKey!);

    // Fetch dataset record from database
    console.log('[DatasetExtractor] Fetching dataset record:', datasetId);
    const { data: dataset, error: fetchError } = await supabase
      .from('training_datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (fetchError) {
      console.error('[DatasetExtractor] Failed to fetch dataset:', fetchError);
      throw new Error(`Failed to fetch dataset: ${fetchError.message}`);
    }

    if (!dataset) {
      throw new Error('Dataset not found');
    }

    console.log('[DatasetExtractor] Dataset found:', {
      name: dataset.name,
      format: dataset.format,
      storagePath: dataset.storage_path,
      totalExamples: dataset.total_examples
    });

    // Verify user has access (either owns it or it's global)
    if (dataset.user_id !== userId) {
      console.warn('[DatasetExtractor] Access denied: User does not own dataset');
      throw new Error('Access denied: You do not have permission to access this dataset');
    }

    // Download file from Supabase Storage
    console.log('[DatasetExtractor] Downloading file from storage:', dataset.storage_path);
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('training-datasets')
      .download(dataset.storage_path);

    if (downloadError) {
      console.error('[DatasetExtractor] Failed to download file:', downloadError);
      throw new Error(`Failed to download dataset file: ${downloadError.message}`);
    }

    if (!fileData) {
      throw new Error('Dataset file is empty or missing');
    }

    // Convert Blob to text
    console.log('[DatasetExtractor] Converting file to text');
    const content = await fileData.text();

    if (!content || content.trim().length === 0) {
      throw new Error('Dataset file content is empty');
    }

    console.log('[DatasetExtractor] File content length:', content.length);

    // Parse based on format
    console.log('[DatasetExtractor] Parsing format:', dataset.format);
    let prompts: string[] = [];

    switch (dataset.format) {
      case 'chatml':
        prompts = parseChatML(content, maxPrompts);
        break;

      case 'sharegpt':
        prompts = parseShareGPT(content, maxPrompts);
        break;

      case 'alpaca':
        prompts = parseAlpaca(content, maxPrompts);
        break;

      case 'openorca':
        prompts = parseOpenOrca(content, maxPrompts);
        break;

      case 'dpo':
        prompts = parseDPO(content, maxPrompts);
        break;

      case 'rlhf':
        prompts = parseRLHF(content, maxPrompts);
        break;

      case 'jsonl':
        prompts = parseJSONL(content, maxPrompts);
        break;

      case 'unnatural':
        prompts = parseUnnaturalInstructions(content, maxPrompts);
        break;

      default:
        console.warn('[DatasetExtractor] Unknown format, attempting JSONL parser');
        prompts = parseJSONL(content, maxPrompts);
        errors.push(`Unknown format "${dataset.format}", attempted JSONL parsing`);
    }

    // Validate results
    if (prompts.length === 0) {
      errors.push('No prompts extracted from dataset. Please verify the dataset format is correct.');
    }

    console.log('[DatasetExtractor] Extraction complete:', {
      promptsExtracted: prompts.length,
      totalRequested: maxPrompts,
      errors: errors.length
    });

    return {
      prompts,
      total: prompts.length,
      datasetName: dataset.name,
      format: dataset.format,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    console.error('[DatasetExtractor] Extraction failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error during extraction';
    errors.push(errorMessage);

    return {
      prompts: [],
      total: 0,
      datasetName: 'Unknown',
      format: 'jsonl',
      errors
    };
  }
}

console.log('[DatasetExtractor] Module loaded');
