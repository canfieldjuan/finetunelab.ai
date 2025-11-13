// HuggingFace Inference API Adapter
// Date: October 18, 2025

import type { BatchTestConfig, BatchTestResult } from './types';

const HF_API_BASE = 'https://api-inference.huggingface.co/models';

/**
 * Test HuggingFace API connection
 * @param apiKey - HuggingFace API key
 * @returns True if connection successful
 */
export async function testConnection(apiKey: string): Promise<boolean> {
  try {
    console.log('[HF Adapter] Testing connection to HuggingFace API');

    const response = await fetch(`${HF_API_BASE}/gpt2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: 'test' }),
    });

    const isValid = response.ok || response.status === 503;
    console.log('[HF Adapter] Connection test result:', {
      status: response.status,
      valid: isValid
    });

    return isValid;
  } catch (error) {
    console.error('[HF Adapter] Connection test failed:', error);
    return false;
  }
}

/**
 * Send single prompt to HuggingFace model with retry logic
 * @param model - Model name (e.g., "Qwen/Qwen3-0.6B")
 * @param prompt - Prompt text
 * @param apiKey - HuggingFace API key
 * @param retries - Number of retry attempts (default: 3)
 * @returns Response text and latency
 */
export async function sendPrompt(
  model: string,
  prompt: string,
  apiKey: string,
  retries: number = 3
): Promise<{ response: string; latency_ms: number }> {
  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[HF Adapter] Sending prompt to ${model} (attempt ${attempt}/${retries})`);

      const response = await fetch(`${HF_API_BASE}/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: prompt }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HF API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const latency_ms = Date.now() - startTime;

      let responseText = '';
      if (Array.isArray(data) && data.length > 0) {
        responseText = data[0].generated_text || '';
      } else if (data.generated_text) {
        responseText = data.generated_text;
      } else {
        responseText = JSON.stringify(data);
      }

      console.log(`[HF Adapter] Success:`, { latency_ms, responseLength: responseText.length });
      return { response: responseText, latency_ms };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[HF Adapter] Attempt ${attempt} failed:`, lastError.message);

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error('Failed to send prompt after all retries');
}

/**
 * Send batch of prompts with rate limiting and progress tracking
 * @param model - Model name
 * @param prompts - Array of prompts to send
 * @param config - Batch test configuration
 * @param onProgress - Progress callback (completed, total)
 * @returns Array of batch test results
 */
export async function sendBatch(
  model: string,
  prompts: string[],
  config: BatchTestConfig,
  onProgress?: (completed: number, total: number) => void
): Promise<BatchTestResult[]> {
  console.log(`[HF Adapter] Starting batch of ${prompts.length} prompts`);
  console.log(`[HF Adapter] Config:`, {
    model,
    concurrency: config.concurrency,
    delay_ms: config.delay_ms
  });

  const results: BatchTestResult[] = [];
  const apiKey = config.huggingface_api_key || process.env.HUGGINGFACE_API_KEY || '';

  if (!apiKey) {
    throw new Error('HuggingFace API key is required');
  }

  let completed = 0;

  for (let i = 0; i < prompts.length; i += config.concurrency) {
    const batch = prompts.slice(i, i + config.concurrency);
    console.log(`[HF Adapter] Processing batch ${Math.floor(i / config.concurrency) + 1}`);

    const batchPromises = batch.map(async (prompt, batchIndex) => {
      const globalIndex = i + batchIndex;
      try {
        const { response, latency_ms } = await sendPrompt(model, prompt, apiKey);

        const result: BatchTestResult = {
          test_run_id: '',
          prompt,
          response,
          conversation_id: '',
          latency_ms,
          success: true,
        };

        completed++;
        if (onProgress) {
          onProgress(completed, prompts.length);
        }

        return result;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[HF Adapter] Failed prompt ${globalIndex}:`, errMsg);

        const result: BatchTestResult = {
          test_run_id: '',
          prompt,
          response: '',
          conversation_id: '',
          latency_ms: 0,
          success: false,
          error: errMsg,
        };

        completed++;
        if (onProgress) {
          onProgress(completed, prompts.length);
        }

        return result;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    if (i + config.concurrency < prompts.length && config.delay_ms > 0) {
      console.log(`[HF Adapter] Delaying ${config.delay_ms}ms before next batch`);
      await new Promise(resolve => setTimeout(resolve, config.delay_ms));
    }
  }

  console.log(`[HF Adapter] Batch complete:`, {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  });

  return results;
}
