// Prompt Extractor Tool - Service Implementation
// Date: October 16, 2025

import type { ExtractionOptions, PromptExtractionResult } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Use unknown instead of any for type safety
function isHumanMessage(msg: unknown): boolean {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as { sender?: string; text?: unknown };
  return m.sender === 'human' && typeof m.text === 'string' && m.text.trim().length > 0;
}

export async function extractPrompts(options: ExtractionOptions): Promise<PromptExtractionResult> {
  const {
    directory,
    filePattern = '.json',
    maxPrompts = 10000,
    exportFormat,
    exportFilePath,
    dataSource,
  } = options;

  const prompts: string[] = [];
  const errors: string[] = [];
  let filesProcessed = 0;

  const fsPromises = fs.promises;

  // Determine source type
  const sourceType = dataSource?.type || (directory ? 'local' : undefined);
  if (!sourceType) {
    const msg = 'No data source provided (directory or dataSource)';
    console.error('[PromptExtractor] ERROR:', msg);
    return { prompts, total: 0, filesProcessed: 0, errors: [msg] };
  }

  async function processFileContent(content: string, fileLabel: string) {
    try {
      const data = JSON.parse(content);

      type Conversation = { chat_messages?: unknown[] };

      if (Array.isArray(data)) {
        for (const convo of data as Conversation[]) {
          if (Array.isArray(convo.chat_messages)) {
            for (const msg of convo.chat_messages as unknown[]) {
              if (isHumanMessage(msg)) {
                prompts.push((msg as { text: string }).text);
                if (prompts.length >= maxPrompts) return; // stop early
              }
            }
          }
          if (prompts.length >= maxPrompts) break;
        }
      } else {
        const single = data as Conversation;
        if (single && Array.isArray(single.chat_messages)) {
          for (const msg of single.chat_messages as unknown[]) {
            if (isHumanMessage(msg)) {
              prompts.push((msg as { text: string }).text);
              if (prompts.length >= maxPrompts) return;
            }
          }
        } else {
          // Not a recognized structure; skip
          console.debug('[PromptExtractor] Skipping unrecognized structure in', fileLabel);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Parse error ${fileLabel}: ${errorMsg}`);
    }
  }

  if (sourceType === 'local') {
    const dirPath = dataSource?.path || directory!;
    console.debug('[PromptExtractor] Reading local directory:', dirPath);
    try {
      const dirents = await fsPromises.readdir(dirPath);
      const files = dirents.filter((f) => f.endsWith(filePattern));
      for (const file of files) {
        if (prompts.length >= maxPrompts) break;
        const filePath = path.join(dirPath, file);
        try {
          const content = await fsPromises.readFile(filePath, 'utf-8');
          await processFileContent(content, file);
          filesProcessed++;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          errors.push(`Error reading ${file}: ${errorMsg}`);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Directory read error: ${errorMsg}`);
    }
  } else if (sourceType === 'supabase') {
    // Use Supabase storage to list and download files
    const bucket = dataSource?.bucket;
    const prefix = dataSource?.prefix || '';
    console.debug('[PromptExtractor] Using Supabase storage:', bucket, prefix);

    if (!bucket) {
      const msg = 'Supabase dataSource requires a bucket name';
      console.error('[PromptExtractor] ERROR:', msg);
      errors.push(msg);
    } else {
      try {
        // Dynamically import supabase client to avoid a hard dependency at top-level
        const supabaseModule = await import('@supabase/supabase-js');
        const createClient = supabaseModule.createClient as (url: string, key: string) => SupabaseClient;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
          const msg = 'Supabase env vars not configured';
          console.error('[PromptExtractor] ERROR:', msg);
          errors.push(msg);
        } else {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data: listData, error: listError } = await supabase.storage.from(bucket).list(prefix);
          if (listError) {
            errors.push(`Supabase list error: ${listError.message}`);
          } else if (Array.isArray(listData)) {
            const files = (listData as Array<{ name: string }>).map((f) => f.name).filter((n: string) => n.endsWith(filePattern));
            for (const fileName of files) {
              if (prompts.length >= maxPrompts) break;
              try {
                const { data: downloadData, error: downloadError } = await supabase.storage.from(bucket).download(path.posix.join(prefix, fileName));
                if (downloadError || !downloadData) {
                  errors.push(`Supabase download error ${fileName}: ${downloadError?.message || 'no data'}`);
                } else {
                  // downloadData may be a Blob (browser) or ReadableStream (node). Normalize to Buffer
                  const buffer = await (async () => {
                    // Blob-like
                    if (typeof (downloadData as Blob).arrayBuffer === 'function') {
                      const ab = await (downloadData as Blob).arrayBuffer();
                      return Buffer.from(ab);
                    }
                    // Node.js Readable stream / AsyncIterable
                    if (Symbol.asyncIterator in Object(downloadData)) {
                      const chunks: Buffer[] = [];
                      const iterable = downloadData as unknown as AsyncIterable<Uint8Array>;
                      for await (const chunk of iterable) {
                        chunks.push(Buffer.from(chunk));
                      }
                      return Buffer.concat(chunks);
                    }
                    // Fallback: attempt to convert to string
                    try {
                      return Buffer.from(String(downloadData));
                    } catch {
                      return Buffer.from('');
                    }
                  })();
                  const content = buffer.toString('utf-8');
                  await processFileContent(content, fileName);
                  filesProcessed++;
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                errors.push(`Supabase processing error ${fileName}: ${msg}`);
              }
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Supabase client error: ${msg}`);
      }
    }
  } else {
    errors.push(`Unsupported data source type: ${sourceType}`);
  }

  // Export if requested
  let exportPath: string | undefined;
  if (exportFormat && prompts.length > 0) {
    try {
      const outPath = exportFilePath || path.join(directory || process.cwd(), `extracted_prompts_${Date.now()}.${exportFormat}`);
      if (exportFormat === 'jsonl') {
        await fsPromises.writeFile(outPath, prompts.map((p) => JSON.stringify(p)).join('\n'), 'utf-8');
      } else if (exportFormat === 'txt') {
        await fsPromises.writeFile(outPath, prompts.join('\n'), 'utf-8');
      }
      exportPath = outPath;
      console.debug('[PromptExtractor] Exported prompts to', outPath);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Export error: ${errorMsg}`);
    }
  }

  return {
    prompts,
    total: prompts.length,
    filesProcessed,
    errors: errors.length > 0 ? errors : undefined,
    exportFilePath: exportPath,
    exportFormat,
  };
}

// Phase 2: Batch Execution

import type { BatchExecutionOptions, BatchExecutionResult, PromptResponse } from './types';

function validateEndpoint(endpoint: string): void {
  const localChatPatterns = [
    '/api/chat',
    'localhost:3000/api/chat',
    'localhost/api/chat',
    '127.0.0.1',
    '0.0.0.0',
  ];

  const normalizedEndpoint = endpoint.toLowerCase();
  const isLocalChat = localChatPatterns.some(pattern =>
    normalizedEndpoint.includes(pattern.toLowerCase())
  );

  if (isLocalChat) {
    throw new Error(
      '[prompt-pipeline] Cannot use /api/chat or local chat endpoints.\n' +
      'This would create duplicate database entries.\n\n' +
      'Use the "prompt-injector" tool for portal testing with user feedback.\n' +
      'Use the "prompt-pipeline" tool only with direct API testing.\n\n' +
      `Received endpoint: ${endpoint}`
    );
  }
}

export async function executeBatch(options: BatchExecutionOptions): Promise<BatchExecutionResult> {
  const {
    prompts,
    modelEndpoint,
    batchSize = 10,
    maxConcurrency = 5,
    requestOptions = {},
  } = options;

  // Validate endpoint to prevent duplicate entries
  validateEndpoint(modelEndpoint);

  console.debug('[PromptExtractor] Starting batch execution:', prompts.length, 'prompts');

  const responses: PromptResponse[] = [];
  const errors: string[] = [];
  const startTime = Date.now();

  // Process prompts in batches with controlled concurrency
  async function executePrompt(prompt: string, index: number): Promise<PromptResponse> {
    const promptStartTime = Date.now();
    try {
      const method = requestOptions.method || 'POST';
      const headers = requestOptions.headers || { 'Content-Type': 'application/json' };
      const timeout = requestOptions.timeout || 30000;

      // Build request body, allowing customization
      const body = requestOptions.body
        ? { ...requestOptions.body, prompt }
        : { prompt };

      console.debug(`[PromptExtractor] Executing prompt ${index + 1}/${prompts.length}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(modelEndpoint, {
        method,
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      const duration = Date.now() - promptStartTime;

      // Extract response text (handle common response formats)
      let responseText = '';
      if (typeof responseData === 'string') {
        responseText = responseData;
      } else if (responseData.response) {
        responseText = responseData.response;
      } else if (responseData.content) {
        responseText = responseData.content;
      } else if (responseData.text) {
        responseText = responseData.text;
      } else if (responseData.choices && responseData.choices[0]?.message?.content) {
        // OpenAI format
        responseText = responseData.choices[0].message.content;
      } else if (responseData.completion) {
        responseText = responseData.completion;
      } else {
        responseText = JSON.stringify(responseData);
      }

      return {
        prompt,
        response: responseText,
        timestamp: new Date().toISOString(),
        success: true,
        metadata: {
          duration_ms: duration,
          tokens_used: responseData.usage?.total_tokens,
        },
      };
    } catch (err) {
      const duration = Date.now() - promptStartTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[PromptExtractor] Error executing prompt ${index + 1}:`, errorMsg);
      errors.push(`Prompt ${index + 1}: ${errorMsg}`);

      return {
        prompt,
        response: '',
        timestamp: new Date().toISOString(),
        success: false,
        error: errorMsg,
        metadata: { duration_ms: duration },
      };
    }
  }

  // Process in batches with concurrency control
  for (let i = 0; i < prompts.length; i += batchSize) {
    const batch = prompts.slice(i, i + batchSize);
    console.debug(`[PromptExtractor] Processing batch ${Math.floor(i / batchSize) + 1}`);

    // Execute batch with concurrency limit
    for (let j = 0; j < batch.length; j += maxConcurrency) {
      const concurrentBatch = batch.slice(j, j + maxConcurrency);
      const concurrentPromises = concurrentBatch.map((prompt, idx) =>
        executePrompt(prompt, i + j + idx)
      );
      const results = await Promise.all(concurrentPromises);
      responses.push(...results);
    }
  }

  const totalDuration = Date.now() - startTime;
  const successful = responses.filter((r) => r.success).length;
  const failed = responses.filter((r) => !r.success).length;

  console.debug(
    `[PromptExtractor] Batch execution complete: ${successful} successful, ${failed} failed, ${totalDuration}ms total`
  );

  return {
    responses,
    total: responses.length,
    successful,
    failed,
    totalDurationMs: totalDuration,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Phase 2: Supabase Storage

import type { StorageOptions, StorageResult } from './types';

export async function storeResults(options: StorageOptions): Promise<StorageResult> {
  const { responses, supabaseTable, batchMetadata = {} } = options;

  console.debug('[PromptExtractor] Storing', responses.length, 'results in table:', supabaseTable);

  const errors: string[] = [];
  let stored = 0;
  let failed = 0;
  const insertedIds: string[] = [];

  try {
    // Dynamically import Supabase client
    const supabaseModule = await import('@supabase/supabase-js');
    const createClient = supabaseModule.createClient as (url: string, key: string) => SupabaseClient;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      const msg = 'Supabase env vars not configured';
      console.error('[PromptExtractor] ERROR:', msg);
      return { stored: 0, failed: responses.length, errors: [msg] };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Prepare records for insertion
    const records = responses.map((response) => ({
      prompt: response.prompt,
      response: response.response,
      model: response.model || batchMetadata.modelName || null,
      success: response.success,
      error: response.error || null,
      timestamp: response.timestamp,
      duration_ms: response.metadata?.duration_ms || null,
      tokens_used: response.metadata?.tokens_used || null,
      metadata: {
        ...batchMetadata,
        ...response.metadata,
      },
      experiment_name: batchMetadata.experimentName || null,
      tags: batchMetadata.tags || null,
    }));

    console.debug('[PromptExtractor] Inserting', records.length, 'records');

    // Insert in batches of 100 to avoid hitting Supabase limits
    const insertBatchSize = 100;
    for (let i = 0; i < records.length; i += insertBatchSize) {
      const batch = records.slice(i, i + insertBatchSize);
      try {
        const { data, error } = await supabase.from(supabaseTable).insert(batch).select('id');

        if (error) {
          console.error(`[PromptExtractor] Supabase insert error (batch ${i / insertBatchSize + 1}):`, error.message);
          errors.push(`Batch ${i / insertBatchSize + 1}: ${error.message}`);
          failed += batch.length;
        } else {
          stored += batch.length;
          if (data && Array.isArray(data)) {
            insertedIds.push(...data.map((row: { id: string }) => row.id));
          }
          console.debug(`[PromptExtractor] Successfully stored batch ${i / insertBatchSize + 1}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[PromptExtractor] Insert error (batch ${i / insertBatchSize + 1}):`, msg);
        errors.push(`Batch ${i / insertBatchSize + 1}: ${msg}`);
        failed += batch.length;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PromptExtractor] Storage error:', msg);
    errors.push(`Storage initialization error: ${msg}`);
    return { stored: 0, failed: responses.length, errors: [msg] };
  }

  console.debug(`[PromptExtractor] Storage complete: ${stored} stored, ${failed} failed`);

  return {
    stored,
    failed,
    errors: errors.length > 0 ? errors : undefined,
    insertedIds: insertedIds.length > 0 ? insertedIds : undefined,
  };
}
