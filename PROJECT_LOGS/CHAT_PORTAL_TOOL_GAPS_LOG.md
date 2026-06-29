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
is a command + args the server process spawns — i.e. host RCE. Since this app has **no
admin/role model** (verified: user-scoped auth + RLS only), the gate is made
*structural* rather than a permission check (decided 2026-06-28):

**stdio is host-config-only and NEVER DB-backed.** Implemented in Slice 2:
- `mcp_servers` stores only `http` rows — DB `CHECK (transport = 'http')`
  (`migrations/20260628_create_mcp_servers.sql`) + service hardcodes `transport:'http'`
  and exposes no stdio create path (`server-config.service.ts`). There is no
  DB/UI-writable path to a `command`, so DB → command → RCE is impossible by construction.
- stdio servers come **only** from trusted host config — the `MCP_STDIO_SERVERS` env
  the operator controls (`host-config.ts`), loaded server-side.
- `listEnabledServers` merges the user's enabled DB http servers + host stdio servers
  for the client manager.
- Treat all MCP servers (even http) as untrusted input; never echo resolved auth
  tokens back to clients. HTTP auth tokens are encrypted at rest.

**HTTP transport = outbound request surface (SSRF/egress).** `http` is the
non-admin-safe alternative to stdio, but once non-admins can configure server URLs,
the app server makes outbound requests to attacker-chosen hosts *with resolved auth
headers attached*. Slice 1 rejects non-`http(s)` protocols at the core
(`client.ts buildTransport`). **Slices 2-3 must additionally** allowlist/deny
internal + link-local + private targets (`localhost`, `127.0.0.1`,
`169.254.169.254`, RFC1918 ranges, `::1`, etc.) before user-managed config lands, so
"http-only for non-admins" doesn't become SSRF/secret egress. Never return resolved
auth tokens to clients.

**Provider tool-name limits.** OpenAI function names must match
`^[a-zA-Z0-9_-]{1,64}$` (no dot, ≤64). The MCP adapter's `mcpToolName` sanitizes to
that set and clamps to 64 (see `lib/tools/mcp/adapter.ts`); keep this when persisting
names to the `tools` table in Slice 3.

## Slice 3 (registration) follow-ups — from PR #42 review

When wiring discovery/registration, before a tool is registered/offered:
- **Connect-time SSRF check (P1, authoritative).** ✅ DONE in Slice 3a (hardened in
  review round 2): `assertResolvedHostIsPublic` (`url-guard.ts`) resolves the host and
  rejects loopback/private/CGNAT/link-local/test-net/reserved/multicast/IPv4-mapped/
  doc IPs (full non-global set, not just RFC1918). The http transport uses a custom
  `ssrfGuardedFetch` that **re-validates on every request** and sets `redirect:'error'`
  (so a public endpoint can't 3xx to an internal host, and a post-connect rebind is
  caught on the next request); `connect()` also pre-checks before opening. Residual:
  a micro-TOCTOU between the lookup and fetch's own resolution — true socket-level
  IP-pinning (undici custom connect) is a deeper follow-up.
- **Filter task-required tools.** ✅ DONE in Slice 3a: `listTools` skips tools with
  `execution.taskSupport === 'required'` (not callable via `callTool`).
- **Nested arg schemas.** `normalizeInputSchema` currently maps only top-level
  `properties`/`required`; nested object/array param shapes are flattened to a bare
  `type`. Fine for simple tools; revisit (extend `ToolParameter` / pass through inner
  schema) if complex MCP tools need full structure for the model.

## MCP tool multi-tenancy (Slice 3b decision)

The `tools` table + `getEnabledTools` + the `ToolRegistry` are process-global, but
MCP http servers are per-user (slice-2 owner RLS). Writing per-user MCP tools to the
global table/registry would offer one user's tools (and decrypted server auth) to all.
**Decision (2026-06-29): request-time, no global rows.** MCP tools are resolved per
user per request into an in-memory `McpUserToolset` (`user-toolset.ts`) and injected
by the chat route (3c); never written to the global `tools` table or registry. Dispatch
is scoped to the names in that user's toolset. The shared `McpClientManager` keys
connections by **server id** (not name) so users sharing a display name (e.g. two
"github" servers) stay isolated and host stdio is shared — this also resolves the
deferred slice-1 Copilot finding about name-vs-id keying.

## Status log

- 2026-06-28 — Gap analysis logged. Starting MCP client (item 1).
- 2026-06-28 — Confirmed tool layer is already provider-agnostic (adapters gate on
  supports_functions); recorded as a hard constraint for the MCP build.
- 2026-06-28 — Slice 1 PR #42 opened. Review fix-ups: tool-name sanitizer now drops
  dots + clamps to 64 (OpenAI-safe); recorded the stdio-RCE admin-gate constraint
  for slices 2–3 (above).
- 2026-06-28 — Slice 1 round 2 (codex + reviewer): listTools now follows pagination
  cursors; callTool carries `structuredContent` (preferred when no text); schema
  normalization maps integer→number and preserves non-string enum types
  (`ToolParameter.enum` widened); connects deduped + `onclose` clears stale entries;
  http transport rejects non-http(s). Recorded HTTP SSRF/egress + task-required-tool
  + nested-schema follow-ups (above).
- 2026-06-29 — Slice 1 merged (#42). Slice 2 started: no admin/role model exists, so
  decided stdio = **host-config-only, never DB-backed** (Option 2, strongest). Built
  `mcp_servers` migration (http-only CHECK + RLS), `host-config.ts` (stdio from
  `MCP_STDIO_SERVERS`), `url-guard.ts` (http(s) + private-target SSRF block),
  `server-config.service.ts` (http CRUD + merged `listEnabledServers`), with tests.
- 2026-06-29 — Slice 2 PR #45 review round (codex P1s + reviewer): moved migration to
  `supabase/migrations/` (the actual runner path — gate DB layer now applies); fixed
  url-guard (public domains like fda.gov no longer false-flagged as IPv6 ULA;
  IPv4-mapped IPv6 + trailing-dot loopback now blocked); public service methods return
  a token-redacted summary (no decrypted bearer leaks to UI/API); server names
  validated to [A-Za-z0-9_-] (DB-unique == namespace-unique). Recorded connect-time
  SSRF (resolve-time) as a Slice-3 P1 above.
- 2026-06-29 — Slice 2 review round 2: `mcpToolName` now appends an FNV-1a hash
  suffix when the composed name exceeds 64 chars (a long server/tool name could
  previously truncate away the `__<tool>` suffix and collide). Resolves the last
  inline finding on #45.
- 2026-06-29 — Slice 3a (security core) built: connect-time resolve-time SSRF check
  (`assertResolvedHostIsPublic`, wired into `McpClientManager.connect`) + task-required
  tool filtering in `listTools`. 55 MCP tests.
- 2026-06-29 — Slice 3b built: keyed `McpClientManager` connections by server id
  (adapter dispatches by id), added `McpUserToolset`/`buildUserMcpToolset` (per-user,
  in-memory, no global table/registry). 61 MCP tests.
- 2026-06-29 — Slice 3c built: wired MCP into `app/api/chat/route.ts` — build the
  user's `McpUserToolset` at request time (gated on userId+admin client, failures
  non-fatal), inject its definitions into the offered tool list, and route `mcp__*`
  tool calls through `toolset.execute()` (user-scoped) instead of the global
  executor. MCP client is now end-to-end: config (3b) → discover → offer → dispatch.
  type-check + eslint clean; 61 MCP unit tests. (gap #1 — MCP client — DONE)
- 2026-06-29 — Slice 3c review round (codex P1+P2s): MCP load now gated on an
  AUTHENTICATED userId (verified widget/batch paths) — NOT a request-body claim;
  moved below the widget admin-client setup so widget users load MCP too; bounded
  discovery with an 8s deadline (non-fatal) so a slow MCP server can't stall chat.
  Follow-ups (open): refresh shared connection when a server's url/auth changes
  (connect no-ops on cached id); MCP calls don't write a `tool_executions` row
  (no tools-table id) so they're invisible in tool telemetry.
  NOTE: 'normal mode' (body-supplied userId, unverified) will NOT load MCP — if the
  main chat path uses it, it must authenticate (widget key / session) for MCP.
- 2026-06-29 — Slice 3c review round 2 (codex P1+P2s) + merged main: widget API
  keys are PUBLIC, so they no longer mark the user MCP-eligible (don't expose the
  owner's servers/auth via a public widget) — MCP loads only for verified batch
  session / service-role auth. Fixed the Promise.race orphan (swallow late
  rejection). Merged main's offered-tool allowlist (`allowedToolNames`) with the
  MCP dispatch branch. OPEN follow-ups: (a) the primary chat client (`useChat`)
  posts userId in the body but sends NO session Authorization header, so regular
  chat is unverified and won't load MCP — needs real session auth on that path for
  MCP to work in the main UI (product/auth decision); (b) all-or-nothing discovery
  race drops the whole toolset if one server exceeds 8s — move to per-server
  deadlines + parallel load; (c) connection refresh on server config change;
  (d) MCP calls not in tool_executions telemetry.
- 2026-06-29 - Chat session-token auth (enables MCP in the main UI): `useChat`
  now sends the Supabase session token as `Authorization: Bearer`, and the chat
  route's normal mode VERIFIES it server-side (`getUser`); a verified session sets
  the real userId + `isAuthenticatedUser` (so MCP loads), and wins over any
  body-supplied id (no impersonation). Unverified callers fall back to body userId
  (no MCP), preserving existing behavior. Resolves the slice-3c regular-chat-auth
  follow-up. (MCP client gap #1 now usable in the primary chat UI.)
- 2026-06-29 - Normal-mode auth data gate: unverified normal-mode callers no
  longer fall back to body/memory `userId`, and body-supplied `conversationId`
  is dropped without a verified session. This closes the #62 residual where
  service-role DB/context/model paths could still act on a claimed user id.
- 2026-06-29 - MCP per-server discovery deadline: `McpUserToolset.load` now loads
  enabled servers in parallel with a per-server timeout, so one hung MCP server
  is skipped without dropping tools from faster servers. The `/api/chat` global
  MCP discovery deadline remains as a final backstop. Remaining MCP follow-ups:
  refresh shared connections when URL/auth changes; schema-first telemetry for
  MCP `tool_executions`; browser-level live SSE verification.
- 2026-06-29 - MCP connection refresh: `McpClientManager.connect` now reuses a
  cached connection only when the transport/auth config still matches the
  requested server config. URL/auth/stdio command changes disconnect the stale
  client and open a fresh connection, including the in-flight stale-attempt case;
  stale `onclose` callbacks cannot delete the refreshed connection. Remaining
  MCP follow-ups: schema-first telemetry for MCP `tool_executions`;
  browser-level live SSE verification.
