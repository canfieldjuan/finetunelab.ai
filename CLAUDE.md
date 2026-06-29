# Claude Guidance For FinetuneLab

Read `AGENTS.md` first. This file adds Claude-specific guardrails for terminal-agent sessions.

## Default Claude Lane

Claude is usually strongest here on backend/API, migrations, services, scripts, training, GraphRAG, tests, and repo/process hygiene. Frontend work is fine when requested, but trace the route/component tree first and keep UI changes consistent with existing components.

Before editing, run or inspect:
```bash
git status --short --branch
git worktree list
```

Then create/update a session drift note from `.agents/session-drift/TEMPLATE.md`.

## Session Drift Habit

Use one drift file per active session:
```text
.agents/session-drift/YYYY-MM-DD-branch-or-task.md
```

Keep it short but live. At minimum, update:
- current objective
- branch/worktree
- files touched
- checks run
- unresolved risks
- next step after compaction

Because `.agents/session-drift/*.md` is ignored, these notes are for local continuity, not PR documentation. If the work changes a durable contract, update `.github/ai-coordination/*.md` or a tracked plan/progress doc too.

## Checks Before Claims

Do not claim a feature is done from code inspection alone. Run a relevant check or state that it was not run.

Preferred order:
```bash
npm run type-check
npm run lint
npm test
npm run build
```

For targeted work, run the closest Vitest/Jest/API/browser check first, then decide whether broader checks are needed.

## Drift Reduction

- Search before adding a new component, API helper, model adapter, tool registry entry, or migration pattern.
- Reuse existing auth helpers, Supabase clients, loggers, tool registry patterns, and UI primitives.
- Delete or document obsolete code only inside the requested lane.
- If you touch `package.json`, shared types, API response shapes, migrations, or route contracts, update the relevant coordination doc.

## Worktree Cleanup

When the user asks to merge/close/pick up the next slice:
1. Re-fetch live PR/check state.
2. Confirm the current branch and worktree.
3. Merge or close only the requested PR/lane.
4. Remove only the matching worktree/branch after the PR is confirmed merged/closed and there are no local changes.
5. Update the session drift note with final status and next lane.
