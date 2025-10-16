--
-- Supabase SQL schema for session logs
-- Table: session_logs
--
-- Tracks user authentication events for continuity and context.
--
create table if not exists session_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    event text not null check (event in ('login', 'logout', 'signup', 'delete_account')),
    timestamp timestamptz not null default now(),
    metadata jsonb
);

-- Index for fast lookup by user
create index if not exists idx_session_logs_user_id on session_logs(user_id);
