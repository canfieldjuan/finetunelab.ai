# Chat Portal Tool Gaps — vs LM Studio / OpenWebUI

Logged 2026-06-28. Tracks the tool/capability gap between FineTuneLab's chat
portal and comparable local-LLM portals (LM Studio, OpenWebUI), and sequences
the work to close it. Current portal facts below were verified against the code,
not the docs.

## Current portal tools (verified)

Portal allowlist — `lib/tools/registry-sync.ts:15` (`PORTAL_CHAT_TOOL_NAMES`),
enforced at execution via `toolManager.ts:153` (`options.enforcePortalChatTool`),
opted into by the chat route at `toolManager.ts:274`:

- `calculator`
- `datetime`
- `web_search`
- `query_knowledge_graph` (GraphRAG)
- `intelligent_email`
- `email_analysis`
- `email_security`

Registered in the tool registry but **not** portal-exposed (admin/analytics —
used by `app/api/analytics/chat/route.ts`, not the user chat portal):
`filesystem`, `system_monitor`, `token_analyzer`, `evaluation_metrics`,
`training_control`, `dataset_manager`, `analytics_export`, `unified_export`,
`prompt_pipeline`, `prompt_injector`.

## Portal capabilities present (verified)

- **RAG** via GraphRAG: `DocumentUpload`/`DocumentList` → ingest → query through
  `query_knowledge_graph`. (Knowledge-base style, not ad-hoc per-chat attach.)
- **Voice**: STT mic input (`components/chat/ChatInput.tsx`, `sttSupported`) + TTS
  playback.
- **Multi-model compare** (PR #22), **generation controls** temp/max-tokens
  (PR #21), **markdown rendering** (PR #26), **web-search result cards** (PR #27),
  **memory / context injection** (`memory.conversationMemories`).

## Gaps vs LM Studio / OpenWebUI (verified absent in code)

High leverage:
1. **MCP client** — connect to external MCP tool servers. Both LM Studio and
   OpenWebUI support this; single biggest unlock (tools without hand-coding each).
   No `modelcontextprotocol` / MCP-client code present. **← chosen first.**
2. **Code interpreter / Python execution** — only `calculator` exists today.
3. **Image generation** — OpenWebUI wires ComfyUI/SD/DALL-E. ComfyUI already runs
   locally on the RTX 3090 → mostly glue.

Medium:
4. **Vision / image input** — no per-message image attachment / multimodal input.
5. **Per-chat file attachment** — only KG ingestion exists, not ad-hoc "attach a
   PDF to this message."
6. **URL fetch / "read this page"** — dedicated fetch tool (today only inside
   `web_search` deepSearch).
7. **User-defined tools from the UI** — registry is code-only (vs OpenWebUI
   Tools/Functions).

Nice-to-have:
8. **Artifacts / live HTML rendering** — markdown only today.
9. **Structured output (JSON-schema mode)** — LM Studio has it; useful for a lab.

## At parity (not gaps)

Web search, RAG knowledge base, voice in/out, multi-model compare, generation
params, memory.

## Decision / sequencing

Pursue in order: **(1) MCP client → (2) code interpreter → (3) image-gen via local
ComfyUI.** Web-search quality improvements (rate-limit enforcement, richer
summaries, more breadth, provider swap) are **parked** as a separate effort.

## Design principle: provider-agnostic tool layer (MCP build)

Hard constraint: the MCP/tool layer stays provider-agnostic. The chat request
declares "these tools are available" (neutral list); the selected model/backend
decides whether it can use them.

The codebase already enforces this and MCP must not break it:
- Neutral wire format = OpenAI function-tool shape, built client-side
  (`components/hooks/useTools.ts:28`) and sent in the request.
- Per-backend decision: provider adapters gate on `config.supports_functions`
  (`lib/llm/adapters/anthropic-adapter.ts:77`, `openai-adapter.ts:111`) — a model
  that can't use tools just gets none, no error.
- Per-provider translation lives ONLY in the adapters (`formatTools()` →
  Anthropic `input_schema`, OpenAI `function`).

MCP integration rule: the MCP adapter emits the same neutral `ToolDefinition`
(registry, for `executeTool` dispatch) + DB tool row (so `useTools` offers it).
No provider-specific code in the MCP layer; MCP tools ride the identical path.
Note: two same-named `ToolDefinition` types exist — registry (`lib/tools/types.ts`,
top-level name/parameters/execute) vs wire (`{function:{…}}`); keep MCP consistent
across both.

## Security constraints (MCP build)

**stdio transport = arbitrary host command execution.** A `stdio` MCP server config
is a command + args the server process spawns — i.e. host RCE. This is fine in Slice 1
(code-config only, single operator), but once `mcp_servers` becomes DB-backed
(Slice 2) and portal-reachable (Slice 3), **configuring a `stdio` command MUST be
admin-only**. Hard requirements for the config layer:
- Slice 2/3: a non-admin user may NOT create/edit a `stdio` server (only `http`).
  Enforce server-side (RLS + API check), not just in the UI.
- Slice 3's portal allowlist / registration is where stdio servers must be gated to
  admins before their tools are registered or offered.
- Treat all MCP servers (even http) as untrusted input; never echo resolved auth
  tokens back to clients.

**Provider tool-name limits.** OpenAI function names must match
`^[a-zA-Z0-9_-]{1,64}$` (no dot, ≤64). The MCP adapter's `mcpToolName` sanitizes to
that set and clamps to 64 (see `lib/tools/mcp/adapter.ts`); keep this when persisting
names to the `tools` table in Slice 3.

## Status log

- 2026-06-28 — Gap analysis logged. Starting MCP client (item 1).
- 2026-06-28 — Confirmed tool layer is already provider-agnostic (adapters gate on
  supports_functions); recorded as a hard constraint for the MCP build.
- 2026-06-28 — Slice 1 PR #42 opened. Review fix-ups: tool-name sanitizer now drops
  dots + clamps to 64 (OpenAI-safe); recorded the stdio-RCE admin-gate constraint
  for slices 2–3 (above).
