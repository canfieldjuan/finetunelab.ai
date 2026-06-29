# vLLM Tool Use Test Arc Plan

## Why this slice exists

The vLLM/tooling lane now has separate slices for runtime status, local server controls, and deploy-time parser/template controls. Before running live tool-use tests against vLLM, the repo needs a current runbook that records the complete arc: what must be configured, what the probe actually covers, which outputs prove success, and what remains outside the probe.

## Scope

1. Add a current vLLM tool-use test runbook.
2. Tie the runbook to the existing `probe:vllm-tools` script and the recently landed runtime-control slices.
3. Add a cheap `--list-cases` probe mode so the runbook can be verified without a live vLLM server.
4. Keep this slice documentation/probe-harness only; no chat orchestration behavior changes.

## Files touched

- `docs/VLLM_TOOL_USE_TEST_ARC.md`
- `scripts/probe-vllm-tool-output.ts`
- `development/planning/2026-06-28_vllm-tool-use-test-arc-plan.md`

## Mechanism

The runbook describes the expected path from model/server configuration through `OpenAIAdapter` request formatting, Qwen XML fallback parsing, portal tool execution, assistant/tool continuation messages, and transcript output. The probe gains `--list-cases`, which loads the available test cases and exits before making provider calls.

## Intentional

- The live probe still talks directly through the OpenAI-compatible adapter instead of the full `/api/chat` route; the runbook calls this out so results are not overstated.
- No vLLM server is started by this slice. Starting/ejecting models remains in the existing runtime panel and deploy flows.
- No MCP behavior changes here. MCP tools can be added to the live arc once they are wired into the same user toolset path as the portal tools.

## Deferred

- Full `/api/chat` browser/API smoke that verifies selected-model lookup, enabled tool selection, SSE rendering, and persisted tool-call traces.
- MCP-backed tool probe cases once the MCP UI/client wiring lands.
- Provider-specific runtime presets such as Qwen XML.

## Verification

- `npm ci` to install this fresh worktree's dependencies before local checks.
- `npm run probe:vllm-tools -- --list-cases` passed and printed the documented probe case list without provider calls.
- `npx vitest run lib/llm/__tests__/unified-client.test.ts lib/llm/adapters/__tests__/openai-adapter.test.ts lib/tools/mcp/__tests__/adapter.test.ts lib/tools/mcp/__tests__/user-toolset.test.ts` passed: 26 tests.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.

## Estimated diff size

Target: under 220 LOC.
