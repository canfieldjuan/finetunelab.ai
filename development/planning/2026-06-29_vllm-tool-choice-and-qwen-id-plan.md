# vLLM Tool Choice And Qwen ID Plan

## Why this slice exists

The vLLM/MCP lane now has runtime controls, server controls, MCP tool injection, and live route smoke coverage. One remaining tool-call edge is the OpenAI-compatible adapter itself: vLLM tool requests should explicitly ask for automatic tool selection when the runtime is configured for it, and recovered Qwen XML fallback tool calls should not reuse synthetic IDs across multiple tool rounds.

## Scope

1. Add request-side `tool_choice: "auto"` for vLLM tool requests when runtime metadata has not disabled auto tool choice.
2. Keep non-vLLM providers unchanged and preserve the explicit off switch via `metadata.vllm_runtime.enable_auto_tool_choice: false`.
3. Continue recovered Qwen XML tool-call IDs from prior recovered IDs already present in chat history.
4. Add adapter and unified-client tests for the request shape and multi-round continuation behavior.

## Files touched

- `lib/llm/adapters/openai-adapter.ts`
- `lib/llm/adapters/__tests__/openai-adapter.test.ts`
- `lib/llm/__tests__/unified-client.test.ts`
- `development/planning/2026-06-29_vllm-tool-choice-and-qwen-id-plan.md`

## Mechanism

`OpenAIAdapter.formatRequest` reads `metadata.vllm_runtime` and, only for `provider: "vllm"` requests with tools, includes `tool_choice: "auto"` unless `enable_auto_tool_choice` is explicitly `false`. `parseResponse` now derives the next recovered Qwen XML tool-call ID from existing `qwen-xml-tool-N` IDs in the request messages before assigning IDs to newly recovered calls.

## Intentional

- The change does not alter OpenAI, OpenRouter, RunPod, Ollama, or Anthropic request bodies.
- The Qwen XML fallback remains opt-in through `parse_qwen_xml_tool_calls`.
- No UI changes are included; this slice hardens the runtime behavior behind the controls that already landed.

## Deferred

- Provider presets such as "Qwen XML tools" that set parser, template format, fallback parsing, and auto tool choice together.
- Live browser/manual test against a running local Qwen vLLM server.
- Streaming tool-call parsing; tool-enabled chat remains on the non-streaming route path.

## Verification

- `npm ci` passed in the fresh worktree, with existing peer/vulnerability warnings.
- `npm run test:vitest -- lib/llm/adapters/__tests__/openai-adapter.test.ts lib/llm/__tests__/unified-client.test.ts --run` passed: 2 files, 11 tests.
- `npm run test:vitest -- lib/models/__tests__/vllm-runtime.test.ts lib/services/__tests__/vllm-runtime-config.test.ts lib/services/__tests__/vllm-checker.test.ts lib/llm/adapters/__tests__/openai-adapter.test.ts lib/llm/__tests__/unified-client.test.ts app/api/chat/__tests__/route-tool-use-smoke.test.ts app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts --run` passed: 7 files, 24 tests.
- `npm run type-check` passed.
- `npm run lint` passed with existing warnings and no errors.
- `git diff --check` passed.

## Estimated diff size

Target: under 160 LOC.
