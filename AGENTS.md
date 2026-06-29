# FinetuneLab Agent Operating Guide

This repo is a large Next.js 15 / TypeScript application with Supabase, GraphRAG, training, analytics, billing, and local/cloud worker surfaces. Most drift here comes from agents adding isolated features without checking adjacent contracts, tests, worktrees, or handoff state. Use this file as the root operating contract for every agent session.

## Start Every Session

1. Read this file and `CLAUDE.md` when using Claude.
2. Check local state before editing:
   ```bash
   git status --short --branch
   git branch --show-current
   git worktree list
   ```
3. Identify the lane:
   - Feature work: name the feature, target route/API/service, and expected user behavior.
   - Fix work: reproduce or trace the bug before changing code.
   - PR/review work: fetch live PR/check/thread state before giving merge guidance.
4. Create or update one session drift note under `.agents/session-drift/` using the template in that folder. Keep it current enough that another agent can resume after compaction.
5. Read the relevant coordination docs before touching shared systems:
   - `.github/AI_WORKFLOW.md`
   - `.github/ai-coordination/README.md`
   - domain files in `.github/ai-coordination/`

## Scope And Cohesion Rules

- Stay in one lane per session unless the user explicitly redirects.
- Trace existing routes, components, hooks, services, migrations, and tests before implementing.
- Prefer existing patterns in `app/`, `components/`, `lib/`, `hooks/`, `supabase/migrations/`, and `scripts/` over new abstractions.
- Keep feature docs, coordination notes, and tests aligned with code changes in the same PR when the change affects contracts or cross-agent work.
- Do not leave generated experiments, duplicate components, debug pages, or scratch scripts unless they are intentional deliverables and documented.
- When touching shared contracts, update the relevant `.github/ai-coordination/*.md` file with the exact paths, types, endpoints, and decisions.

## Verification Expectations

Run the narrowest reliable checks for the files you changed, then broaden when behavior crosses boundaries.

Default gates:
```bash
npm run type-check
npm run lint
npm test
```

Broader gate when preparing a PR or touching shared infrastructure:
```bash
npm run full-ci
```

Useful targeted checks:
```bash
npm run test:vitest -- path/to/test.test.ts
npm run test:e2e
npm run build
```

If a check is too slow, blocked by missing services, or unrelated failures exist, report exactly what was run, what failed, and why the remaining risk is acceptable or not acceptable. Do not imply unrun checks passed.

## Worktree Hygiene

This repo has `worktrees/` and stale worktrees can hide old branches, stale dependencies, and merged PR work.

Before starting:
```bash
git worktree list
git branch --merged main
```

During work:
- Use a dedicated branch/worktree for non-trivial features.
- Do not edit another active worktree unless the user asked you to.
- Do not delete or reset user changes. If a worktree has unknown changes, stop and report them.

After a PR merges or closes:
```bash
git fetch --prune
git worktree list
git worktree prune --dry-run
git branch --merged main
```

Clean only confirmed-safe branches/worktrees:
```bash
git worktree remove worktrees/<name>
git branch -d <branch>
git worktree prune
```

Use `git branch -D` or force removal only when the user explicitly approves and the PR is merged/closed or the work is intentionally abandoned.

## PR And Branch Discipline

- Check live GitHub state before commenting on PR readiness.
- Do not merge, close, or modify unrelated PRs.
- Confirm checks, review threads, and branch freshness before merge guidance.
- Keep branch names descriptive. Existing conventions include `claude/<work>`, `copilot/<work>`, `feature/<work>`, `fix/<work>`, and `shared/<work>`.
- Commit messages should use the repo style from `.github/CONTRIBUTING.md`, such as `feat:`, `fix:`, `docs:`, `test:`, `chore:`.

## Compaction And Handoff Guards

Maintain one session drift note per active session under `.agents/session-drift/`. Update it at every meaningful boundary:

- before large edits
- after tests/checks
- before pausing
- when blocked
- after opening, merging, or closing a PR

The note should include:
- branch and worktree
- objective and current lane
- files touched or likely to touch
- decisions made
- commands run and results
- blockers and risks
- exact next step

Do not store secrets in session drift files. These files are intentionally ignored by git except for the README/template.

## Safety Rails

- Never commit `.env*` files or secrets.
- Treat migrations and RLS changes as high-risk; verify auth/ownership behavior.
- Treat billing, training job control, API keys, provider secrets, and worker dispatch as high-risk.
- For UI work, verify the actual route in browser when practical and keep text/layout responsive.
- For database or external-service work, document any required manual setup or env vars.
