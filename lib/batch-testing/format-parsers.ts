// Format Parsers for Training Dataset Prompt Extraction
// Purpose: Parse different training dataset formats and extract prompts/questions
// Date: 2025-10-30



/**
 * Parse ChatML format and extract user messages
 * Format: Array of messages with role: 'system' | 'user' | 'assistant'
 */
export function parseChatML(content: string, maxPrompts: number = 10000): string[] {
  console.log('[parseChatML] Parsing ChatML format');
  const prompts: string[] = [];

  try {
    const data = JSON.parse(content);

    // Handle both single conversation and array of conversations
    const conversations = Array.isArray(data) ? data : [data];

    for (const conversation of conversations) {
      if (prompts.length >= maxPrompts) break;

      // Conversation is an array of messages
      if (Array.isArray(conversation)) {
        for (const message of conversation) {
          if (prompts.length >= maxPrompts) break;

          if (message.role === 'user' && message.content) {
            prompts.push(message.content.trim());
          }
        }
      }
    }

    console.log('[parseChatML] Extracted prompts:', prompts.length);
    return prompts;
  } catch (error) {
    console.error('[parseChatML] Parse error:', error);
    return [];
  }
}

/**
 * Parse ShareGPT format and extract human messages
 * Format: { conversations: [{ from: 'human' | 'gpt', value: string }] }
 */
export function parseShareGPT(content: string, maxPrompts: number = 10000): string[] {
  console.log('[parseShareGPT] Parsing ShareGPT format');
  const prompts: string[] = [];

  try {
    const data = JSON.parse(content);

    // Handle both single conversation and array of conversations
    const conversations = Array.isArray(data) ? data : [data];

    for (const item of conversations) {
      if (prompts.length >= maxPrompts) break;

      if (item.conversations && Array.isArray(item.conversations)) {
        for (const turn of item.conversations) {
          if (prompts.length >= maxPrompts) break;

          if (turn.from === 'human' && turn.value) {
            prompts.push(turn.value.trim());
          }
        }
      }
    }

    console.log('[parseShareGPT] Extracted prompts:', prompts.length);
    return prompts;
  } catch (error) {
    console.error('[parseShareGPT] Parse error:', error);
    return [];
  }
}

/**
 * Parse Alpaca format and extract instruction + input
 * Format: { instruction: string, input: string, output: string }
 */
export function parseAlpaca(content: string, maxPrompts: number = 10000): string[] {
  console.log('[parseAlpaca] Parsing Alpaca format');
  const prompts: string[] = [];

  try {
    const data = JSON.parse(content);

    // Handle both single example and array of examples
    const examples = Array.isArray(data) ? data : [data];

    for (const example of examples) {
      if (prompts.length >= maxPrompts) break;

      if (example.instruction) {
        // Combine instruction and input if input exists
        let prompt = example.instruction.trim();

        if (example.input && example.input.trim()) {
          prompt += '\n\n' + example.input.trim();
        }

        prompts.push(prompt);
      }
    }

    console.log('[parseAlpaca] Extracted prompts:', prompts.length);
    return prompts;
  } catch (error) {
    console.error('[parseAlpaca] Parse error:', error);
    return [];
  }
}

/**
 * Parse OpenOrca format and extract questions
 * Format: { system_prompt: string, question: string, response: string }
 */
export function parseOpenOrca(content: string, maxPrompts: number = 10000): string[] {
  console.log('[parseOpenOrca] Parsing OpenOrca format');
  const prompts: string[] = [];

  try {
    const data = JSON.parse(content);

    // Handle both single example and array of examples
    const examples = Array.isArray(data) ? data : [data];

    for (const example of examples) {
      if (prompts.length >= maxPrompts) break;

      if (example.question) {
        // Optionally prepend system prompt if it exists
        let prompt = '';

        if (example.system_prompt && example.system_prompt.trim()) {
          prompt = `${example.system_prompt.trim()}\n\n${example.question.trim()}`;
        } else {
          prompt = example.question.trim();
        }

        prompts.push(prompt);
      }
    }

    console.log('[parseOpenOrca] Extracted prompts:', prompts.length);
    return prompts;
  } catch (error) {
    console.error('[parseOpenOrca] Parse error:', error);
    return [];
  }
}

/**
 * Parse DPO (Direct Preference Optimization) format and extract prompts
 * Format: { prompt: string, chosen: string, rejected: string }
 */
export function parseDPO(content: string, maxPrompts: number = 10000): string[] {
  console.log('[parseDPO] Parsing DPO format');
  const prompts: string[] = [];

  try {
    const data = JSON.parse(content);

    // Handle both single example and array of examples
    const examples = Array.isArray(data) ? data : [data];

    for (const example of examples) {
      if (prompts.length >= maxPrompts) break;

      if (example.prompt) {
        prompts.push(example.prompt.trim());
      }
    }

    console.log('[parseDPO] Extracted prompts:', prompts.length);
    return prompts;
  } catch (error) {
    console.error('[parseDPO] Parse error:', error);
    return [];
  }
}

/**
 * Parse RLHF (Reinforcement Learning from Human Feedback) format and extract prompts
 * Format: { prompt: string, response: string, reward?: number }
 */
export function parseRLHF(content: string, maxPrompts: number = 10000): string[] {
  console.log('[parseRLHF] Parsing RLHF format');
  const prompts: string[] = [];

  try {
    const data = JSON.parse(content);

    // Handle both single example and array of examples
    const examples = Array.isArray(data) ? data : [data];

    for (const example of examples) {
      if (prompts.length >= maxPrompts) break;

      if (example.prompt) {
        prompts.push(example.prompt.trim());
      }
    }

    console.log('[parseRLHF] Extracted prompts:', prompts.length);
    return prompts;
  } catch (error) {
    console.error('[parseRLHF] Parse error:', error);
    return [];
  }
}

/**
 * Parse JSONL (line-delimited JSON) format with auto-detection
 * Attempts to detect the format of each line
 */
export function parseJSONL(content: string, maxPrompts: number = 10000): string[] {
  console.log('[parseJSONL] Parsing JSONL format');
  const prompts: string[] = [];

  try {
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      if (prompts.length >= maxPrompts) break;

      try {
        const obj = JSON.parse(line);

        // Try to detect format and extract prompt
        if (obj.prompt) {
          // DPO or RLHF format
          prompts.push(obj.prompt.trim());
        } else if (obj.instruction) {
          // Alpaca format
          let prompt = obj.instruction.trim();
          if (obj.input && obj.input.trim()) {
            prompt += '\n\n' + obj.input.trim();
          }
          prompts.push(prompt);
        } else if (obj.question) {
          // OpenOrca format
          let prompt = obj.question.trim();
          if (obj.system_prompt && obj.system_prompt.trim()) {
            prompt = `${obj.system_prompt.trim()}\n\n${prompt}`;
          }
          prompts.push(prompt);
        } else if (obj.conversations && Array.isArray(obj.conversations)) {
          // ShareGPT format
          for (const turn of obj.conversations) {
            if (prompts.length >= maxPrompts) break;
            if (turn.from === 'human' && turn.value) {
              prompts.push(turn.value.trim());
            }
          }
        } else if (Array.isArray(obj)) {
          // ChatML format (array of messages)
          for (const message of obj) {
            if (prompts.length >= maxPrompts) break;
            if (message.role === 'user' && message.content) {
              prompts.push(message.content.trim());
            }
          }
        }
      } catch (lineError) {
        console.warn('[parseJSONL] Failed to parse line:', lineError);
        continue;
      }
    }

    console.log('[parseJSONL] Extracted prompts:', prompts.length);
    return prompts;
  } catch (error) {
    console.error('[parseJSONL] Parse error:', error);
    return [];
  }
}

/**
 * Parse Unnatural Instructions format and extract instructions
 * Format: { instruction: string, instances: [{ input: string, output: string }] }
 */
export function parseUnnaturalInstructions(content: string, maxPrompts: number = 10000): string[] {
  console.log('[parseUnnaturalInstructions] Parsing Unnatural Instructions format');
  const prompts: string[] = [];

  try {
    const data = JSON.parse(content);

    // Handle both single example and array of examples
    const examples = Array.isArray(data) ? data : [data];

    for (const example of examples) {
      if (prompts.length >= maxPrompts) break;

      if (example.instruction && example.instances && Array.isArray(example.instances)) {
        // Extract each instance with the instruction
        for (const instance of example.instances) {
          if (prompts.length >= maxPrompts) break;

          let prompt = example.instruction.trim();

          if (instance.input && instance.input.trim()) {
            prompt += '\n\n' + instance.input.trim();
          }

          prompts.push(prompt);
        }
      }
    }

    console.log('[parseUnnaturalInstructions] Extracted prompts:', prompts.length);
    return prompts;
  } catch (error) {
    console.error('[parseUnnaturalInstructions] Parse error:', error);
    return [];
  }
}

console.log('[FormatParsers] All format parsers loaded');
