import { describe, expect, it } from 'vitest';
import { resolveOllamaRequestModel, toOllamaNativeBaseUrl } from '../ollama-utils';

describe('Ollama URL/model helpers', () => {
  it.each([
    ['http://localhost:11434', 'http://localhost:11434'],
    ['http://localhost:11434/', 'http://localhost:11434'],
    ['http://localhost:11434/v1', 'http://localhost:11434'],
    ['http://localhost:11434/v1/', 'http://localhost:11434'],
    ['https://ollama.example.com/proxy/v1', 'https://ollama.example.com/proxy'],
  ])('normalizes %s to native base %s', (input, expected) => {
    expect(toOllamaNativeBaseUrl(input)).toBe(expected);
  });

  it('prefers a non-empty served model name', () => {
    expect(resolveOllamaRequestModel({
      model_id: '/models/llama3.2',
      served_model_name: ' llama3.2:latest ',
    })).toBe('llama3.2:latest');
  });

  it('falls back to model_id when served_model_name is absent or blank', () => {
    expect(resolveOllamaRequestModel({
      model_id: '/models/llama3.2',
      served_model_name: null,
    })).toBe('/models/llama3.2');

    expect(resolveOllamaRequestModel({
      model_id: '/models/llama3.2',
      served_model_name: '   ',
    })).toBe('/models/llama3.2');
  });
});
