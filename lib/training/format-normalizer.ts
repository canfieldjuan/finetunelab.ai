// Format Normalizer for Training Datasets
// Converts all dataset formats to standard messages format
// Date: 2025-11-01

import { DatasetFormat } from './format-detector';

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
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
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
  if ('messages' in example && Array.isArray(example.messages)) {
    console.log('[FormatNormalizer] Example already in messages format');
    return example as unknown as NormalizedExample;
  }

  // ShareGPT format: {system: "...", conversations: [...]}
  if ('conversations' in example && Array.isArray(example.conversations)) {
    console.log('[FormatNormalizer] Converting ShareGPT format');
    const messages: NormalizedExample['messages'] = [];

    // Add system message if present
    if ('system' in example && typeof example.system === 'string') {
      messages.push({
        role: 'system',
        content: example.system
      });
    }

    // Convert conversations
    for (const conv of example.conversations) {
      // Handle {from: ..., value: ...} format
      if ('from' in conv && 'value' in conv) {
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
      else if ('role' in conv && 'content' in conv) {
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
  if (Array.isArray(example) && example.length > 0 && 'role' in example[0]) {
    console.log('[FormatNormalizer] Converting ChatML array format');
    const messages: NormalizedExample['messages'] = [];

    for (const msg of example) {
      if (!('role' in msg) || !('content' in msg)) {
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
  if ('text' in example && typeof example.text === 'string') {
    console.log('[FormatNormalizer] Converting standard text format');

    // Keep as-is for standard format
    // Validation will handle this differently
    return null;
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
