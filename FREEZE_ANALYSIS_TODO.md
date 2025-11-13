# Chat Freeze Analysis Todo

1. Reproduce the freeze with the browser devtools open and capture the full network trace for `/api/graphrag/documents`, `/api/settings`, and `/api/conversations/*`.
2. Add temporary logging in `hooks/useDocuments.ts` to record request start/end times and timeout triggers; review logs after a repro run.
3. Toggle the DocumentList component off in `components/Chat.tsx` to confirm whether document polling is required to trigger the hang.
4. Inspect React Profiler output for the initial render to identify components with unusually long commit times.
5. Verify the Supabase queries for messages and context (`limit` usage, ordering) to ensure no large payloads slip through during load.
