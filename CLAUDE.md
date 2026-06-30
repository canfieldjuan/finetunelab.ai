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

## Root Cause, Not Symptoms

See `AGENTS.md` → "Root Cause, Not Symptoms". Fix issues **as far upstream as is correct** — no symptom patching. Name the root cause (the underlying problem, not the surface symptom or a reviewer's exact wording) before the fix, and make the change address it. A patch that fights another layer — or a soft instruction asking the model/user to behave instead of removing the broken affordance — is a symptom fix; find and fix the cause. The "root" nearest the symptom is often downstream of a deeper defect: trace to the origin and fix at the most-upstream point that is correct and in safe scope. If you can't reach the true root in safe scope, name it and the follow-up rather than ship the shallow patch.

## Drift Reduction

- Search before adding a new component, API helper, model adapter, tool registry entry, or migration pattern.
- Reuse existing auth helpers, Supabase clients, loggers, tool registry patterns, and UI primitives.
- Delete or document obsolete code only inside the requested lane.
- If you touch `package.json`, shared types, API response shapes, migrations, or route contracts, update the relevant coordination doc.

## Worktree Cleanup

**Tear down a PR's worktree and branch the same session it merges or closes** — do not let merged worktrees or branches linger. Remove the **worktree first, then the branch** (a branch checked out in a worktree cannot be deleted).

When merging/closing or picking up the next slice:
1. Re-fetch live PR/check state.
2. Confirm the current branch and worktree, and that the worktree has no uncommitted local changes.
3. Merge or close only the requested PR/lane.
4. Once the PR is confirmed merged/closed, remove its matching worktree (`git worktree remove worktrees/<name>`) then its branch (`git branch -d <branch>`); use `git worktree prune` after. Force/`-D` only with explicit user approval.
5. Update the session drift note with final status and next lane.
