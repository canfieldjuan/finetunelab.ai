# Chat Normal Auth Data Gate Plan

## Why this slice exists

PR #62 made normal portal chat send a Supabase bearer token and made verified
sessions MCP-eligible, but its review called out the remaining root issue:
normal-mode requests without a verified session still fell back to body/memory
`userId`. The route then used that claimed id for per-user data paths such as
conversation history, context, GraphRAG, model lookup, trace attribution, and
session tagging through service-role clients.

## Scope

1. Change normal-mode user resolution so only a verified bearer resolves to a
   user id.
2. Drop body-supplied `conversationId` in normal mode when the bearer is absent
   or invalid.
3. Extend route-level smoke coverage so an unauthenticated body-claimed user
   cannot trigger MCP, context, GraphRAG, user-scoped model lookup, or claimed
   trace attribution.

## Files touched

- `lib/chat/resolve-chat-user.ts`
- `lib/chat/__tests__/resolve-chat-user.test.ts`
- `app/api/chat/route.ts`
- `app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts`
- `PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md`
- `development/planning/2026-06-29_chat-normal-auth-data-gate-plan.md`

## Mechanism

`resolveChatUser()` now returns `{ userId: null, isAuthenticated: false }` for
all unverified normal-mode cases. The route also clears normal-mode
`conversationId` when the resolved user is unauthenticated. Existing widget and
batch paths keep their validated user ids because they authenticate through API
key, service role, or session validation before setting `userId`.

## Intentional

- Anonymous normal chat can still run with global/default model behavior.
- Body/memory `userId` no longer enables user-scoped data in normal mode.
- Widget and batch paths are unchanged.

## Deferred

- Browser-level auth smoke for logged-in chat using a real Supabase session.
- Persistence/trace assertions with a live database.

## Verification

- `npm ci` installed dependencies in the fresh worktree.
- `npm run test:vitest -- lib/chat/__tests__/resolve-chat-user.test.ts app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts --run` passed: 8 tests.
- `npm run test:vitest -- app/api/chat/__tests__/route-tool-use-smoke.test.ts app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts lib/chat/__tests__/resolve-chat-user.test.ts lib/tools/mcp/__tests__/adapter.test.ts lib/tools/mcp/__tests__/user-toolset.test.ts lib/tools/__tests__/toolManager.test.ts lib/llm/__tests__/unified-client.test.ts lib/llm/adapters/__tests__/openai-adapter.test.ts --run` passed: 43 tests.
- `git diff --check` passed.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.

## Estimated diff size

Target: under 250 LOC. Current product/test/log diff is about +50 / -18, plus this 56-line plan.
