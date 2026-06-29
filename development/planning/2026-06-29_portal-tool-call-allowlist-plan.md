# Portal Tool Call Allowlist Plan

## Why this slice exists

The live tool-output probe lane found that portal tool execution protects global registry, database enablement, portal eligibility, config toggles, and parameter validation, but not the per-request offered-tool set. A model could name another globally enabled portal tool that was not included in the tools offered for that request. MCP tools already get a tighter per-user toolset guard; built-in portal tools need the same request-local boundary.

## Scope

1. Capture the portal tool names offered to the model for the current chat request.
2. Enforce that allowlist at the shared portal execution boundary before registry/database lookup and before execution logging.
3. Cover both blocked and allowed portal tool calls with focused tests.
4. Keep this slice to built-in portal tools; no MCP routing or UI changes.

## Files touched

- `app/api/chat/route.ts`
- `lib/tools/toolManager.ts`
- `lib/tools/__tests__/toolManager.test.ts`
- `development/planning/2026-06-29_portal-tool-call-allowlist-plan.md`

## Mechanism

`app/api/chat/route.ts` builds a `Set` from the final tool definitions offered to the model and passes it into `executePortalChatTool`. `executeTool` checks that set before resolving the registry or database row. A tool that was not offered returns a closed error and never inserts a `tool_executions` row; a tool that was offered continues through the existing portal gates.

## Intentional

- The allowlist lives at the execution boundary instead of only inside the route so native and recovered XML portal tool calls share the same protection.
- This does not change MCP dispatch. MCP tools are scoped through the per-user toolset path and remain outside `executePortalChatTool`.
- Streaming paths that do not execute portal tools are not expanded here; this slice guards the execution path that can actually run tools.

## Deferred

- Full `/api/chat` browser/API smoke for hallucinated built-in tool calls.
- Route-level MCP/build-failure routing tests from PR #57's non-blocking notes.
- Unified analytics for MCP invocations, which do not currently write `tool_executions` rows.

## Verification

- `npm run test:vitest -- lib/tools/__tests__/toolManager.test.ts --reporter=dot` passed: 6 tests.
- `npm run type-check` passed.
- `git diff --check` passed.
- `npm run lint` passed with existing repo warnings and no errors.
- `npm run build` passed; build emitted the existing missing-env placeholder/fetch noise but completed successfully.

## Estimated diff size

Target: under 140 LOC.
