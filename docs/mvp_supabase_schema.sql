-- Supabase Table Schemas for MVP Portal

-- 1. session_logs
create table if not exists session_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    event text not null check (event in ('login', 'logout', 'signup', 'delete_account', 'message_sent', 'conversation_created', 'feedback_given', 'signed_in', 'signed_out', 'user_updated')),
    conversation_id uuid references conversations(id) on delete cascade,
    timestamp timestamptz not null default now(),
    metadata jsonb
);
create index if not exists idx_session_logs_user_id on session_logs(user_id);
create index if not exists idx_session_logs_conversation_id on session_logs(conversation_id);

-- 2. conversations
create table if not exists conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    title text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_conversations_user_id on conversations(user_id);

-- 3. messages
create table if not exists messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid references conversations(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz not null default now(),
    response_id uuid,
    streaming boolean default false
);
create index if not exists idx_messages_conversation_id on messages(conversation_id);

-- 4. feedback
create table if not exists feedback (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    conversation_id uuid references conversations(id) on delete cascade,
    response_id uuid references messages(id) on delete cascade,
    value integer not null check (value in (1, -1)),
    created_at timestamptz not null default now()
);
create index if not exists idx_feedback_response_id on feedback(response_id);
