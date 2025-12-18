// Dataset Format Validator
// Validates and analyzes training datasets
// Date: 2025-10-16
// Updated: 2025-11-01 - Integrated format detection and normalization

import { detectDatasetFormat } from './format-detector';
import { normalizeDatasetFormat, type NormalizedDataset } from './format-normalizer';
import type {
  DatasetFormat,
  ChatMLConversation,
  ShareGPTConversation,
  DPOExample,
  RLHFExample,
  AlpacaExample,
  OpenOrcaExample,
  UnnaturalInstructionsExample,
  DatasetStats,
} from './dataset.types';

// Type alias for conversation messages
type ConversationMessage = {
  from: string;
  value: string;
};

export interface ValidationResult {
  valid: boolean;
  stats?: DatasetStats;
  errors?: string[];
  normalized?: NormalizedDataset;
  detectedFormat?: string;
}

export class DatasetValidator {
  /**
   * NEW: Validate with automatic format detection and normalization
   * This is the recommended method for all dataset uploads
   *
   * @param file - Dataset file to validate
   * @param expectedFormat - Optional expected format (used to override detection for special cases like CPT)
   */
  async validateWithNormalization(
    file: File,
    expectedFormat?: DatasetFormat
  ): Promise<ValidationResult> {
    try {
      console.log('[DatasetValidator] Starting validation with normalization');
      console.log('[DatasetValidator] File name:', file.name);
      console.log('[DatasetValidator] File size:', file.size, 'bytes');
      
      const content = await file.text();
      console.log('[DatasetValidator] Content length:', content.length, 'bytes');
      console.log('[DatasetValidator] First 200 chars:', content.substring(0, 200));

      // Step 1: Detect format
      const detectionResult = detectDatasetFormat(content);
      console.log('[DatasetValidator] Detected format:', detectionResult.format);
      console.log('[DatasetValidator] Confidence:', detectionResult.confidence);
      console.log('[DatasetValidator] Details:', JSON.stringify(detectionResult.details));
      console.log('[DatasetValidator] Expected format:', expectedFormat || 'none');

      if (detectionResult.confidence === 'low') {
        console.warn('[DatasetValidator] Low confidence detection');
      }

      // Override detection for raw_text/CPT if user explicitly selected it
      let formatToUse = detectionResult.format;
      if (expectedFormat === 'raw_text' && detectionResult.format === 'standard-text') {
        console.log('[DatasetValidator] User selected raw_text format, using standard-text detection');
        formatToUse = 'standard-text';
      }

      // Step 2: Normalize format
      let normalized: NormalizedDataset;
      try {
        normalized = normalizeDatasetFormat(content, formatToUse);
        console.log('[DatasetValidator] Normalization complete');
        console.log('[DatasetValidator] Converted:', normalized.stats.convertedCount, '/', normalized.stats.totalExamples);
      } catch (error) {
        console.error('[DatasetValidator] Normalization failed:', error);
        return {
          valid: false,
          errors: [`Normalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
          detectedFormat: formatToUse
        };
      }

      // Hard fail: uploading a dataset that normalizes to 0 examples is almost always user error
      // (wrong format selection, unsupported file type like CSV/Parquet, or missing required fields).
      if (normalized.stats.convertedCount === 0) {
        const errors: string[] = [];

        errors.push(
          `No valid training examples could be extracted after normalization (converted 0/${normalized.stats.totalExamples}). ` +
          `This usually means the dataset format doesn't match the content or required fields are missing.`
        );

        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (ext === '.csv' || ext === '.parquet' || ext === '.txt') {
          errors.push(
            `File extension ${ext} is not reliably supported for training dataset ingestion. ` +
            `Convert to .jsonl or .json in a supported schema (ChatML/ShareGPT/Alpaca/DPO/RLHF/etc.).`
          );
        }

        if (detectionResult.format === 'standard-text') {
          errors.push(
            `Detected standard text format ("text" field). ` +
            `For Continued Pre-Training (CPT), select "Raw Text" format during upload. ` +
            `For supervised fine-tuning, convert to ChatML (messages) or an instruction format (instruction/input/output).`
          );
        }

        if (normalized.stats.errors.length > 0) {
          // Include the normalizer errors for debugging (capped to avoid huge responses)
          errors.push(...normalized.stats.errors.slice(0, 25));
          if (normalized.stats.errors.length > 25) {
            errors.push(`...and ${normalized.stats.errors.length - 25} more normalization errors`);
          }
        }

        return {
          valid: false,
          errors,
          normalized,
          detectedFormat: detectionResult.format
        };
      }

      // Step 3: Calculate stats
      const stats: DatasetStats = {
        total_examples: normalized.stats.convertedCount,
        avg_input_length: 0,
        avg_output_length: 0,
        format: detectionResult.format as DatasetFormat
      };

      // Calculate average lengths from normalized data
      let totalInputLen = 0;
      let totalOutputLen = 0;

      for (const example of normalized.data) {
        if ('messages' in example && Array.isArray(example.messages)) {
          const userMsgs = example.messages.filter(m => m.role === 'user');
          const assistantMsgs = example.messages.filter(m => m.role === 'assistant');

          totalInputLen += userMsgs.reduce((sum, m) => sum + m.content.length, 0);
          totalOutputLen += assistantMsgs.reduce((sum, m) => sum + m.content.length, 0);
        } else if ('text' in example && typeof example.text === 'string') {
          // For CPT/raw text, treat the entire text as "input"
          // (no separation between input/output since it's unsupervised pretraining)
          totalInputLen += example.text.length;
          totalOutputLen += 0; // Raw text has no output
        }
      }

      if (normalized.stats.convertedCount > 0) {
        stats.avg_input_length = totalInputLen / normalized.stats.convertedCount;
        stats.avg_output_length = totalOutputLen / normalized.stats.convertedCount;
      }

      console.log('[DatasetValidator] Validation successful');
      
      return {
        valid: true,
        stats,
        normalized,
        detectedFormat: detectionResult.format,
        errors: normalized.stats.errors.length > 0 ? normalized.stats.errors : undefined
      };

    } catch (error) {
      console.error('[DatasetValidator] Validation error:', error);
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * LEGACY: Original validate method (kept for backwards compatibility)
   * Prefer using validateWithNormalization instead
   */
  async validate(
    file: File,
    format: DatasetFormat
  ): Promise<{ valid: boolean; stats?: DatasetStats; errors?: string[] }> {
    try {
      const content = await file.text();
      const lines = content.trim().split('\n');

      switch (format) {
        case 'chatml':
          return this.validateChatML(lines);
        case 'sharegpt':
          return this.validateShareGPT(lines);
        case 'jsonl':
          return this.validateJSONL(lines);
        case 'dpo':
          return this.validateDPO(lines);
        case 'rlhf':
          return this.validateRLHF(lines);
        case 'alpaca':
          return this.validateAlpaca(lines);
        case 'openorca':
          return this.validateOpenOrca(lines);
        case 'unnatural':
          return this.validateUnnaturalInstructions(lines);
        default:
          return { valid: false, errors: [`Unsupported format: ${format}`] };
      }
    } catch (error) {
      console.error('[DatasetValidator] Validation error:', error);
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  private validateChatML(lines: string[]): {
    valid: boolean;
    stats?: DatasetStats;
    errors?: string[];
  } {
    const errors: string[] = [];
    let totalInputLen = 0;
    let totalOutputLen = 0;
    let validExamples = 0;

    for (let i = 0; i < lines.length; i++) {
      try {
        const conversation: ChatMLConversation = JSON.parse(lines[i]);
        if (!Array.isArray(conversation)) {
          errors.push(`Line ${i + 1}: Expected array of messages`);
          continue;
        }

        for (const msg of conversation) {
          if (!msg.role || !msg.content) {
            errors.push(`Line ${i + 1}: Missing role or content`);
          }
        }

        const userMsgs = conversation.filter((m) => m.role === 'user');
        const assistantMsgs = conversation.filter((m) => m.role === 'assistant');

        totalInputLen += userMsgs.reduce((sum, m) => sum + m.content.length, 0);
        totalOutputLen += assistantMsgs.reduce((sum, m) => sum + m.content.length, 0);
        validExamples++;
      } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        errors.push(`Line ${i + 1}: Invalid JSON`);
      }
    }

    if (validExamples === 0) return { valid: false, errors };

    return {
      valid: true,
      stats: {
        total_examples: validExamples,
        avg_input_length: totalInputLen / validExamples,
        avg_output_length: totalOutputLen / validExamples,
        format: 'chatml',
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private validateShareGPT(lines: string[]): {
    valid: boolean;
    stats?: DatasetStats;
    errors?: string[];
  } {
    const errors: string[] = [];
    let totalInputLen = 0;
    let totalOutputLen = 0;
    let validExamples = 0;

    // Try to parse as single JSON object with examples array first
    try {
      const fullContent = lines.join('\n');
      const parsed = JSON.parse(fullContent);
      
      console.log('[DatasetValidator] Parsed JSON structure:', {
        hasExamples: !!parsed.examples,
        isArray: Array.isArray(parsed.examples),
        exampleCount: parsed.examples?.length,
        firstExample: parsed.examples?.[0]
      });
      
      // Check if it has an examples array (common format)
      if (parsed.examples && Array.isArray(parsed.examples)) {
        console.log('[DatasetValidator] Detected single JSON with examples array format');
        
        for (let i = 0; i < parsed.examples.length; i++) {
          const conversation = parsed.examples[i];
          if (!conversation.conversations || !Array.isArray(conversation.conversations)) {
            const errorMsg = `Example ${i + 1}: Missing conversations array. Has: ${Object.keys(conversation).join(', ')}`;
            console.error('[DatasetValidator]', errorMsg);
            errors.push(errorMsg);
            continue;
          }

          const humanMsgs = conversation.conversations.filter((t: ConversationMessage) => t.from === 'human' || t.from === 'user');
          const gptMsgs = conversation.conversations.filter((t: ConversationMessage) => t.from === 'gpt' || t.from === 'assistant');

          totalInputLen += humanMsgs.reduce((sum: number, t: ConversationMessage) => sum + t.value.length, 0);
          totalOutputLen += gptMsgs.reduce((sum: number, t: ConversationMessage) => sum + t.value.length, 0);
          validExamples++;
        }

        if (validExamples === 0) {
          console.error('[DatasetValidator] No valid examples found. Errors:', errors);
          return { valid: false, errors };
        }

        console.log('[DatasetValidator] Validation successful:', validExamples, 'examples');
        return {
          valid: true,
          stats: {
            total_examples: validExamples,
            avg_input_length: totalInputLen / validExamples,
            avg_output_length: totalOutputLen / validExamples,
            format: 'sharegpt',
          },
        };
      } else {
        console.log('[DatasetValidator] No examples array found, trying JSONL format');
      }
    } catch (e) {
      // If single JSON parse fails, fall through to JSONL parsing
      console.error('[DatasetValidator] Single JSON parse failed:', e);
      console.log('[DatasetValidator] Trying JSONL format instead');
    }

    // Original JSONL parsing (one JSON object per line)
    console.log('[DatasetValidator] Parsing as JSONL format');
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      
      try {
        const conversation: ShareGPTConversation = JSON.parse(lines[i]);
        if (!conversation.conversations || !Array.isArray(conversation.conversations)) {
          errors.push(`Line ${i + 1}: Missing conversations array`);
          continue;
        }

        const humanMsgs = conversation.conversations.filter((t: ConversationMessage) => t.from === 'human' || t.from === 'user');
        const gptMsgs = conversation.conversations.filter((t: ConversationMessage) => t.from === 'gpt' || t.from === 'assistant');

        totalInputLen += humanMsgs.reduce((sum, t) => sum + t.value.length, 0);
        totalOutputLen += gptMsgs.reduce((sum, t) => sum + t.value.length, 0);
        validExamples++;
      } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        errors.push(`Line ${i + 1}: Invalid JSON`);
      }
    }

    if (validExamples === 0) return { valid: false, errors };

    return {
      valid: true,
      stats: {
        total_examples: validExamples,
        avg_input_length: totalInputLen / validExamples,
        avg_output_length: totalOutputLen / validExamples,
        format: 'sharegpt',
      },
    };
  }

  private validateJSONL(lines: string[]): {
    valid: boolean;
    stats?: DatasetStats;
    errors?: string[];
  } {
    const errors: string[] = [];
    let validExamples = 0;

    for (let i = 0; i < lines.length; i++) {
      try {
        JSON.parse(lines[i]);
        validExamples++;
      } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        errors.push(`Line ${i + 1}: Invalid JSON`);
      }
    }

    if (validExamples === 0) return { valid: false, errors };

    return {
      valid: true,
      stats: {
        total_examples: validExamples,
        avg_input_length: 0,
        avg_output_length: 0,
        format: 'jsonl',
      },
    };
  }

  private validateDPO(lines: string[]): {
    valid: boolean;
    stats?: DatasetStats;
    errors?: string[];
  } {
    const errors: string[] = [];
    let totalPromptLen = 0;
    let totalChosenLen = 0;
    let totalRejectedLen = 0;
    let validExamples = 0;

    for (let i = 0; i < lines.length; i++) {
      try {
        const example: DPOExample = JSON.parse(lines[i]);

        if (!example.prompt || typeof example.prompt !== 'string') {
          errors.push(`Line ${i + 1}: Missing or invalid prompt`);
          continue;
        }
        if (!example.chosen || typeof example.chosen !== 'string') {
          errors.push(`Line ${i + 1}: Missing or invalid chosen response`);
          continue;
        }
        if (!example.rejected || typeof example.rejected !== 'string') {
          errors.push(`Line ${i + 1}: Missing or invalid rejected response`);
          continue;
        }

        totalPromptLen += example.prompt.length;
        totalChosenLen += example.chosen.length;
        totalRejectedLen += example.rejected.length;
        validExamples++;
      } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        errors.push(`Line ${i + 1}: Invalid JSON`);
      }
    }

    if (validExamples === 0) return { valid: false, errors };

    return {
      valid: true,
      stats: {
        total_examples: validExamples,
        avg_input_length: totalPromptLen / validExamples,
        avg_output_length: (totalChosenLen + totalRejectedLen) / (2 * validExamples),
        format: 'dpo',
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private validateRLHF(lines: string[]): {
    valid: boolean;
    stats?: DatasetStats;
    errors?: string[];
  } {
    const errors: string[] = [];
    let totalPromptLen = 0;
    let totalResponseLen = 0;
    let validExamples = 0;

    for (let i = 0; i < lines.length; i++) {
      try {
        const example: RLHFExample = JSON.parse(lines[i]);

        if (!example.prompt || typeof example.prompt !== 'string') {
          errors.push(`Line ${i + 1}: Missing or invalid prompt`);
          continue;
        }
        if (!example.response || typeof example.response !== 'string') {
          errors.push(`Line ${i + 1}: Missing or invalid response`);
          continue;
        }
        if (example.reward !== undefined && typeof example.reward !== 'number') {
          errors.push(`Line ${i + 1}: reward must be a number if provided`);
          continue;
        }

        totalPromptLen += example.prompt.length;
        totalResponseLen += example.response.length;
        validExamples++;
      } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        errors.push(`Line ${i + 1}: Invalid JSON`);
      }
    }

    if (validExamples === 0) return { valid: false, errors };

    return {
      valid: true,
      stats: {
        total_examples: validExamples,
        avg_input_length: totalPromptLen / validExamples,
        avg_output_length: totalResponseLen / validExamples,
        format: 'rlhf',
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private validateAlpaca(lines: string[]): {
    valid: boolean;
    stats?: DatasetStats;
    errors?: string[];
  } {
    const errors: string[] = [];
    let totalInstructionLen = 0;
    let totalInputLen = 0;
    let totalOutputLen = 0;
    let validExamples = 0;

    for (let i = 0; i < lines.length; i++) {
      try {
        const example: AlpacaExample = JSON.parse(lines[i]);

        if (!example.instruction || typeof example.instruction !== 'string') {
          errors.push(`Line ${i + 1}: Missing or invalid instruction`);
          continue;
        }
        if (!example.output || typeof example.output !== 'string') {
          errors.push(`Line ${i + 1}: Missing or invalid output`);
          continue;
        }
        if (example.input !== undefined && typeof example.input !== 'string') {
          errors.push(`Line ${i + 1}: input must be a string if provided`);
          continue;
        }

        totalInstructionLen += example.instruction.length;
        totalInputLen += (example.input || '').length;
        totalOutputLen += example.output.length;
        validExamples++;
      } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        errors.push(`Line ${i + 1}: Invalid JSON`);
      }
    }

    if (validExamples === 0) return { valid: false, errors };

    return {
      valid: true,
      stats: {
        total_examples: validExamples,
        avg_input_length: (totalInstructionLen + totalInputLen) / validExamples,
        avg_output_length: totalOutputLen / validExamples,
        format: 'alpaca',
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private validateOpenOrca(lines: string[]): {
    valid: boolean;
    stats?: DatasetStats;
    errors?: string[];
  } {
    const errors: string[] = [];
    let totalSystemLen = 0;
    let totalQuestionLen = 0;
    let totalResponseLen = 0;
    let validExamples = 0;

    for (let i = 0; i < lines.length; i++) {
      try {
        const example: OpenOrcaExample = JSON.parse(lines[i]);

        if (!example.system_prompt || typeof example.system_prompt !== 'string') {
          errors.push(`Line ${i + 1}: Missing or invalid system_prompt`);
          continue;
        }
        if (!example.question || typeof example.question !== 'string') {
          errors.push(`Line ${i + 1}: Missing or invalid question`);
          continue;
        }
        if (!example.response || typeof example.response !== 'string') {
          errors.push(`Line ${i + 1}: Missing or invalid response`);
          continue;
        }

        totalSystemLen += example.system_prompt.length;
        totalQuestionLen += example.question.length;
        totalResponseLen += example.response.length;
        validExamples++;
      } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        errors.push(`Line ${i + 1}: Invalid JSON`);
      }
    }

    if (validExamples === 0) return { valid: false, errors };

    return {
      valid: true,
      stats: {
        total_examples: validExamples,
        avg_input_length: (totalSystemLen + totalQuestionLen) / validExamples,
        avg_output_length: totalResponseLen / validExamples,
        format: 'openorca',
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private validateUnnaturalInstructions(lines: string[]): {
    valid: boolean;
    stats?: DatasetStats;
    errors?: string[];
  } {
    const errors: string[] = [];
    let totalInstructionLen = 0;
    let totalInputLen = 0;
    let totalOutputLen = 0;
    let validExamples = 0;

    for (let i = 0; i < lines.length; i++) {
      try {
        const example: UnnaturalInstructionsExample = JSON.parse(lines[i]);

        if (!example.instruction || typeof example.instruction !== 'string') {
          errors.push(`Line ${i + 1}: Missing or invalid instruction`);
          continue;
        }
        if (!example.instances || !Array.isArray(example.instances)) {
          errors.push(`Line ${i + 1}: Missing or invalid instances array`);
          continue;
        }

        totalInstructionLen += example.instruction.length;

        for (const instance of example.instances) {
          if (!instance.input || typeof instance.input !== 'string') {
            errors.push(`Line ${i + 1}: Instance missing or invalid input`);
            continue;
          }
          if (!instance.output || typeof instance.output !== 'string') {
            errors.push(`Line ${i + 1}: Instance missing or invalid output`);
            continue;
          }

          totalInputLen += instance.input.length;
          totalOutputLen += instance.output.length;
          validExamples++;
        }
      } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        errors.push(`Line ${i + 1}: Invalid JSON`);
      }
    }

    if (validExamples === 0) return { valid: false, errors };

    return {
      valid: true,
      stats: {
        total_examples: validExamples,
        avg_input_length: (totalInstructionLen + totalInputLen) / validExamples,
        avg_output_length: totalOutputLen / validExamples,
        format: 'unnatural',
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

export const datasetValidator = new DatasetValidator();
console.log('[DatasetValidator] Dataset validator loaded');
