# Chat Tool Binding Controls Plan

## Why this slice exists

GitHub issue #79 tracks the provider-agnostic local chat portal parity backlog.
The URL/page reader tool has already landed, and the next least-lift item is a
way to choose which generic portal tools are available to a chat. The backend
already enforces a request-local portal tool allowlist; the remaining gap is
that the live chat UI always sends every enabled built-in portal tool.

Root cause: tool availability is operator-configurable globally, but not
selectable at the chat surface. This slice fixes that root for built-in portal
tools by filtering the actual tool definitions sent to `/api/chat`, so the
existing server allowlist remains authoritative for execution.

## Scope

- Ownership lane: provider-agnostic local chat portal parity
- Slice phase: Vertical slice

1. Add a compact chat-header control for toggling built-in portal tools on or
   off for the current chat session.
2. Send only the selected built-in portal tools to `/api/chat`.
3. Keep server-side execution enforcement unchanged: `/api/chat` still derives
   the authoritative allowlist from the offered tool definitions and
   `executePortalChatTool` blocks unoffered built-in tool calls.
4. Add focused UI/hook coverage for filtered tool request bodies.
5. Preserve draft tool selections when a new chat is persisted and receives
   its real conversation id.

### Files touched

- `components/Chat.tsx`
- `components/chat/ChatHeader.tsx`
- `components/chat/ToolBindingControls.tsx`
- `components/chat/toolBindingState.ts`
- `components/chat/types.ts`
- `components/hooks/useConversationActions.ts`
- `components/hooks/useChat.ts`
- `components/hooks/__tests__/useChat.mcp-sse.test.tsx`
- `components/chat/__tests__/ToolBindingControls.test.tsx`
- `components/chat/__tests__/toolBindingState.test.ts`
- `.github/ai-coordination/API_COORDINATION.md`
- `.github/ai-coordination/TYPES_COORDINATION.md`
- `development/planning/2026-07-01_chat-tool-binding-controls-plan.md`

## Mechanism

`Chat.tsx` keeps the loaded tool definitions as the source list and stores a
per-chat set of disabled tool names in local React state. The derived enabled
tool list is passed into `useChat`, so request construction and the existing
route allowlist see the same selected tools. `ToolBindingControls` renders a
header popover with checkboxes, count state, and enable-all/disable-all actions.
When a blank draft chat is persisted as a real conversation, the draft disabled
tool set is migrated to the created conversation id and the shared `draft` entry
is removed so the second turn keeps the same bindings and the next draft does
not inherit stale choices.

## Intentional

- This slice controls built-in portal tools only. User-scoped MCP tools are
  discovered server-side and need a separate binding surface if we want
  per-server/per-tool MCP selection later.
- Bindings are session-local UI state, not persisted per model or conversation
  in the database. That keeps this PR to the thinnest observable path while the
  control shape is still being proven.
- No changes to `/api/chat` execution enforcement are expected because the
  request-local allowlist already exists and has route-level regression tests.

## Deferred

- Persisted per-chat or per-model tool defaults.
- MCP tool binding controls.
- Tool catalog/import/export, which is the next issue #79 item after bindings.

## Verification

- `npm run test:vitest -- components/chat/__tests__/ToolBindingControls.test.tsx components/chat/__tests__/toolBindingState.test.ts components/hooks/__tests__/useChat.mcp-sse.test.tsx --run` - 3 files, 19 tests passed.
- `npm run type-check` - passed.
- `git diff --check` - passed.
- `npm run lint` - passed with existing warning debt (0 errors, 244 warnings).
- `npm test` - passed: 103 files, 911 tests. Local Postgres restart/NOTICE output was emitted, but Vitest exited 0.
- `npm run build` - passed. Build emitted existing missing-env/static-generation logs and stale browser-data notices, but exited 0.

## Estimated diff size

Actual: 13 committed files, approximately +586 / -47. This is over the first
target because the vertical slice needs a reusable control, focused component
and state tests, one hook request-body regression, and the required
plan/coordination docs.
