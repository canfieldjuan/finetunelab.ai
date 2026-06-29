# Session Drift Notes

Use this folder for one local handoff note per active agent session. These notes are intentionally ignored by git so compaction guards and resume breadcrumbs do not pollute PRs.

Copy `TEMPLATE.md` to:
```text
.agents/session-drift/YYYY-MM-DD-branch-or-task.md
```

Update the note whenever the session changes direction, before pausing, after checks, and before any merge/close/worktree cleanup.

Do not store secrets, tokens, production credentials, or private customer data here.
