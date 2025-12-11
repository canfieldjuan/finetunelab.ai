// Format Detector for Training Datasets
// Detects dataset format (ShareGPT, ChatML, Standard, etc.)
// Date: 2025-11-01
// Updated: Handle pretty-printed JSON (formatted with newlines)

import { DATASET_FIELDS } from './dataset.types';

export type DatasetFormat =
  | 'sharegpt'           // {"system": "...", "conversations": [...]}
  | 'sharegpt-examples'  // {"examples": [{"system": "...", "conversations": [...]}]}
  | 'chatml'             // [{"role": "...", "content": "..."}]
  | 'chatml-wrapped'     // {"messages": [{"role": "...", "content": "..."}]}
  | 'standard-text'      // {"text": "..."}
  | 'dpo'                // {"prompt": "...", "chosen": "...", "rejected": "..."}
  | 'rlhf'               // {"prompt": "...", "response": "...", "reward": ...}
  | 'alpaca'             // {"instruction": "...", "input": "...", "output": "..."}
  | 'openorca'           // {"system_prompt": "...", "question": "...", "response": "..."}
  | 'unnatural'          // {"instruction": "...", "instances": [{input: "...", output: "..."}]}
  | 'jsonl'              // One JSON per line
  | 'unknown';

export interface FormatDetectionResult {
  format: DatasetFormat;
  confidence: 'high' | 'medium' | 'low';
  details: {
    hasSystemField?: boolean;
    hasConversationsField?: boolean;
    hasMessagesField?: boolean;
    hasTextField?: boolean;
    hasExamplesArray?: boolean;
    conversationFormat?: 'from-value' | 'role-content';
    isMultiLine?: boolean;
    sampleKeys?: string[];
  };
}

/**
 * Detect the format of a dataset from its content
 */
export function detectDatasetFormat(content: string): FormatDetectionResult {
  console.log('[FormatDetector] Starting format detection');
  console.log('[FormatDetector] Content length:', content.length, 'bytes');

  try {
    // STRATEGY: Try single JSON first (handles pretty-printed JSON)
    // If that fails, try JSONL (one compact JSON per line)
    
    try {
      const parsed = JSON.parse(content);
      console.log('[FormatDetector] Successfully parsed as single JSON');
      return detectSingleJsonFormat(parsed);
    } catch {
      console.log('[FormatDetector] Not a single JSON, trying JSONL format');
    }

    // Try JSONL (one JSON object per line, NOT pretty-printed)
    const lines = content.trim().split('\n').filter(l => l.trim());
    
    if (lines.length > 1) {
      console.log('[FormatDetector] Detected multi-line format (JSONL)');
      console.log('[FormatDetector] Total lines:', lines.length);
      console.log('[FormatDetector] First line preview (100 chars):', lines[0].substring(0, 100));
      
      try {
        const firstLine = JSON.parse(lines[0]);
        const sampleKeys = Object.keys(firstLine);
        console.log('[FormatDetector] First line keys:', sampleKeys);

        if (DATASET_FIELDS.CONVERSATIONS in firstLine) {
          return {
            format: 'sharegpt',
            confidence: 'high',
            details: {
              hasSystemField: DATASET_FIELDS.SYSTEM in firstLine,
              hasConversationsField: true,
              isMultiLine: true,
              sampleKeys,
              conversationFormat: detectConversationFormat(firstLine.conversations as Array<Record<string, unknown>>)
            }
          };
        }

        if (DATASET_FIELDS.MESSAGES in firstLine) {
          return {
            format: 'chatml-wrapped',
            confidence: 'high',
            details: {
              hasMessagesField: true,
              isMultiLine: true,
              sampleKeys
            }
          };
        }

        if (DATASET_FIELDS.TEXT in firstLine) {
          return {
            format: 'standard-text',
            confidence: 'high',
            details: {
              hasTextField: true,
              isMultiLine: true,
              sampleKeys
            }
          };
        }

        // DPO format: {"prompt": "...", "chosen": "...", "rejected": "..."}
        if (DATASET_FIELDS.PROMPT in firstLine && DATASET_FIELDS.CHOSEN in firstLine && DATASET_FIELDS.REJECTED in firstLine) {
          return {
            format: 'dpo',
            confidence: 'high',
            details: {
              isMultiLine: true,
              sampleKeys
            }
          };
        }

        // RLHF format: {"prompt": "...", "response": "...", "reward": ...}
        if (DATASET_FIELDS.PROMPT in firstLine && DATASET_FIELDS.RESPONSE in firstLine) {
          return {
            format: 'rlhf',
            confidence: 'high',
            details: {
              isMultiLine: true,
              sampleKeys
            }
          };
        }

        // Alpaca format: {"instruction": "...", "input": "...", "output": "..."}
        // Also handles Dolly variant: {"instruction": "...", "context": "...", "response": "..."}
        if (DATASET_FIELDS.INSTRUCTION in firstLine && (DATASET_FIELDS.OUTPUT in firstLine || DATASET_FIELDS.RESPONSE in firstLine)) {
          return {
            format: 'alpaca',
            confidence: 'high',
            details: {
              isMultiLine: true,
              sampleKeys
            }
          };
        }

        // OpenOrca format: {"system_prompt": "...", "question": "...", "response": "..."}
        if (DATASET_FIELDS.SYSTEM_PROMPT in firstLine && DATASET_FIELDS.QUESTION in firstLine && DATASET_FIELDS.RESPONSE in firstLine) {
          return {
            format: 'openorca',
            confidence: 'high',
            details: {
              isMultiLine: true,
              sampleKeys
            }
          };
        }

        // Unnatural Instructions format: {"instruction": "...", "instances": [...]}
        if (DATASET_FIELDS.INSTRUCTION in firstLine && DATASET_FIELDS.INSTANCES in firstLine && Array.isArray(firstLine.instances)) {
          return {
            format: 'unnatural',
            confidence: 'high',
            details: {
              isMultiLine: true,
              sampleKeys
            }
          };
        }

        if (DATASET_FIELDS.ROLE in firstLine && DATASET_FIELDS.CONTENT in firstLine) {
          return {
            format: 'chatml',
            confidence: 'medium',
            details: {
              isMultiLine: true,
              sampleKeys
            }
          };
        }

        return {
          format: 'jsonl',
          confidence: 'low',
          details: {
            isMultiLine: true,
            sampleKeys
          }
        };
      } catch (e) {
        console.error('[FormatDetector] Failed to parse first line:', e);
        console.error('[FormatDetector] First line raw (first 200 chars):', lines[0].substring(0, 200));
        
        const firstChar = lines[0].trim()[0];
        if (firstChar === '{') {
          console.log('[FormatDetector] Starts with { but JSON.parse failed');
          console.log('[FormatDetector] This might be pretty-printed JSON (should have been caught by single JSON parse)');
        }
        
        return {
          format: 'unknown',
          confidence: 'low',
          details: { isMultiLine: true }
        };
      }
    }

    // Fallback
    console.warn('[FormatDetector] Could not determine format');
    return {
      format: 'unknown',
      confidence: 'low',
      details: {}
    };

  } catch (e) {
    console.error('[FormatDetector] Fatal error:', e);
    return {
      format: 'unknown',
      confidence: 'low',
      details: {}
    };
  }
}

/**
 * Detect format from a parsed single JSON object
 * Handles both single examples and pretty-printed JSON
 */
function detectSingleJsonFormat(parsed: unknown): FormatDetectionResult {
  console.log('[FormatDetector] Analyzing single JSON');
  console.log('[FormatDetector] Type:', Array.isArray(parsed) ? 'array' : typeof parsed);

  // Check for ShareGPT with examples array
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && DATASET_FIELDS.EXAMPLES in parsed) {
    const obj = parsed as Record<string, unknown>;
    const examples = obj.examples;
    if (Array.isArray(examples) && examples.length > 0) {
      const firstExample = examples[0];
      const sampleKeys = Object.keys(firstExample);
      console.log('[FormatDetector] ShareGPT with examples array, sample keys:', sampleKeys);

      if (DATASET_FIELDS.CONVERSATIONS in firstExample) {
        return {
          format: 'sharegpt-examples',
          confidence: 'high',
          details: {
            hasSystemField: DATASET_FIELDS.SYSTEM in firstExample,
            hasConversationsField: true,
            hasExamplesArray: true,
            isMultiLine: false,
            sampleKeys,
            conversationFormat: detectConversationFormat(firstExample.conversations as Array<Record<string, unknown>>)
          }
        };
      }
    }
  }

  // Check for direct ShareGPT format (single example)
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && DATASET_FIELDS.CONVERSATIONS in parsed) {
    const obj = parsed as Record<string, unknown>;
    const sampleKeys = Object.keys(obj);
    console.log('[FormatDetector] Direct ShareGPT format, keys:', sampleKeys);

    return {
      format: 'sharegpt',
      confidence: 'high',
      details: {
        hasSystemField: DATASET_FIELDS.SYSTEM in obj,
        hasConversationsField: true,
        isMultiLine: false,
        sampleKeys,
        conversationFormat: detectConversationFormat(obj.conversations as Array<Record<string, unknown>>)
      }
    };
  }

  // Check for ChatML wrapped format
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && DATASET_FIELDS.MESSAGES in parsed) {
    const sampleKeys = Object.keys(parsed);
    console.log('[FormatDetector] ChatML wrapped format, keys:', sampleKeys);

    return {
      format: 'chatml-wrapped',
      confidence: 'high',
      details: {
        hasMessagesField: true,
        isMultiLine: false,
        sampleKeys
      }
    };
  }

  // Check for ChatML array format OR ShareGPT array format
  if (Array.isArray(parsed) && parsed.length > 0) {
    const first = parsed[0];
    const sampleKeys = Object.keys(first);
    console.log('[FormatDetector] Array format, first element keys:', sampleKeys);

    // Check for ShareGPT array format: [{"conversations": [...]}, ...]
    if (DATASET_FIELDS.CONVERSATIONS in first) {
      console.log('[FormatDetector] Detected ShareGPT array format');
      return {
        format: 'sharegpt',
        confidence: 'high',
        details: {
          hasSystemField: DATASET_FIELDS.SYSTEM in first,
          hasConversationsField: true,
          isMultiLine: false,
          sampleKeys,
          conversationFormat: detectConversationFormat(first.conversations as Array<Record<string, unknown>>)
        }
      };
    }

    // Check for ChatML array format: [{"role": "...", "content": "..."}, ...]
    if (DATASET_FIELDS.ROLE in first && DATASET_FIELDS.CONTENT in first) {
      console.log('[FormatDetector] Detected ChatML array format');
      return {
        format: 'chatml',
        confidence: 'high',
        details: {
          isMultiLine: false,
          sampleKeys
        }
      };
    }
  }

  // Check for standard text format
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && DATASET_FIELDS.TEXT in parsed) {
    const sampleKeys = Object.keys(parsed);
    console.log('[FormatDetector] Standard text format, keys:', sampleKeys);

    return {
      format: 'standard-text',
      confidence: 'high',
      details: {
        hasTextField: true,
        isMultiLine: false,
        sampleKeys
      }
    };
  }

  // Check for DPO format: {"prompt": "...", "chosen": "...", "rejected": "..."}
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && DATASET_FIELDS.PROMPT in parsed && DATASET_FIELDS.CHOSEN in parsed && DATASET_FIELDS.REJECTED in parsed) {
    const sampleKeys = Object.keys(parsed);
    console.log('[FormatDetector] DPO format, keys:', sampleKeys);

    return {
      format: 'dpo',
      confidence: 'high',
      details: {
        isMultiLine: false,
        sampleKeys
      }
    };
  }

  // Check for RLHF format: {"prompt": "...", "response": "...", "reward": ...}
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && DATASET_FIELDS.PROMPT in parsed && DATASET_FIELDS.RESPONSE in parsed) {
    const sampleKeys = Object.keys(parsed);
    console.log('[FormatDetector] RLHF format, keys:', sampleKeys);

    return {
      format: 'rlhf',
      confidence: 'high',
      details: {
        isMultiLine: false,
        sampleKeys
      }
    };
  }

  // Check for Alpaca format: {"instruction": "...", "input": "...", "output": "..."}
  // Also handles Dolly variant: {"instruction": "...", "context": "...", "response": "..."}
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && DATASET_FIELDS.INSTRUCTION in parsed && (DATASET_FIELDS.OUTPUT in parsed || DATASET_FIELDS.RESPONSE in parsed)) {
    const sampleKeys = Object.keys(parsed);
    console.log('[FormatDetector] Alpaca format, keys:', sampleKeys);

    return {
      format: 'alpaca',
      confidence: 'high',
      details: {
        isMultiLine: false,
        sampleKeys
      }
    };
  }

  // Check for OpenOrca format: {"system_prompt": "...", "question": "...", "response": "..."}
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && DATASET_FIELDS.SYSTEM_PROMPT in parsed && DATASET_FIELDS.QUESTION in parsed && DATASET_FIELDS.RESPONSE in parsed) {
    const sampleKeys = Object.keys(parsed);
    console.log('[FormatDetector] OpenOrca format, keys:', sampleKeys);

    return {
      format: 'openorca',
      confidence: 'high',
      details: {
        isMultiLine: false,
        sampleKeys
      }
    };
  }

  // Check for Unnatural Instructions format: {"instruction": "...", "instances": [...]}
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && DATASET_FIELDS.INSTRUCTION in parsed && DATASET_FIELDS.INSTANCES in parsed && Array.isArray(parsed.instances)) {
    const sampleKeys = Object.keys(parsed);
    console.log('[FormatDetector] Unnatural Instructions format, keys:', sampleKeys);

    return {
      format: 'unnatural',
      confidence: 'high',
      details: {
        isMultiLine: false,
        sampleKeys
      }
    };
  }

  // Unknown format
  console.warn('[FormatDetector] Could not determine format from single JSON');
  return {
    format: 'unknown',
    confidence: 'low',
    details: {
      isMultiLine: false,
      sampleKeys: typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : []
    }
  };
}

/**
 * Detect conversation format (from-value vs role-content)
 */
function detectConversationFormat(conversations: Array<Record<string, unknown>>): 'from-value' | 'role-content' {
  if (!Array.isArray(conversations) || conversations.length === 0) {
    return 'from-value'; // default
  }

  const first = conversations[0];
  if (DATASET_FIELDS.FROM in first && DATASET_FIELDS.VALUE in first) {
    return 'from-value';
  }
  if (DATASET_FIELDS.ROLE in first && DATASET_FIELDS.CONTENT in first) {
    return 'role-content';
  }

  return 'from-value'; // default
}

console.log('[FormatDetector] Module loaded');
