/**
 * Ollama Modelfile Generator
 * Creates Modelfile for deploying trained models with Ollama
 * 
 * Date: 2025-11-02
 * Phase: Ollama Deployment - Phase 1.2
 */

import * as fs from 'fs/promises';

export interface ModelfileConfig {
  ggufPath: string;          // Path to GGUF model file
  modelName: string;         // Display name (e.g., "my-finetuned-qwen")
  template?: string;         // Chat template (auto-detect from base model)
  parameters?: {
    temperature?: number;    // Default: 0.7
    topP?: number;          // Default: 0.9
    topK?: number;          // Default: 40
    contextLength?: number; // Default: 4096
    repeatPenalty?: number; // Default: 1.1
  };
  system?: string;          // System prompt
}

/**
 * Chat templates for common model families
 * Based on official model documentation
 */
const CHAT_TEMPLATES: Record<string, string> = {
  qwen: `{{ if .System }}<|im_start|>system
{{ .System }}<|im_end|>
{{ end }}{{ if .Prompt }}<|im_start|>user
{{ .Prompt }}<|im_end|>
{{ end }}<|im_start|>assistant
{{ .Response }}<|im_end|>`,

  llama3: `{{ if .System }}<|start_header_id|>system<|end_header_id|>

{{ .System }}<|eot_id|>{{ end }}{{ if .Prompt }}<|start_header_id|>user<|end_header_id|>

{{ .Prompt }}<|eot_id|>{{ end }}<|start_header_id|>assistant<|end_header_id|>

{{ .Response }}<|eot_id|>`,

  mistral: `{{ if .System }}[INST] {{ .System }} [/INST]{{ end }}{{ if .Prompt }}[INST] {{ .Prompt }} [/INST]{{ end }} {{ .Response }}`,

  phi: `<|user|>
{{ .Prompt }}<|end|>
<|assistant|>
{{ .Response }}<|end|>`,

  // Default template for unknown models
  default: `{{ if .System }}System: {{ .System }}

{{ end }}{{ if .Prompt }}User: {{ .Prompt }}

{{ end }}Assistant: {{ .Response }}`,
};

/**
 * Detect model family from model name
 * Returns the appropriate chat template key
 */
export function detectModelFamily(modelName: string): string {
  const lower = modelName.toLowerCase();
  
  if (lower.includes('qwen')) return 'qwen';
  if (lower.includes('llama')) return 'llama3';
  if (lower.includes('mistral')) return 'mistral';
  if (lower.includes('phi')) return 'phi';
  
  console.log(`[Modelfile Generator] Unknown model family for "${modelName}", using default template`);
  return 'default';
}

/**
 * Generate Modelfile content from configuration
 */
export function generateModelfile(config: ModelfileConfig): string {
  const family = detectModelFamily(config.modelName);
  const template = config.template || CHAT_TEMPLATES[family];
  
  const params = config.parameters || {};
  
  const lines = [
    `# Modelfile for ${config.modelName}`,
    `# Generated: ${new Date().toISOString()}`,
    `# Family: ${family}`,
    '',
    `FROM ${config.ggufPath}`,
    '',
  ];
  
  // Add template
  if (template) {
    lines.push('TEMPLATE """');
    lines.push(template);
    lines.push('"""');
    lines.push('');
  }
  
  // Add parameters
  const temperature = params.temperature ?? 0.7;
  const topP = params.topP ?? 0.9;
  const topK = params.topK ?? 40;
  const contextLength = params.contextLength ?? 4096;
  const repeatPenalty = params.repeatPenalty ?? 1.1;
  
  lines.push('# Parameters');
  lines.push(`PARAMETER temperature ${temperature}`);
  lines.push(`PARAMETER top_p ${topP}`);
  lines.push(`PARAMETER top_k ${topK}`);
  lines.push(`PARAMETER num_ctx ${contextLength}`);
  lines.push(`PARAMETER repeat_penalty ${repeatPenalty}`);
  
  // Add system prompt if provided
  if (config.system) {
    lines.push('');
    lines.push('# System Prompt');
    lines.push('SYSTEM """');
    lines.push(config.system);
    lines.push('"""');
  }
  
  return lines.join('\n');
}

/**
 * Save Modelfile to disk
 */
export async function saveModelfile(
  content: string,
  outputPath: string
): Promise<void> {
  await fs.writeFile(outputPath, content, 'utf-8');
  console.log('[Modelfile Generator] Saved to:', outputPath);
}

/**
 * Generate and save Modelfile in one step
 */
export async function createModelfile(
  config: ModelfileConfig,
  outputPath: string
): Promise<string> {
  const content = generateModelfile(config);
  await saveModelfile(content, outputPath);
  return content;
}

console.log('[Modelfile Generator] Module loaded');
