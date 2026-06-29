import { describe, expect, it } from 'vitest';
import { buildVLLMDockerArgs, shellQuote } from '../runpod-serverless-service';

describe('RunPod vLLM docker args', () => {
  it('shell-quotes chat template values that contain spaces and quotes', () => {
    expect(shellQuote("{{ bos_token }} say 'hi'")).toBe("'{{ bos_token }} say '\\''hi'\\'''");
  });

  it('builds docker args without splitting literal chat templates', () => {
    expect(buildVLLMDockerArgs('Qwen/Qwen3', [
      '--host',
      '0.0.0.0',
      '--chat-template',
      "{{ bos_token }}{% for message in messages %}{{ message['content'] }}{% endfor %}",
      '--tool-call-parser',
      'qwen3_xml',
    ])).toBe(
      "vllm serve --model Qwen/Qwen3 --host 0.0.0.0 --chat-template '{{ bos_token }}{% for message in messages %}{{ message['\\''content'\\''] }}{% endfor %}' --tool-call-parser qwen3_xml"
    );
  });
});
