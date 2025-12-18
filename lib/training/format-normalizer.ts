// Format Normalizer for Training Datasets
// Converts all dataset formats to standard messages format
// Date: 2025-11-01

import { DatasetFormat } from './format-detector';
import { DATASET_FIELDS } from './dataset.types';

export interface NormalizedDataset {
  data: NormalizedExample[]; // Array of normalized examples
  originalFormat: DatasetFormat;
  stats: {
    totalExamples: number;
    convertedCount: number;
    errors: string[];
  };
}

export interface NormalizedExample {
  messages?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  // DPO/ORPO format - preserve for preference-based training
  prompt?: string;
  chosen?: string;
  rejected?: string;
  // RLHF format
  response?: string;
  reward?: number;
  // CPT/raw text format - preserve raw text
  text?: string;
  // Preserve metadata
  metadata?: Record<string, unknown>;
}

/**
 * Normalize dataset to standard messages format
 */
export function normalizeDatasetFormat(
  content: string,
  detectedFormat: DatasetFormat
): NormalizedDataset {
  console.log('[FormatNormalizer] Starting normalization');
  console.log('[FormatNormalizer] Format:', detectedFormat);

  const stats = {
    totalExamples: 0,
    convertedCount: 0,
    errors: [] as string[]
  };

  try {
    let examples: Array<Record<string, unknown>> = [];

    // Parse based on format
    if (detectedFormat === 'sharegpt-examples') {
      const parsed = JSON.parse(content);
      examples = parsed.examples || [];
      console.log('[FormatNormalizer] Extracted', examples.length, 'examples from examples array');
    } else if (detectedFormat.includes('jsonl') || content.includes('\n')) {
      const lines = content.trim().split('\n').filter(l => l.trim());
      examples = lines.map((line, idx) => {
        try {
          return JSON.parse(line);
        } catch {
          stats.errors.push(`Line ${idx + 1}: Invalid JSON`);
          return null;
        }
      }).filter(ex => ex !== null);
      console.log('[FormatNormalizer] Parsed', examples.length, 'examples from JSONL');
    } else {
      const parsed = JSON.parse(content);
      examples = Array.isArray(parsed) ? parsed : [parsed];
      console.log('[FormatNormalizer] Parsed', examples.length, 'examples from JSON');
    }

    stats.totalExamples = examples.length;

    // Normalize each example
    const normalized: NormalizedExample[] = [];
    
    for (let i = 0; i < examples.length; i++) {
      try {
        const example = examples[i];
        const normalizedExample = normalizeExample(example);
        
        if (normalizedExample) {
          normalized.push(normalizedExample);
          stats.convertedCount++;
        } else {
          stats.errors.push(`Example ${i + 1}: Could not normalize`);
        }
      } catch (e) {
        stats.errors.push(`Example ${i + 1}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    console.log('[FormatNormalizer] Normalization complete');
    console.log('[FormatNormalizer] Converted:', stats.convertedCount, '/', stats.totalExamples);
    if (stats.errors.length > 0) {
      console.warn('[FormatNormalizer] Errors:', stats.errors.length);
    }

    return {
      data: normalized,
      originalFormat: detectedFormat,
      stats
    };

  } catch (e) {
    console.error('[FormatNormalizer] Fatal error:', e);
    throw new Error(`Normalization failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

/**
 * Normalize a single example to messages format
 */
function normalizeExample(
  example: Record<string, unknown>
): NormalizedExample | null {
  // Already in messages format
  if (DATASET_FIELDS.MESSAGES in example && Array.isArray(example.messages)) {
    console.log('[FormatNormalizer] Example already in messages format');
    return example as unknown as NormalizedExample;
  }

  // ShareGPT format: {system: "...", conversations: [...]}
  if (DATASET_FIELDS.CONVERSATIONS in example && Array.isArray(example.conversations)) {
    console.log('[FormatNormalizer] Converting ShareGPT format');
    const messages: NormalizedExample['messages'] = [];

    // Add system message if present
    if (DATASET_FIELDS.SYSTEM in example && typeof example.system === 'string') {
      messages.push({
        role: 'system',
        content: example.system
      });
    }

    // Convert conversations
    for (const conv of example.conversations) {
      // Handle {from: ..., value: ...} format
      if (DATASET_FIELDS.FROM in conv && DATASET_FIELDS.VALUE in conv) {
        let role = conv.from;

        // Map human/gpt to user/assistant
        if (role === 'human') role = 'user';
        if (role === 'gpt') role = 'assistant';

        // Validate role
        if (!['system', 'user', 'assistant'].includes(role)) {
          console.warn('[FormatNormalizer] Invalid role:', role, '- skipping');
          continue;
        }

        messages.push({
          role: role as 'system' | 'user' | 'assistant',
          content: conv.value
        });
      }
      // Handle {role: ..., content: ...} format
      else if (DATASET_FIELDS.ROLE in conv && DATASET_FIELDS.CONTENT in conv) {
        let role = conv.role;

        // Map human/gpt to user/assistant
        if (role === 'human') role = 'user';
        if (role === 'gpt') role = 'assistant';

        // Validate role
        if (!['system', 'user', 'assistant'].includes(role)) {
          console.warn('[FormatNormalizer] Invalid role:', role, '- skipping');
          continue;
        }

        messages.push({
          role: role as 'system' | 'user' | 'assistant',
          content: conv.content
        });
      }
    }

    if (messages.length === 0) {
      console.warn('[FormatNormalizer] No valid messages in conversations');
      return null;
    }

    return { messages };
  }

  // ChatML format: [{role: ..., content: ...}]
  if (Array.isArray(example) && example.length > 0 && DATASET_FIELDS.ROLE in example[0]) {
    console.log('[FormatNormalizer] Converting ChatML array format');
    const messages: NormalizedExample['messages'] = [];

    for (const msg of example) {
      if (!(DATASET_FIELDS.ROLE in msg) || !(DATASET_FIELDS.CONTENT in msg)) {
        console.warn('[FormatNormalizer] Invalid ChatML message - skipping');
        continue;
      }

      let role = msg.role;

      // Map human/gpt to user/assistant
      if (role === 'human') role = 'user';
      if (role === 'gpt') role = 'assistant';

      // Validate role
      if (!['system', 'user', 'assistant'].includes(role)) {
        console.warn('[FormatNormalizer] Invalid role:', role, '- skipping');
        continue;
      }

      messages.push({
        role: role as 'system' | 'user' | 'assistant',
        content: msg.content
      });
    }

    if (messages.length === 0) {
      console.warn('[FormatNormalizer] No valid messages in ChatML array');
      return null;
    }

    return { messages };
  }

  // Standard text format: {text: "..."}
  // Used for Continued Pre-Training (CPT) - raw text without structure
  if (DATASET_FIELDS.TEXT in example && typeof example.text === 'string') {
    console.log('[FormatNormalizer] Converting standard text format (CPT/raw text)');

    // Return text as-is (no conversion to messages format)
    return {
      text: example.text
    } as unknown as NormalizedExample;
  }

  // Unnatural Instructions format: {instruction: "...", instances: [{input: "...", output: "..."}]}
  // Check this BEFORE Alpaca since both have instruction field
  if (DATASET_FIELDS.INSTRUCTION in example && DATASET_FIELDS.INSTANCES in example && Array.isArray(example.instances)) {
    console.log('[FormatNormalizer] Converting Unnatural Instructions format');

    if (example.instances.length === 0) {
      console.warn('[FormatNormalizer] Unnatural format has empty instances array');
      return null;
    }

    const firstInstance = example.instances[0];
    if (typeof firstInstance !== 'object' || !firstInstance) {
      console.warn('[FormatNormalizer] Unnatural format invalid instance');
      return null;
    }

    const messages: NormalizedExample['messages'] = [];
    const instanceInput = firstInstance.input || '';
    const instanceOutput = firstInstance.output;

    if (typeof example.instruction === 'string') {
      const userContent = typeof instanceInput === 'string' && instanceInput.trim()
        ? `${example.instruction}\n\n${instanceInput}`
        : example.instruction;

      messages.push({
        role: 'user',
        content: userContent
      });
    }

    if (typeof instanceOutput === 'string' && instanceOutput.trim()) {
      messages.push({
        role: 'assistant',
        content: instanceOutput
      });
    }

    if (messages.length < 2) {
      console.warn('[FormatNormalizer] Unnatural format missing required fields');
      return null;
    }

    return { messages };
  }

  // Alpaca format: {instruction: "...", input: "...", output: "..."}
  // Also handles Dolly variant: {instruction: "...", context: "...", response: "..."}
  if (DATASET_FIELDS.INSTRUCTION in example && typeof example.instruction === 'string') {
    console.log('[FormatNormalizer] Converting Alpaca/Dolly format');
    const messages: NormalizedExample['messages'] = [];

    const userInput = example.input || example.context || '';
    const assistantOutput = example.output || example.response;

    if (typeof userInput === 'string' && userInput.trim()) {
      messages.push({
        role: 'user',
        content: `${example.instruction}\n\n${userInput}`
      });
    } else {
      messages.push({
        role: 'user',
        content: example.instruction
      });
    }

    if (typeof assistantOutput === 'string' && assistantOutput.trim()) {
      messages.push({
        role: 'assistant',
        content: assistantOutput
      });
    }

    if (messages.length < 2) {
      console.warn('[FormatNormalizer] Alpaca format missing output');
      return null;
    }

    return { messages };
  }

  // OpenOrca format: {system_prompt: "...", question: "...", response: "..."}
  if (DATASET_FIELDS.SYSTEM_PROMPT in example && DATASET_FIELDS.QUESTION in example && DATASET_FIELDS.RESPONSE in example) {
    console.log('[FormatNormalizer] Converting OpenOrca format');
    const messages: NormalizedExample['messages'] = [];

    if (typeof example.system_prompt === 'string' && example.system_prompt.trim()) {
      messages.push({
        role: 'system',
        content: example.system_prompt
      });
    }

    if (typeof example.question === 'string' && example.question.trim()) {
      messages.push({
        role: 'user',
        content: example.question
      });
    }

    if (typeof example.response === 'string' && example.response.trim()) {
      messages.push({
        role: 'assistant',
        content: example.response
      });
    }

    if (messages.length < 2) {
      console.warn('[FormatNormalizer] OpenOrca format missing required fields');
      return null;
    }

    return { messages };
  }

  // DPO format: {prompt: "...", chosen: "...", rejected: "..."}
  // PRESERVE original format for DPO/ORPO training - do NOT convert to messages
  if (DATASET_FIELDS.PROMPT in example && DATASET_FIELDS.CHOSEN in example && DATASET_FIELDS.REJECTED in example) {
    console.log('[FormatNormalizer] Detected DPO format - preserving original structure');

    if (typeof example.prompt !== 'string' || !example.prompt.trim()) {
      console.warn('[FormatNormalizer] DPO format missing prompt field');
      return null;
    }

    if (typeof example.chosen !== 'string' || !example.chosen.trim()) {
      console.warn('[FormatNormalizer] DPO format missing chosen field');
      return null;
    }

    if (typeof example.rejected !== 'string' || !example.rejected.trim()) {
      console.warn('[FormatNormalizer] DPO format missing rejected field');
      return null;
    }

    // Return DPO format as-is, preserving all fields including metadata
    const result: Record<string, unknown> = {
      prompt: example.prompt,
      chosen: example.chosen,
      rejected: example.rejected,
    };
    if (example.metadata) {
      result.metadata = example.metadata as Record<string, unknown>;
    }
    return result;
  }

  // RLHF format: {prompt: "...", response: "...", reward: ...}
  // PRESERVE original format for RLHF training - do NOT convert to messages
  if (DATASET_FIELDS.PROMPT in example && DATASET_FIELDS.RESPONSE in example) {
    console.log('[FormatNormalizer] Detected RLHF format - preserving original structure');

    if (typeof example.prompt !== 'string' || !example.prompt.trim()) {
      console.warn('[FormatNormalizer] RLHF format missing prompt field');
      return null;
    }

    if (typeof example.response !== 'string' || !example.response.trim()) {
      console.warn('[FormatNormalizer] RLHF format missing response field');
      return null;
    }

    // Return RLHF format as-is, preserving all fields including reward and metadata
    const result: Record<string, unknown> = {
      prompt: example.prompt,
      response: example.response,
    };
    if (typeof example.reward === 'number') {
      result.reward = example.reward;
    }
    if (example.metadata) {
      result.metadata = example.metadata as Record<string, unknown>;
    }
    return result;
  }

  // Unknown format
  console.warn('[FormatNormalizer] Unknown example format, keys:', Object.keys(example));
  return null;
}

/**
 * Convert normalized dataset back to JSONL string
 */
export function normalizedToJsonl(normalized: NormalizedExample[]): string {
  return normalized.map(ex => JSON.stringify(ex)).join('\n');
}

/**
 * Get recommended data.strategy based on normalized format
 */
export function getRecommendedStrategy(normalized: NormalizedExample[]): 'chat' | 'standard' {
  if (normalized.length === 0) {
    return 'standard'; // default
  }

  const firstExample = normalized[0];
  
  // If it has messages field, it's chat
  if ('messages' in firstExample) {
    return 'chat';
  }

  // If it has text field, it's standard
  if ('text' in firstExample) {
    return 'standard';
  }

  return 'chat'; // default for normalized data
}

console.log('[FormatNormalizer] Module loaded');
