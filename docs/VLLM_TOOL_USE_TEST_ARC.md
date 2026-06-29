# vLLM Tool Use Test Arc

This is the current runbook for testing local or external vLLM tool use in the portal lane. It records the setup we want in place before live testing, what the existing probe covers, and what still needs a deeper `/api/chat` or browser-level test.

## Current Setup Arc

1. Runtime status tells the portal whether vLLM is actually deployable.
   - Local mode requires importable local vLLM outside cloud/serverless runtimes.
   - External mode requires `VLLM_EXTERNAL_URL`.
   - Cloud mode without `VLLM_EXTERNAL_URL` is unavailable.

2. Runtime controls let Juan eject or swap local model servers before loading another model.
   - External vLLM/Ollama rows stay out of local process controls.
   - Stop/swap actions clear cached server status before refresh.

3. Deploy flows can persist vLLM tool-runtime settings.
   - Add/Edit model flows expose parser/template metadata.
   - Trained deploy now exposes the same vLLM-backed parser/template controls for local vLLM and RunPod vLLM pods.
   - RunPod serverless remains excluded because that path currently registers non-tool-capable models.

4. Chat/tool execution can recover Qwen XML fallback calls.
   - `OpenAIAdapter` can parse `<tool_call>{...}</tool_call>` content when model metadata enables `parse_qwen_xml_tool_calls`.
   - `UnifiedLLMClient` preserves assistant `tool_calls` before appending tool result messages.

## Live Probe

Use the existing probe for a direct OpenAI-compatible vLLM smoke test:

```bash
npm run probe:vllm-tools -- \
  --base-url http://localhost:8000/v1 \
  --model qwen3
```

Useful Qwen XML variant:

```bash
npm run probe:vllm-tools -- \
  --base-url http://localhost:8000/v1 \
  --model qwen3 \
  --case calculator-basic \
  --case datetime-current-chicago
```

External endpoint variant:

```bash
VLLM_EXTERNAL_URL=https://your-vllm.example.com/v1 \
VLLM_SERVED_MODEL_NAME=qwen3 \
npm run probe:vllm-tools
```

The probe writes a transcript to `output/vllm-tool-probes/<timestamp>.json`.

## Route Smoke

The API route smokes verify the portal layer around tool execution without starting a live vLLM server:

```bash
npx vitest run app/api/chat/__tests__/route-tool-use-smoke.test.ts
npx vitest run app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts
```

This covers:

- Registry model selection through `modelId`.
- Built-in portal tool dispatch through the route-level `toolCallHandler`.
- Authenticated-user MCP tool discovery in `/api/chat`.
- MCP tool definitions being offered to `unifiedLLMClient.chat`.
- MCP tool calls dispatching through the scoped `McpUserToolset` instead of the global portal registry.
- The route-level security gate: body-claimed users without authenticated session context do not get MCP tools.
- Non-streaming SSE metadata for built-in and MCP-backed tool calls.

## Probe Cases

Check available cases without making a provider call:

```bash
npm run probe:vllm-tools -- --list-cases
```

Current cases:

- `calculator-basic`: one calculator call, then final answer from the tool result.
- `calculator-multiple`: multiple arithmetic expressions in one or more tool rounds.
- `datetime-current-chicago`: current time must come from the datetime tool.
- `datetime-date-math`: date arithmetic must come from the datetime tool.
- `web-search-standard`: standard web search call with completed results.
- `literal-xml-no-tools`: literal XML in prose must not become an executable tool call.
- `malformed-xml-no-tools`: malformed XML-looking JSON must not throw or start a tool loop.

## What Counts As Passing

A useful live run should show:

- At least one offered tool called in the positive cases.
- No unoffered tool calls.
- No executable tool calls in the literal/malformed XML negative cases.
- A final assistant answer after tool results.
- Transcript request bodies contain assistant `tool_calls` before matching `tool` messages.
- No provider error saying vLLM was started without `--enable-auto-tool-choice` or `--tool-call-parser`.

Warnings are not always failures. For example, a model that answers without tools may mean the prompt was too weak or the runtime parser/template does not match the model.

## Starting vLLM For Tool Use

The runtime must be started with tool-call support. Example:

```bash
vllm serve Qwen/Qwen3 \
  --host 127.0.0.1 \
  --port 8000 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_xml \
  --chat-template-content-format openai
```

Use the portal deploy controls when possible so the saved model metadata, local server row, and actual vLLM process agree.

## Boundaries

The probe is not the full portal chat path. It verifies:

- OpenAI-compatible request formatting.
- vLLM response parsing.
- Qwen XML fallback recovery.
- Portal tool execution for the included tools.
- Continuation-message shape.

The API-level route smoke in `app/api/chat/__tests__/route-tool-use-smoke.test.ts` verifies:

- `/api/chat` selects a registry model through `modelId`.
- Tool-enabled requests take the non-streaming tool-aware route.
- The route-level `toolCallHandler` executes an offered portal tool.
- The returned SSE stream includes model metadata, tool metadata, final content, and `[DONE]`.

It does not yet verify:

- Live DB-backed `/api/chat` model lookup and enabled portal-tool selection.
- SSE streaming/rendering in the chat UI.
- Conversation persistence.
- Trace persistence for tool calls.
- Live MCP server behavior.

Those are the next deeper slices after this runbook/probe harness.
